import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from scipy.stats import entropy
import sys
import json
import joblib
import os

# Step 1: Rule-Based Validation (No changes needed)
def rule_based_validation(df):
    issues = []
    missing_pct = df.isnull().mean().max() * 100
    if missing_pct > 10:
        issues.append(f"High missing values: {missing_pct:.2f}%")
    
    duplicate_rows = df.duplicated().sum()
    if duplicate_rows > 10:
        issues.append(f"Duplicate rows: {duplicate_rows}")
    
    if 'age' in df.columns:
        invalid_age = df[(df['age'] < 0) | (df['age'] > 120)].shape[0]
        if invalid_age > 0:
            issues.append(f"Invalid age values: {invalid_age} rows")
    
    return issues, missing_pct, duplicate_rows

# Step 2: Statistical Metrics (Added null checks)
def calculate_statistics(df):
    stats = {}
    
    # Handle categorical columns
    categorical_cols = df.select_dtypes(include=['object']).columns
    if len(categorical_cols) > 0:
        for col in categorical_cols:
            counts = df[col].value_counts(normalize=True)
            stats[f'entropy_{col}'] = entropy(counts)
    
    # Handle numeric columns
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        for col in numeric_cols:
            if df[col].std() != 0:  # Avoid division by zero
                z_scores = (df[col] - df[col].mean()) / df[col].std()
                stats[f'outliers_{col}'] = (z_scores.abs() > 3).sum()
    
    return stats

# Step 3: ML Model Training (With model persistence)
def train_ml_model():
    temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    
    # Define model path
    model_path = os.path.join(temp_dir, 'trained_validator_model.pkl')
    
    if not os.path.exists(model_path):
        X = [
            [5.0, 0, 0.0, 100],   # High outliers, zero entropy
            [30.0, 20, 2.5, 15],  # Realistic scenario
            [2.0, 0, 0.0, 50],    # No entropy, moderate outliers
            [25.0, 15, 1.8, 10]   # Normal case
        ]
        y = [1, 0, 1, 0]  # Adjust labels based on domain knowledge
        
        model = LogisticRegression()
        model.fit(X, y)
        joblib.dump(model, model_path)
    
    return joblib.load(model_path)

# Step 4: Validation Pipeline (Modified for JSON output)
def validate_data(df):
    issues, missing_pct, duplicates = rule_based_validation(df)
    stats = calculate_statistics(df)
    
    # Handle empty entropy values
    entropy_values = [v for k, v in stats.items() if k.startswith('entropy')]
    avg_entropy = np.mean(entropy_values) if entropy_values else 0
    
    total_outliers = sum([v for k, v in stats.items() if k.startswith('outliers')]) or 0
    
    model = train_ml_model()
    features = [missing_pct, duplicates, avg_entropy, total_outliers]
    
    try:
        prediction = model.predict([features])[0]
    except:
        prediction = 0  # Fail-safe for invalid feature format
    
    return {
        "quality": "GOOD" if (len(issues) == 0 and prediction == 1) else "BAD",
        "issues": issues,
        "stats": {
            "missing_pct": float(missing_pct),
            "duplicates": int(duplicates),
            "avg_entropy": float(avg_entropy),
            "total_outliers": int(total_outliers)
        }
    }

# Step 5: Node.js Integration Entry Point (Added)
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Requires CSV file path as argument"}))
        sys.exit(1)
        
    try:
        df = pd.read_csv(sys.argv[1])
        result = validate_data(df)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))