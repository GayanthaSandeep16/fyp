
import joblib

def upload_model_to_ipfs(model):
    try:
        # Save the model to a file
        model_path = 'trained_model.pkl'
        joblib.dump(model, model_path)

        # Upload the model to IPFS
        with open(model_path, 'rb') as f:
            res = client.add(f)
            print(f"Model uploaded to IPFS with CID: {res['Hash']}")

        # Clean up the file
        import os
        os.remove(model_path)
    except Exception as e:
        print(f"Error uploading model to IPFS: {e}")