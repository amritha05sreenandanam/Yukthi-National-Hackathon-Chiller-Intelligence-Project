#!/usr/bin/env python3
"""
CLI inference script for operational anomaly detection & regression prediction.
Loads models using joblib (does NOT retrain) and evaluates new data.
"""

import sys
import json
import argparse
import numpy as np
import pandas as pd
from pipeline import load_models, predict_batch, FEATURE_COLS, TARGET_COL

def main():
    parser = argparse.ArgumentParser(description="Run inference using saved ML models")
    parser.add_argument("--mode", type=str, choices=["manual", "csv", "info"], required=True, help="Inference mode")
    parser.add_argument("--input", type=str, default="", help="JSON string of feature values (for manual mode)")
    parser.add_argument("--input-file", type=str, default="", help="CSV file path (for csv mode)")
    parser.add_argument("--models-dir", type=str, default="models", help="Directory containing saved joblib models")
    
    args = parser.parse_args()
    
    try:
        models_bundle = load_models(args.models_dir)
        if models_bundle is None:
            print(json.dumps({"success": False, "error": "Trained models not found. Please train models first."}))
            sys.exit(1)
            
        if args.mode == "info":
            meta = models_bundle.get("metadata", {})
            print(json.dumps({"success": True, "data": meta}))
            return
            
        elif args.mode == "manual":
            if not args.input:
                # Try reading from stdin
                args.input = sys.stdin.read().strip()
                
            if not args.input:
                raise ValueError("No input data provided for manual inference")
                
            input_dict = json.loads(args.input)
            df_single = pd.DataFrame([input_dict])
            
            # Predict
            results = predict_batch(df_single, models_bundle)
            record = results["records"][0]
            
            # Additional root cause analysis / diagnostic guidance based on telemetry
            diagnostics = []
            if record["is_anomaly"]:
                # Check which parameters diverge most from training mean
                scaler = models_bundle["scaler"]
                means = dict(zip(FEATURE_COLS, scaler.mean_))
                stds = dict(zip(FEATURE_COLS, scaler.scale_))
                
                for f in FEATURE_COLS:
                    val = float(record[f])
                    m = means[f]
                    s = stds[f]
                    z_score = (val - m) / (s + 1e-6)
                    if abs(z_score) > 2.0:
                        direction = "significantly elevated" if z_score > 0 else "severely depressed"
                        diagnostics.append(f"{f.replace('_', ' ').title()} is {direction} (z-score: {z_score:+.2f}).")
            
            output_payload = {
                "success": True,
                "data": {
                    "is_anomaly": record["is_anomaly"],
                    "status": record["status"],
                    "anomaly_score_raw": record["anomaly_score_raw"],
                    "anomaly_severity_pct": record["anomaly_severity_pct"],
                    "predicted_power_kw": record["predicted_power_kw"],
                    "actual_power_kw": record.get("actual_power_kw"),
                    "residual_deviation_kw": record.get("residual_deviation_kw"),
                    "deviation_pct": record.get("deviation_pct"),
                    "cooling_load_tons": record.get("cooling_load_tons"),
                    "diagnostics": diagnostics,
                    "cop": round(float((record.get("cooling_load_tons", 450) * 3.517) / max(record["predicted_power_kw"], 1.0)), 2),
                    "kw_per_ton": round(float(record["predicted_power_kw"] / max(record.get("cooling_load_tons", 450), 1.0)), 3)
                }
            }
            print(json.dumps(output_payload))
            
        elif args.mode == "csv":
            if not args.input_file:
                raise ValueError("No input file path specified for csv mode")
                
            df_upload = pd.read_csv(args.input_file)
            results = predict_batch(df_upload, models_bundle)
            print(json.dumps({"success": True, "data": results}))
            
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
