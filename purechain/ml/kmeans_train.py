# ml/kmeans_train.py
import sys
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import joblib
import numpy as np

def train_kmeans(csv_path):
    # Read CSV
    data = pd.read_csv(csv_path)
    print("Data head:\n", data.head().to_string())
    print("Data info:\n", data.info())
    X = data.values
    
    # Scale the data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train K-Means with 2 clusters
    kmeans = KMeans(n_clusters=2, random_state=42)
    kmeans.fit(X_scaled)
    
    # Sample a subset for silhouette score
    n_samples = min(1000, len(X_scaled))
    if len(X_scaled) > n_samples:
        indices = np.random.choice(len(X_scaled), n_samples, replace=False)
        X_sampled = X_scaled[indices]
        labels_sampled = kmeans.labels_[indices]
    else:
        X_sampled = X_scaled
        labels_sampled = kmeans.labels_
    
    # Calculate and print silhouette score
    silhouette = silhouette_score(X_sampled, labels_sampled)
    print(f"Silhouette Score: {silhouette}")  
    
    # Save model and scaler
    joblib.dump(kmeans, 'model.pkl')
    joblib.dump(scaler, 'scaler.pkl')

if __name__ == "__main__":
    csv_path = sys.argv[1]
    train_kmeans(csv_path)