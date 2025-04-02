import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from imblearn.over_sampling import SMOTE
import pickle
import logging

# Set up minimal logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load data
csv_path = sys.argv[1]
df = pd.read_csv(csv_path)

# Verify that the 'target' column exists
if 'target' not in df.columns:
    raise ValueError("CSV file does not contain a 'target' column")

# Use all features
features = [
    'gender', 'age', 'bmi', 'hba1c', 'glucose', 'bloodPressure', 'insulin',
    'diabetesPedigreeFunction', 'chol', 'hdl', 'ldl'
]
# Check if all features are in the DataFrame
missing_features = [f for f in features if f not in df.columns]
if missing_features:
    raise ValueError(f"Missing features in DataFrame: {missing_features}")

X = df[features].copy()
y = df['target']

# Ensure all features are numeric
X = X.apply(pd.to_numeric, errors='coerce')
X = X.fillna(X.mean(numeric_only=True))
if X.isna().any().any():
    X = X.fillna(0)

# Ensure y is numeric and handle missing values
y = pd.to_numeric(y, errors='coerce')
if y.isna().any():
    valid_indices = y.notna()
    X = X[valid_indices]
    y = y[valid_indices]

if len(X) == 0:
    raise ValueError("Dataset is empty after cleaning.")

# Create a holdout set before SMOTE
X_temp, X_holdout, y_temp, y_holdout = train_test_split(X, y, test_size=0.1, stratify=y, random_state=42)

# Subsample the data for faster processing
sample_size = 10000
if len(X_temp) > sample_size:
    X_temp, _, y_temp, _ = train_test_split(X_temp, y_temp, train_size=sample_size, stratify=y_temp, random_state=42)

# Apply SMOTE to handle class imbalance
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_temp, y_temp)

# Split and scale
X_train, X_test, y_train, y_test = train_test_split(X_resampled, y_resampled, test_size=0.2, random_state=42)

if (X_train.std() == 0).any():
    X_train += np.random.normal(0, 1e-5, X_train.shape)
    X_test += np.random.normal(0, 1e-5, X_test.shape)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train Random Forest with simplified hyperparameter tuning
rf = RandomForestClassifier(random_state=42, class_weight="balanced")
param_grid = {
    'n_estimators': [50],
    'max_depth': [10, None],
    'min_samples_split': [2],
    'min_samples_leaf': [1]
}
grid_search = GridSearchCV(rf, param_grid, cv=3, scoring='f1', n_jobs=1, verbose=1)
grid_search.fit(X_train_scaled, y_train)

# Best model
best_rf = grid_search.best_estimator_

# Predict probabilities and adjust threshold to prioritize recall
y_pred_proba = best_rf.predict_proba(X_test_scaled)[:, 1]
threshold = 0.3
y_pred = (y_pred_proba >= threshold).astype(int)

# Metrics on test set
accuracy = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, average='binary')
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)

print(f"Test Set Metrics:")
print(f"Accuracy: {accuracy:.4f}")
print(f"F1 Score: {f1:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall: {recall:.4f}")

# Evaluate on holdout set
X_holdout_scaled = scaler.transform(X_holdout)
y_holdout_pred_proba = best_rf.predict_proba(X_holdout_scaled)[:, 1]
y_holdout_pred = (y_holdout_pred_proba >= threshold).astype(int)
holdout_accuracy = accuracy_score(y_holdout, y_holdout_pred)
holdout_f1 = f1_score(y_holdout, y_holdout_pred, average='binary')
holdout_precision = precision_score(y_holdout, y_holdout_pred)
holdout_recall = recall_score(y_holdout, y_holdout_pred)

print(f"\nHoldout Set Metrics:")
print(f"Accuracy: {holdout_accuracy:.4f}")
print(f"F1 Score: {holdout_f1:.4f}")
print(f"Precision: {holdout_precision:.4f}")
print(f"Recall: {holdout_recall:.4f}")

# Feature importance
feature_importances = pd.DataFrame(
    best_rf.feature_importances_,
    index=features,
    columns=['importance']
).sort_values('importance', ascending=False)
print("\nFeature importances:")
print(feature_importances)

# Save model and scaler
with open("rf_model.pkl", "wb") as f:
    pickle.dump(best_rf, f)
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)