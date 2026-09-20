#!/usr/bin/env python3
"""
CLI training script for IsolationForest & LinearRegression models.
"""

import sys
import json
import argparse
from pipeline import train_models

def main():
    parser = argparse.ArgumentParser(description="Train Isolation Forest & Regression models")
    parser.add_argument("--dataset", type=str, default="data/operational_chiller_telemetry.csv", help="Path to training CSV dataset")
    parser.add_argument("--contamination", type=float, default=0.075, help="Anomaly contamination factor (0.01 - 0.20)")
    parser.add_argument("--models-dir", type=str, default="models", help="Directory to save joblib model pickles")
    
    args = parser.parse_args()
    
    try:
        results = train_models(
            dataset_path=args.dataset,
            contamination=args.contamination,
            models_dir=args.models_dir
        )
        print(json.dumps({"success": True, "data": results}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
