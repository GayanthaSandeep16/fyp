import ipfshttpclient
import pandas as pd

# Connect to IPFS
client = ipfshttpclient.connect()

def fetch_dataset_from_ipfs(cid):
    try:
        # Fetch the file from IPFS
        res = client.cat(cid)
        # Load the CSV file into a pandas DataFrame
        df = pd.read_csv(res)
        return df
    except Exception as e:
        print(f"Error fetching dataset with CID {cid}: {e}")
        return None


        def clean_labels(datasets):
    # Combine all datasets into one
    combined_data = pd.concat(datasets)
    # Perform majority voting on the 'Outcome' column
    cleaned_labels = combined_data.groupby(combined_data.index).agg({
        'Outcome': lambda x: x.mode()[0]  # Take the mode (majority vote)
    })
    return cleaned_labels


    from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

def train_model(datasets, cleaned_labels):
    # Combine datasets into a single DataFrame
    combined_data = pd.concat(datasets)
    combined_data['Outcome'] = cleaned_labels['Outcome']

    # Split into features (X) and target (y)
    X = combined_data.drop('Outcome', axis=1)
    y = combined_data['Outcome']

    # Split into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train the model
    model = RandomForestClassifier(random_state=42)
    model.fit(X_train, y_train)

    return model, X_test, y_test

def evaluate_model(model, X_test, y_test):
    accuracy = model.score(X_test, y_test)
    print(f"Model Accuracy: {accuracy:.2f}")



    def main():
    # Step 1: Fetch datasets from IPFS
    ipfs_cids = [
        'QmExampleCID1',  # Replace with actual IPFS CIDs
        'QmExampleCID2',
        'QmExampleCID3'
    ]
    datasets = [fetch_dataset_from_ipfs(cid) for cid in ipfs_cids]
    datasets = [df for df in datasets if df is not None]  # Filter out failed fetches

    # Step 2: Clean labels
    cleaned_labels = clean_labels(datasets)

    # Step 3: Train the model
    model, X_test, y_test = train_model(datasets, cleaned_labels)

    # Step 4: Evaluate the model
    evaluate_model(model, X_test, y_test)

# Run the workflow
if __name__ == "__main__":
    main()