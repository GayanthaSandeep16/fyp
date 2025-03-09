import sys
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pickle

# Load the CSV file
csv_path = sys.argv[1]
df = pd.read_csv(csv_path)

# Preprocess inconsistent data
def preprocess_data(df):
    # Keep only numeric columns that exist in most rows (e.g., >80% non-null)
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    valid_cols = [col for col in numeric_cols if df[col].isna().mean() < 0.2]
    df_numeric = df[valid_cols].dropna()  # Drop rows with NaN in these columns

    # Fill any remaining NaN with column means (optional)
    df_numeric = df_numeric.fillna(df_numeric.mean())
    
    print(f"Selected features: {valid_cols}")
    print(f"Rows after preprocessing: {len(df_numeric)}")
    return df_numeric, df.loc[df_numeric.index]  # Return filtered numeric data and corresponding original rows

# Prepare data
X, df_filtered = preprocess_data(df)  # Get both numeric data and filtered original DataFrame
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Train K-Means (assuming 3 clusters: low, medium, high risk)
kmeans = KMeans(n_clusters=3, random_state=42)
kmeans.fit(X_scaled)

# Save the model and scaler
with open("kmeans_model.pkl", "wb") as f:
    pickle.dump(kmeans, f)
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

# Assign clusters to the filtered data and save results
df_filtered["Cluster"] = kmeans.predict(X_scaled)  # Assign clusters to filtered DataFrame
df_filtered.to_csv("clustered_data.csv", index=False)

print("K-Means training completed. Model saved as 'kmeans_model.pkl'.")
print(f"Cluster counts:\n{df_filtered['Cluster'].value_counts()}")