#!/usr/bin/env python3
"""
Operational Anomaly Detection & Prediction ML Pipeline
Implements:
1. Feature extraction & StandardScaler preprocessing
2. Scikit-learn Isolation Forest unsupervised anomaly detection
3. Scikit-learn Linear Regression continuous target prediction
4. Joblib model serialization & deserialization
5. Performance metrics: MAE, RMSE, R², and residual deviation
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

FEATURE_COLS = [
    "cooling_load_tons",
    "chilled_water_supply_temp_c",
    "chilled_water_return_temp_c",
    "chilled_water_flow_rate_gpm",
    "outdoor_ambient_temp_c",
    "outdoor_humidity_pct",
    "condenser_water_temp_c",
    "condenser_pressure_kpa"
]

TARGET_COL = "power_consumption_kw"

FEATURE_METADATA = {
    "cooling_load_tons": {"label": "Cooling Load", "unit": "Tons", "min": 150, "max": 900, "default": 450},
    "chilled_water_supply_temp_c": {"label": "Chilled Water Supply Temp", "unit": "°C", "min": 4.0, "max": 12.0, "default": 6.7},
    "chilled_water_return_temp_c": {"label": "Chilled Water Return Temp", "unit": "°C", "min": 8.0, "max": 18.0, "default": 12.2},
    "chilled_water_flow_rate_gpm": {"label": "Chilled Water Flow Rate", "unit": "GPM", "min": 300, "max": 2200, "default": 1100},
    "outdoor_ambient_temp_c": {"label": "Outdoor Ambient Temp", "unit": "°C", "min": 10.0, "max": 45.0, "default": 28.5},
    "outdoor_humidity_pct": {"label": "Outdoor Humidity", "unit": "%", "min": 15.0, "max": 100.0, "default": 55.0},
    "condenser_water_temp_c": {"label": "Condenser Water Temp", "unit": "°C", "min": 18.0, "max": 40.0, "default": 29.0},
    "condenser_pressure_kpa": {"label": "Condenser Pressure", "unit": "kPa", "min": 500, "max": 1250, "default": 890.0},
    "power_consumption_kw": {"label": "Power Consumption", "unit": "kW", "min": 80, "max": 800, "default": 285.0}
}


def compute_calibrated_anomaly_score(decision_scores, score_min=None, score_max=None):
    """
    Converts Isolation Forest decision_function output to an intuitive 0-100% anomaly score.
    In Isolation Forest:
    - Positive scores (>0) indicate typical normal inlier points
    - Negative scores (<0) indicate anomalous outlier points
    - The lower the raw score, the more severe the anomaly.
    """
    scores = np.asarray(decision_scores)
    # Raw decision function scores typically range from approx -0.30 (severe anomaly) to +0.20 (very normal)
    # Map score <= -0.15 to ~90-100%, score 0.0 to ~50%, score >= 0.15 to ~0-10%
    # Using smooth sigmoid or clipped linear mapping:
    # Anomaly intensity increases as decision_function decreases.
    centered = -scores
    # Scale such that 0 score maps to ~50, negative scores (normal) map to 0-35, positive centered (anomalies) map to 50-100
    calibrated = 1.0 / (1.0 + np.exp(-12.0 * centered)) * 100.0
    return np.round(np.clip(calibrated, 0.0, 100.0), 1)


def train_models(dataset_path="data/operational_chiller_telemetry.csv", contamination=0.075, models_dir="models"):
    """
    Executes complete training pipeline:
    1. Preprocessing (validation, median imputation, feature scaling)
    2. IsolationForest training (unsupervised anomaly detection)
    3. LinearRegression training (target continuous prediction)
    4. Model serialization via joblib into models/
    """
    os.makedirs(models_dir, exist_ok=True)
    
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")
        
    df = pd.read_csv(dataset_path)
    
    # Verify required feature columns exist
    missing_features = [col for col in FEATURE_COLS if col not in df.columns]
    if missing_features:
        raise ValueError(f"Dataset missing required feature columns: {missing_features}")
    
    if TARGET_COL not in df.columns:
        raise ValueError(f"Dataset missing continuous target output column: '{TARGET_COL}'")
        
    # Preprocessing: Impute missing values with median if any exist
    X_raw = df[FEATURE_COLS].copy()
    impute_values = {}
    for col in FEATURE_COLS:
        col_median = float(X_raw[col].median())
        impute_values[col] = col_median
        X_raw[col] = X_raw[col].fillna(col_median)
        
    y_raw = df[TARGET_COL].fillna(df[TARGET_COL].median()).values
    
    # Train/test split for regression evaluation
    X_train_df, X_test_df, y_train, y_test = train_test_split(
        X_raw, y_raw, test_size=0.20, random_state=42
    )
    
    # Feature Scaling
    scaler = StandardScaler()
    scaler.fit(X_train_df)
    
    X_train_scaled = scaler.transform(X_train_df)
    X_test_scaled = scaler.transform(X_test_df)
    X_full_scaled = scaler.transform(X_raw)
    
    # 1. Isolation Forest Training
    iso_forest = IsolationForest(
        n_estimators=150,
        contamination=float(contamination),
        random_state=42,
        n_jobs=-1
    )
    iso_forest.fit(X_train_scaled)
    
    # Unsupervised predictions on full dataset
    iso_preds_full = iso_forest.predict(X_full_scaled)  # 1 = Normal, -1 = Anomaly
    iso_scores_full = iso_forest.decision_function(X_full_scaled)
    calibrated_scores_full = compute_calibrated_anomaly_score(iso_scores_full)
    
    # 2. Linear Regression Training
    reg_model = LinearRegression()
    reg_model.fit(X_train_scaled, y_train)
    
    # Evaluate Regression
    y_test_pred = reg_model.predict(X_test_scaled)
    mae = float(mean_absolute_error(y_test, y_test_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_test_pred)))
    r2 = float(r2_score(y_test, y_test_pred))
    
    # Full dataset regression predictions & residuals
    y_full_pred = reg_model.predict(X_full_scaled)
    residuals_full = y_raw - y_full_pred
    full_mae = float(mean_absolute_error(y_raw, y_full_pred))
    full_rmse = float(np.sqrt(mean_squared_error(y_raw, y_full_pred)))
    full_r2 = float(r2_score(y_raw, y_full_pred))
    
    # Feature coefficients breakdown
    feature_coefficients = []
    for col, coef, mean, scale in zip(FEATURE_COLS, reg_model.coef_, scaler.mean_, scaler.scale_):
        feature_coefficients.append({
            "feature": col,
            "label": FEATURE_METADATA.get(col, {}).get("label", col),
            "unit": FEATURE_METADATA.get(col, {}).get("unit", ""),
            "coefficient_scaled": round(float(coef), 4),
            "unscaled_weight": round(float(coef / scale), 4),
            "mean": round(float(mean), 2),
            "std": round(float(scale), 2)
        })
    
    # Sort coefficients by absolute magnitude
    feature_coefficients.sort(key=lambda x: abs(x["coefficient_scaled"]), reverse=True)
    
    # Save models using joblib
    preprocessing_bundle = {
        "scaler": scaler,
        "feature_cols": FEATURE_COLS,
        "target_col": TARGET_COL,
        "impute_values": impute_values,
        "feature_metadata": FEATURE_METADATA,
        "contamination": contamination
    }
    
    iso_path = os.path.join(models_dir, "isolation_forest.pkl")
    reg_path = os.path.join(models_dir, "regression_model.pkl")
    prep_path = os.path.join(models_dir, "preprocessing.pkl")
    meta_path = os.path.join(models_dir, "metadata.json")
    
    joblib.dump(iso_forest, iso_path)
    joblib.dump(reg_model, reg_path)
    joblib.dump(preprocessing_bundle, prep_path)
    
    total_samples = len(df)
    anomalies_detected = int((iso_preds_full == -1).sum())
    
    metadata = {
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "dataset_path": dataset_path,
        "total_training_samples": total_samples,
        "train_samples": len(X_train_df),
        "test_samples": len(X_test_df),
        "contamination": float(contamination),
        "anomalies_detected_total": anomalies_detected,
        "anomaly_rate_pct": round(float(anomalies_detected / total_samples * 100), 2),
        "target_col": TARGET_COL,
        "feature_cols": FEATURE_COLS,
        "regression_metrics": {
            "test_mae": round(mae, 3),
            "test_rmse": round(rmse, 3),
            "test_r2": round(r2, 4),
            "full_mae": round(full_mae, 3),
            "full_rmse": round(full_rmse, 3),
            "full_r2": round(full_r2, 4),
            "intercept": round(float(reg_model.intercept_), 3)
        },
        "feature_coefficients": feature_coefficients
    }
    
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
        
    return metadata


def load_models(models_dir="models"):
    """
    Loads saved models and preprocessing artifacts from disk.
    """
    iso_path = os.path.join(models_dir, "isolation_forest.pkl")
    reg_path = os.path.join(models_dir, "regression_model.pkl")
    prep_path = os.path.join(models_dir, "preprocessing.pkl")
    meta_path = os.path.join(models_dir, "metadata.json")
    
    if not (os.path.exists(iso_path) and os.path.exists(reg_path) and os.path.exists(prep_path)):
        return None
        
    iso_forest = joblib.load(iso_path)
    reg_model = joblib.load(reg_path)
    preprocessing_bundle = joblib.load(prep_path)
    
    metadata = {}
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            metadata = json.load(f)
            
    return {
        "iso_forest": iso_forest,
        "reg_model": reg_model,
        "scaler": preprocessing_bundle["scaler"],
        "feature_cols": preprocessing_bundle["feature_cols"],
        "target_col": preprocessing_bundle["target_col"],
        "impute_values": preprocessing_bundle.get("impute_values", {}),
        "feature_metadata": preprocessing_bundle.get("feature_metadata", FEATURE_METADATA),
        "metadata": metadata
    }


def predict_batch(df_input, models_bundle):
    """
    Performs inference on a DataFrame of operational data using pre-loaded models:
    - Preprocessing with scaler
    - Isolation Forest predict and decision_function
    - Linear Regression prediction
    - Deviation (Residual = Actual - Predicted) if actual target column is present
    """
    iso_forest = models_bundle["iso_forest"]
    reg_model = models_bundle["reg_model"]
    scaler = models_bundle["scaler"]
    feature_cols = models_bundle["feature_cols"]
    target_col = models_bundle["target_col"]
    impute_values = models_bundle.get("impute_values", {})
    
    # Check if features are present
    missing_features = [col for col in feature_cols if col not in df_input.columns]
    if missing_features:
        raise ValueError(f"Missing required feature columns: {missing_features}")
        
    # Impute missing values with trained medians
    X = df_input[feature_cols].copy()
    for col in feature_cols:
        med = impute_values.get(col, 0.0)
        X[col] = pd.to_numeric(X[col], errors="coerce").fillna(med)
        
    X_scaled = scaler.transform(X)
    
    # 1. Isolation Forest inference
    iso_preds = iso_forest.predict(X_scaled)  # 1 = Normal, -1 = Anomaly
    iso_decision_scores = iso_forest.decision_function(X_scaled)
    calibrated_scores = compute_calibrated_anomaly_score(iso_decision_scores)
    
    # 2. Linear Regression inference
    y_pred = reg_model.predict(X_scaled)
    
    # Check if actual target column is present in input
    has_actual = target_col in df_input.columns
    actual_values = None
    residuals = None
    metrics = None
    
    if has_actual:
        actual_s = pd.to_numeric(df_input[target_col], errors="coerce")
        # if there are valid actual values
        valid_mask = actual_s.notna()
        if valid_mask.any():
            actual_values = actual_s.values
            residuals = actual_values - y_pred
            
            # calculate overall metrics if multiple rows
            valid_actuals = actual_values[valid_mask]
            valid_preds = y_pred[valid_mask]
            if len(valid_actuals) > 1:
                metrics = {
                    "mae": round(float(mean_absolute_error(valid_actuals, valid_preds)), 3),
                    "rmse": round(float(np.sqrt(mean_squared_error(valid_actuals, valid_preds))), 3),
                    "r2": round(float(r2_score(valid_actuals, valid_preds)), 4),
                    "mean_residual": round(float(np.mean(residuals[valid_mask])), 3),
                    "max_residual": round(float(np.max(np.abs(residuals[valid_mask]))), 3)
                }
    
    # Format results list
    records = []
    has_timestamp = "timestamp" in df_input.columns
    
    for i in range(len(df_input)):
        is_anomaly = bool(iso_preds[i] == -1)
        score = round(float(iso_decision_scores[i]), 4)
        calibrated = round(float(calibrated_scores[i]), 1)
        pred_val = round(float(y_pred[i]), 2)
        
        row_dict = {
            "index": i + 1,
            "timestamp": str(df_input["timestamp"].iloc[i]) if has_timestamp else f"Record #{i+1}",
            "is_anomaly": is_anomaly,
            "status": "Anomaly" if is_anomaly else "Normal",
            "anomaly_score_raw": score,
            "anomaly_severity_pct": calibrated,
            "predicted_power_kw": pred_val,
        }
        
        # Include original features for visibility
        for col in feature_cols:
            row_dict[col] = round(float(X[col].iloc[i]), 2)
            
        if actual_values is not None and not np.isnan(actual_values[i]):
            act_val = round(float(actual_values[i]), 2)
            res_val = round(float(residuals[i]), 2)
            row_dict["actual_power_kw"] = act_val
            row_dict["residual_deviation_kw"] = res_val
            row_dict["deviation_pct"] = round(float((res_val / (pred_val + 1e-6)) * 100), 2)
        else:
            row_dict["actual_power_kw"] = None
            row_dict["residual_deviation_kw"] = None
            row_dict["deviation_pct"] = None
            
        records.append(row_dict)
        
    total_count = len(records)
    anomaly_count = sum(1 for r in records if r["is_anomaly"])
    
    summary = {
        "total_records": total_count,
        "anomaly_count": anomaly_count,
        "normal_count": total_count - anomaly_count,
        "anomaly_rate_pct": round(float(anomaly_count / max(total_count, 1) * 100), 2),
        "mean_anomaly_severity": round(float(np.mean(calibrated_scores)), 1),
        "has_actual_targets": has_actual,
        "metrics": metrics
    }
    
    return {
        "summary": summary,
        "records": records
    }
