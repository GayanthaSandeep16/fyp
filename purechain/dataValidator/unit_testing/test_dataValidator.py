import unittest
import pandas as pd
import sys
import os

# python -m unittest test_dataValidator.py -v use to run this test
# Adjust sys.path to import from parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dataValidator import validate_data, rule_based_validation

class TestDataValidation(unittest.TestCase):
    def test_high_missing_values(self):
        """Test that data with >10% missing values is flagged as INVALID."""
        df = pd.DataFrame({"age": [1, None, None], "glucose": [100, 200, None]})
        result = validate_data(df)
        self.assertEqual(result["quality"], "INVALID", "Should be INVALID due to high missing values")
        self.assertIn("High missing values", "; ".join(result["issues"]), "Missing values issue should be reported")

    def test_duplicate_rows(self):
        """Test that data with >20 duplicate rows is flagged as INVALID."""
        df = pd.DataFrame({"age": [25] * 22, "glucose": [100] * 22})
        result = validate_data(df)
        self.assertEqual(result["quality"], "INVALID", "Should be INVALID due to duplicates")
        self.assertIn("Duplicate rows", "; ".join(result["issues"]), "Duplicate rows issue should be reported")

    def test_valid_data(self):
        """Test that clean data is flagged as VALID."""
        df = pd.DataFrame({"age": [25, 30, 35], "glucose": [100, 110, 120]})
        result = validate_data(df)
        self.assertEqual(result["quality"], "VALID", "Should be VALID for clean data")
        self.assertEqual(len(result["issues"]), 0, "No issues should be reported")

    def test_invalid_age(self):
        """Test that invalid age values are detected."""
        df = pd.DataFrame({"age": [-1, 150, 30], "glucose": [100, 110, 120]})
        result = validate_data(df)
        self.assertEqual(result["quality"], "INVALID", "Should be INVALID due to invalid age")
        self.assertIn("Invalid age values", "; ".join(result["issues"]), "Invalid age issue should be reported")

    def test_rule_based_validation_missing(self):
        """Test rule_based_validation directly for missing values."""
        df = pd.DataFrame({"age": [None, None, 30]})
        issues, missing_pct, duplicates = rule_based_validation(df)
        self.assertGreater(missing_pct, 10, "Missing percentage should exceed 10%")
        self.assertIn("High missing values", "; ".join(issues), "Should detect high missing values")

if __name__ == "__main__":
    unittest.main()