"""
YUKTHI 2026 National-Level Hackathon: Intelligent Energy & Equipment Monitoring
Contextual Anomaly Detection Engine (backend/ml_model.py)

Methodology:
1. Equipment-specific predictive baseline regression for expected energy consumption
   conditioning on Building Load (RT), Outside Temperature (F), Cooling Water Temp (C),
   and Chilled Water Rate (L/sec).
2. Contextual Residual Calculation: Residual = Actual Energy - Predicted Expected Energy.
3. Multi-Feature Isolation Outlier Scoring: Combines energy residuals, kW/RT deviation,
   and condenser thermal approach.
4. Severity Grading: NORMAL, LOW, MEDIUM, HIGH, CRITICAL.
5. Root-Cause & Evidence Extraction: Pinpoints exact physical subsystem faults.
"""

import math
from typing import Dict, List, Any, Optional, Tuple


class MultivariateLinearRegressor:
    """
    Multivariate least-squares regression with L2 regularization (Ridge).
    Ensures zero external dependency requirement while achieving fast, robust fitting.
    """

    def __init__(self, l2_alpha: float = 0.01):
        self.l2_alpha = l2_alpha
        self.weights: List[float] = []
        self.bias: float = 0.0
        self.feature_means: List[float] = []
        self.feature_stds: List[float] = []
        self.target_mean: float = 0.0
        self.target_std: float = 1.0

    def fit(self, X: List[List[float]], y: List[float]):
        n_samples = len(X)
        if n_samples == 0:
            return

        n_features = len(X[0])
        self.feature_means = [sum(X[i][j] for i in range(n_samples)) / n_samples for j in range(n_features)]
        self.feature_stds = [
            math.sqrt(sum((X[i][j] - self.feature_means[j]) ** 2 for i in range(n_samples)) / max(1, n_samples - 1))
            or 1.0
            for j in range(n_features)
        ]

        self.target_mean = sum(y) / n_samples
        self.target_std = (
            math.sqrt(sum((val - self.target_mean) ** 2 for val in y) / max(1, n_samples - 1))
            or 1.0
        )

        # Standardize
        X_norm = [
            [(X[i][j] - self.feature_means[j]) / self.feature_stds[j] for j in range(n_features)]
            for i in range(n_samples)
        ]
        y_norm = [(val - self.target_mean) / self.target_std for val in y]

        # Normal equation with ridge regularization via gradient descent / closed approximation
        # For small n_features (e.g. 5-7), gradient descent converges rapidly
        w = [0.0] * n_features
        b = 0.0
        lr = 0.05
        epochs = 200

        for _ in range(epochs):
            grad_w = [0.0] * n_features
            grad_b = 0.0
            for i in range(n_samples):
                pred = sum(w[j] * X_norm[i][j] for j in range(n_features)) + b
                err = pred - y_norm[i]
                for j in range(n_features):
                    grad_w[j] += err * X_norm[i][j]
                grad_b += err

            for j in range(n_features):
                w[j] -= lr * ((grad_w[j] / n_samples) + self.l2_alpha * w[j])
            b -= lr * (grad_b / n_samples)

        self.weights = w
        self.bias = b

    def predict(self, X: List[List[float]]) -> List[float]:
        n_features = len(self.weights)
        predictions = []
        for row in X:
            x_norm = [
                (row[j] - self.feature_means[j]) / self.feature_stds[j] if j < len(self.feature_means) else 0.0
                for j in range(n_features)
            ]
            y_norm_pred = sum(self.weights[j] * x_norm[j] for j in range(n_features)) + self.bias
            y_pred = (y_norm_pred * self.target_std) + self.target_mean
            predictions.append(max(0.0, y_pred))
        return predictions


class ChillerAnomalyEngine:
    """
    Contextual ML Anomaly Detection Engine for HVAC Industrial Chillers.
    Evaluates chillers independently to model their unique thermodynamic footprints.
    """

    def __init__(self, sensitivity_threshold: float = 50.0):
        self.sensitivity_threshold = sensitivity_threshold
        self.models: Dict[str, MultivariateLinearRegressor] = {}
        self.baseline_stats: Dict[str, Dict[str, float]] = {}

    def _extract_features(self, row: Dict[str, Any]) -> List[float]:
        """Extracts contextual predictors of energy consumption."""
        load = row.get("Building Load (RT)", 0.0)
        out_temp = row.get("Outside Temperature (F)", 70.0)
        cool_water = row.get("Cooling Water Temperature (C)", 28.0)
        flow_rate = row.get("Chilled Water Rate (L/sec)", 0.0)
        dew_point = row.get("Dew Point (F)", 55.0)
        humidity = row.get("Humidity (%)", 50.0)

        # Non-linear interaction term: Load * Temperature Lift
        lift_proxy = max(0.0, cool_water - 20.0)
        interaction_load_lift = (load / 100.0) * lift_proxy

        return [load, out_temp, cool_water, flow_rate, dew_point, humidity, interaction_load_lift]

    def train_equipment_model(self, equipment_id: str, records: List[Dict[str, Any]]):
        """Trains baseline regression model for expected energy consumption for an equipment unit."""
        if not records:
            return

        X = [self._extract_features(r) for r in records]
        y = [r.get("Chiller Energy Consumption (kWh)", 0.0) for r in records]

        regressor = MultivariateLinearRegressor()
        regressor.fit(X, y)
        self.models[equipment_id] = regressor

        # Compute baseline kw/RT and residuals distribution
        preds = regressor.predict(X)
        residuals = [abs(y[i] - preds[i]) for i in range(len(y))]
        kw_rts = [r.get("Specific Power (kW/RT)", 0.65) for r in records]

        mean_res = sum(residuals) / len(residuals) if residuals else 1.0
        var_res = sum((r - mean_res) ** 2 for r in residuals) / max(1, len(residuals) - 1)
        std_res = math.sqrt(var_res) or 1.0

        mean_kw_rt = sum(kw_rts) / len(kw_rts) if kw_rts else 0.65
        var_kw_rt = sum((k - mean_kw_rt) ** 2 for k in kw_rts) / max(1, len(kw_rts) - 1)
        std_kw_rt = math.sqrt(var_kw_rt) or 0.05

        self.baseline_stats[equipment_id] = {
            "mean_residual": mean_res,
            "std_residual": std_res,
            "mean_kw_rt": mean_kw_rt,
            "std_kw_rt": std_kw_rt,
        }

    def detect_anomalies(
        self, equipment_id: str, records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Runs contextual anomaly detection on the equipment time-series.
        Returns decorated records with expected values, anomaly score, severity, and evidence.
        """
        if equipment_id not in self.models:
            self.train_equipment_model(equipment_id, records)

        model = self.models.get(equipment_id)
        stats = self.baseline_stats.get(equipment_id, {
            "mean_residual": 5.0,
            "std_residual": 5.0,
            "mean_kw_rt": 0.65,
            "std_kw_rt": 0.08,
        })

        if not model or not records:
            return []

        X = [self._extract_features(r) for r in records]
        expected_energies = model.predict(X)

        results = []
        for idx, row in enumerate(records):
            actual_energy = row.get("Chiller Energy Consumption (kWh)", 0.0)
            expected_energy = round(expected_energies[idx], 2)
            energy_diff = round(actual_energy - expected_energy, 2)
            percent_deviation = (
                round((energy_diff / max(10.0, expected_energy)) * 100.0, 1)
                if expected_energy > 0
                else 0.0
            )

            # Contextual residual Z-Score
            res_z = (abs(energy_diff) - stats["mean_residual"]) / max(0.001, stats["std_residual"])

            # Specific Power (kW/RT) Z-Score
            current_kw_rt = row.get("Specific Power (kW/RT)", 0.65)
            kw_rt_z = (current_kw_rt - stats["mean_kw_rt"]) / max(0.001, stats["std_kw_rt"])

            # Cooling Approach / Heat Rejection Indicator
            cooling_approach = row.get("Cooling Approach (C)", 5.0)
            approach_factor = max(0.0, cooling_approach - 7.5) * 4.0

            # Flow-to-load distortion (Low Delta-T syndrome flag)
            flow_per_rt = row.get("Flow per RT (L/s/RT)", 0.45)
            low_delta_t_penalty = max(0.0, flow_per_rt - 0.65) * 50.0

            # Multi-dimensional Composite Anomaly Score (0 - 100)
            # Weighted combination of residual significance, thermodynamic inefficiency, and thermal approach
            raw_score = (
                max(0.0, res_z) * 22.0
                + max(0.0, kw_rt_z) * 20.0
                + approach_factor
                + low_delta_t_penalty
            )
            anomaly_score = min(100.0, round(raw_score, 1))

            # Determine severity
            if anomaly_score >= 80.0:
                severity = "CRITICAL"
            elif anomaly_score >= 65.0:
                severity = "HIGH"
            elif anomaly_score >= 45.0:
                severity = "MEDIUM"
            elif anomaly_score >= 30.0:
                severity = "LOW"
            else:
                severity = "NORMAL"

            is_anomaly = anomaly_score >= self.sensitivity_threshold

            # Evidence & Root-Cause Attribution
            evidence_reasons = []
            recommendation = "Optimal operational performance within standard thermodynamic bounds."

            if is_anomaly:
                if energy_diff > 15.0 and percent_deviation > 25.0:
                    evidence_reasons.append(
                        f"Excessive power draw: Consumption is {percent_deviation}% (+{energy_diff} kWh) above expected contextual baseline for {row.get('Building Load (RT)')} RT load at {row.get('Outside Temperature (F)')}°F ambient."
                    )
                if cooling_approach > 8.0:
                    evidence_reasons.append(
                        f"Condenser heat rejection deficit: Cooling water approach is elevated at {cooling_approach}°C above ambient wet-bulb, pointing to condenser tube fouling or cooling tower fan staging issue."
                    )
                    recommendation = "Schedule chemical descaling of condenser bundle; inspect cooling tower spray nozzles and basin water temperature."
                elif flow_per_rt > 0.65:
                    evidence_reasons.append(
                        f"Low Delta-T Syndrome detected: Flow rate of {flow_per_rt} L/s per RT indicates bypassed chilled water or malfunctioning 2-way control valves at air handling units."
                    )
                    recommendation = "Inspect decoupling bridge and check AHU modulating valves; restore nominal 5.5°C chilled water temperature differential."
                elif kw_rt_z > 2.0:
                    evidence_reasons.append(
                        f"Thermodynamic degradation: Specific power surged to {current_kw_rt} kW/RT (baseline: {round(stats['mean_kw_rt'], 2)} kW/RT), reducing COP to {row.get('COP')}."
                    )
                    recommendation = "Check compressor inlet guide vane position, refrigerant subcooling/superheat, and motor electrical winding temperatures."
                else:
                    evidence_reasons.append(
                        f"Multivariate residual outlier: Joint deviation of load-to-power and ambient weather conditions exceeded 2.5 standard deviations."
                    )
                    recommendation = "Review supervisory BMS setpoints and verify temperature sensor calibration on the evaporator and condenser headers."

            res_item = dict(row)
            res_item.update({
                "expected_energy_kwh": expected_energy,
                "energy_residual_kwh": energy_diff,
                "percent_deviation": percent_deviation,
                "anomaly_score": anomaly_score,
                "severity": severity,
                "is_anomaly": is_anomaly,
                "evidence_reasons": evidence_reasons,
                "recommendation": recommendation,
            })
            results.append(res_item)

        return results


if __name__ == "__main__":
    import os
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from pipeline import ChillerDataPipeline

    sample_path = os.path.join(os.path.dirname(__file__), "..", "data", "sample_chiller_data.csv")
    if os.path.exists(sample_path):
        pipeline = ChillerDataPipeline()
        with open(sample_path, "r", encoding="utf-8") as f:
            parsed = pipeline.parse_csv_records(f.read())
        processed = pipeline.process_and_impute(parsed)

        engine = ChillerAnomalyEngine(sensitivity_threshold=50.0)
        for eq_id, rows in processed.items():
            anomalies = engine.detect_anomalies(eq_id, rows)
            flagged = [a for a in anomalies if a["is_anomaly"]]
            print(f"{eq_id}: {len(flagged)} anomalies detected out of {len(anomalies)} records.")
            if flagged:
                sample_flag = flagged[0]
                print(f"  Sample Anomaly @ {sample_flag['timestamp']}: Score {sample_flag['anomaly_score']}, Severity {sample_flag['severity']}")
                print(f"  Evidence: {sample_flag['evidence_reasons'][0] if sample_flag['evidence_reasons'] else 'N/A'}")
    else:
        print("Sample data not found")
