import unittest
import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
import pickle
from io import StringIO
from unittest.mock import patch

class TestDiabetesPredictionModel(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Create a temporary test CSV file"""
        cls.test_csv_path = "test_diabetes_data.csv"
        test_data = """gender,age,bmi,hba1c,glucose,target
Female,50,25.5,6.5,120,0
Male,45,28.1,7.0,145,1
F,55,30.2,7.5,160,1
M,35,22.8,5.8,100,0
Female,60,35.0,8.1,180,1
"""
        with open(cls.test_csv_path, 'w') as f:
            f.write(test_data)
        
        # Create an empty file to test file handling
        cls.empty_csv_path = "empty_test.csv"
        open(cls.empty_csv_path, 'w').close()
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test files"""
        os.remove(cls.test_csv_path)
        os.remove(cls.empty_csv_path)
        if os.path.exists("rf_model.pkl"):
            os.remove("rf_model.pkl")
        if os.path.exists("scaler.pkl"):
            os.remove("scaler.pkl")
    
    def test_data_loading(self):
        """Test that data loads correctly from CSV"""
        df = pd.read_csv(self.test_csv_path)
        self.assertEqual(len(df), 5)
        self.assertListEqual(list(df.columns), 
                           ['gender', 'age', 'bmi', 'hba1c', 'glucose', 'target'])
    
    def test_empty_data_handling(self):
        """Test handling of empty CSV file"""
        with self.assertRaises(pd.errors.EmptyDataError):
            pd.read_csv(self.empty_csv_path)
    
    def test_preprocessing(self):
        """Test gender mapping and NA handling"""
        df = pd.read_csv(self.test_csv_path)
        processed_gender = df['gender'].map({'Female': 0, 'Male': 1, 'F': 0, 'M': 1}).fillna(0)
        self.assertListEqual(processed_gender.tolist(), [0, 1, 0, 1, 0])
        
        df_with_na = df.copy()
        df_with_na.loc[0, 'age'] = np.nan
        X = df_with_na[['gender', 'age', 'bmi', 'hba1c', 'glucose']].fillna(df_with_na.mean(numeric_only=True))
        self.assertFalse(X.isna().any().any())
    
    def test_train_test_split(self):
        """Test that train-test split works correctly"""
        df = pd.read_csv(self.test_csv_path)
        df['gender'] = df['gender'].map({'Female': 0, 'Male': 1, 'F': 0, 'M': 1}).fillna(0)
        X = df[['gender', 'age', 'bmi', 'hba1c', 'glucose']].fillna(df.mean(numeric_only=True))
        y = df['target']
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        self.assertEqual(len(X_train), 4)
        self.assertEqual(len(X_test), 1)
        self.assertEqual(len(y_train), 4)
        self.assertEqual(len(y_test), 1)
        
        X_train2, _, _, _ = train_test_split(X, y, test_size=0.2, random_state=42)
        pd.testing.assert_frame_equal(X_train, X_train2)
    
    def test_scaling(self):
        """Test that scaling is applied correctly"""
        df = pd.read_csv(self.test_csv_path)
        df['gender'] = df['gender'].map({'Female': 0, 'Male': 1, 'F': 0, 'M': 1}).fillna(0)
        X = df[['gender', 'age', 'bmi', 'hba1c', 'glucose']].fillna(df.mean(numeric_only=True))
        y = df['target']
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        self.assertTrue(np.allclose(X_train_scaled.mean(axis=0), np.zeros(X_train.shape[1]), atol=1e-7))
        self.assertTrue(np.allclose(X_train_scaled.std(axis=0), np.ones(X_train.shape[1]), atol=1e-7))
    
    def test_model_training(self):
        """Test that the model can be trained and produces predictions"""
        df = pd.read_csv(self.test_csv_path)
        df['gender'] = df['gender'].map({'Female': 0, 'Male': 1, 'F': 0, 'M': 1}).fillna(0)
        X = df[['gender', 'age', 'bmi', 'hba1c', 'glucose']].fillna(df.mean(numeric_only=True))
        y = df['target']
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        rf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42)
        rf.fit(X_train_scaled, y_train)
        y_pred = rf.predict(X_test_scaled)
        
        self.assertTrue(set(y_pred).issubset({0, 1}))
        
        y_proba = rf.predict_proba(X_test_scaled)
        self.assertEqual(y_proba.shape, (len(X_test_scaled), 2))
        self.assertTrue(np.all(y_proba >= 0))
        self.assertTrue(np.all(y_proba <= 1))
    
    def test_model_metrics(self):
        """Test that metrics are calculated correctly"""
        y_true = np.array([0, 1, 0, 1, 1])
        y_pred = np.array([0, 1, 1, 0, 1])
        
        accuracy = accuracy_score(y_true, y_pred)
        f1 = f1_score(y_true, y_pred, average='binary')
        precision = precision_score(y_true, y_pred)
        recall = recall_score(y_true, y_pred)
        
        self.assertAlmostEqual(accuracy, 0.6)
        self.assertAlmostEqual(f1, 0.666666666, places=6)
        self.assertAlmostEqual(precision, 0.666666666, places=6)
        self.assertAlmostEqual(recall, 0.666666666, places=6)
    
    def test_model_saving(self):
        """Test that model and scaler are saved correctly"""
        df = pd.read_csv(self.test_csv_path)
        df['gender'] = df['gender'].map({'Female': 0, 'Male': 1, 'F': 0, 'M': 1}).fillna(0)
        X = df[['gender', 'age', 'bmi', 'hba1c', 'glucose']].fillna(df.mean(numeric_only=True))
        y = df['target']
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        
        rf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42)
        rf.fit(X_train_scaled, y_train)
        
        with open("rf_model.pkl", "wb") as f:
            pickle.dump(rf, f)
        with open("scaler.pkl", "wb") as f:
            pickle.dump(scaler, f)
        
        self.assertTrue(os.path.exists("rf_model.pkl"))
        self.assertTrue(os.path.exists("scaler.pkl"))
    
    @patch('sys.argv', ['script.py', 'test_diabetes_data.csv'])
    def test_script_invocation(self):
        """Test the script can be run with command line argument"""
        csv_path = sys.argv[1]
        self.assertEqual(csv_path, 'test_diabetes_data.csv')

if __name__ == '__main__':
    unittest.main()