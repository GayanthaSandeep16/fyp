import sys
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, f1_score,precision_score, recall_score
import pickle

# Load data
csv_path = sys.argv[1]
df = pd.read_csv(csv_path)

# Preprocess
df['gender'] = df['gender'].map({'Female': 0, 'Male': 1, 'F': 0, 'M': 1}).fillna(0)  
X = df[['gender', 'age', 'bmi', 'hba1c', 'glucose']].fillna(df.mean(numeric_only=True))
y = df['target']

# Split and scale
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train Random Forest
rf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42)
rf.fit(X_train_scaled, y_train)
y_pred = rf.predict(X_test_scaled)

# Metrics
accuracy = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, average='binary')
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
print(f"Accuracy: {accuracy:.4f}")
print(f"F1 Score: {f1:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall: {recall:.4f}")

# Save model
with open("rf_model.pkl", "wb") as f:
    pickle.dump(rf, f)
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)