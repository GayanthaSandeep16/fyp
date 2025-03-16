import sys
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import pickle

csv_path = sys.argv[1]
df = pd.read_csv(csv_path)

def preprocess_data(df):
    # Standardize column names to lowercase
    df.columns = df.columns.str.lower()

    # Define common diabetes-related numeric columns
    common_cols = [
        'age', 'bmi', 'hba1c', 'hba1c_level', 'glucose', 'blood_glucose_level',
        'urea', 'cr', 'chol', 'tg', 'hdl', 'ldl', 'vldl', 'insulin', 
        'bloodpressure', 'skinthickness', 'pregnancies', 'diabetespedigreefunction'
    ]
    
    # Filter for numeric columns present in the dataset
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    valid_cols = [col for col in numeric_cols if col in common_cols and df[col].isna().mean() < 0.2]
    df_numeric = df[valid_cols].dropna()

    # Fill missing values with column means
    df_numeric = df_numeric.fillna(df_numeric.mean())
    
    print(f"Selected features: {valid_cols}")
    print(f"Rows after preprocessing: {len(df_numeric)}")
    return df_numeric, df.index[df[valid_cols].notna().all(axis=1)]  # Return preprocessed data and matching index

# Preprocess and get matching index
df_numeric, valid_index = preprocess_data(df)
if df_numeric.empty:
    print("No valid numeric data after preprocessing. Exiting.")
    sys.exit(1)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(df_numeric)

kmeans = KMeans(n_clusters=3, random_state=42)
kmeans.fit(X_scaled)

score = silhouette_score(X_scaled, kmeans.labels_)
print(f"Silhouette Score: {score}")

with open("kmeans_model.pkl", "wb") as f:
    pickle.dump(kmeans, f)
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

# Assign clusters to the preprocessed DataFrame, then merge back to original
df_numeric["cluster"] = kmeans.predict(X_scaled)
# Reindex to original df and fill missing clusters with NaN
df_final = df.copy()
df_final.loc[valid_index, "cluster"] = df_numeric["cluster"]
df_final.to_csv("clustered_data.csv", index=False)

print("K-Means training completed.")
print(f"Cluster counts:\n{df_final['cluster'].value_counts(dropna=False)}")