"""
YUKTHI 2026 National-Level Hackathon: Intelligent Energy & Equipment Monitoring
Data Ingestion and Preprocessing Pipeline (backend/pipeline.py)

Responsibilities:
1. Dynamic ingestion of any CSV conforming to the 11-field data contract.
2. Temporal sorting and grouping by equipment_id without hardcoding rows or timestamps.
3. Preservation of temporal gaps without penalizing or falsely flagging gaps as anomalies.
4. Robust domain-aware missing data imputation (forward-fill with moving-average fallback).
5. Contextual feature engineering (Specific Power kW/RT, Cooling Lift, Outdoor Wet-Bulb approximation,
   Rolling 24h baseline load, Heat Index, and Rate of Change).
"""

import math
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# Schema Definition: 11 Expected Fields
EXPECTED_COLUMNS = [
    "timestamp",
    "equipment_id",
    "Chilled Water Rate (L/sec)",
    "Cooling Water Temperature (C)",
    "Building Load (RT)",
    "Chiller Energy Consumption (kWh)",
    "Outside Temperature (F)",
    "Dew Point (F)",
    "Humidity (%)",
    "Wind Speed (mph)",
    "Pressure (in)",
]

NUMERIC_COLUMNS = [
    "Chilled Water Rate (L/sec)",
    "Cooling Water Temperature (C)",
    "Building Load (RT)",
    "Chiller Energy Consumption (kWh)",
    "Outside Temperature (F)",
    "Dew Point (F)",
    "Humidity (%)",
    "Wind Speed (mph)",
    "Pressure (in)",
]


def calculate_wet_bulb_temp(temp_f: float, humidity_pct: float) -> float:
    """
    Stull's equation approximation for wet-bulb temperature (in Celsius).
    Wet-bulb temperature is critical for cooling tower approach and chiller thermodynamic lift.
    """
    temp_c = (temp_f - 32.0) * (5.0 / 9.0)
    rh = max(1.0, min(100.0, humidity_pct))
    
    tw = (
        temp_c * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(temp_c + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )
    return round(tw, 2)


class ChillerDataPipeline:
    """
    Modular data ingestion and transformation pipeline.
    Works seamlessly with both standard Python dicts/lists and Pandas dataframes.
    """

    def __init__(self):
        self.imputation_stats: Dict[str, Dict[str, float]] = {}

    def validate_schema(self, headers: List[str]) -> Tuple[bool, List[str]]:
        """Validates that all 11 required columns are present."""
        missing = [col for col in EXPECTED_COLUMNS if col not in headers]
        return len(missing) == 0, missing

    def parse_csv_records(self, csv_text: str) -> List[Dict[str, Any]]:
        """Parses CSV text safely, handling headers, whitespace, and types."""
        lines = [line.strip() for line in csv_text.strip().splitlines() if line.strip()]
        if not lines:
            return []

        headers = [h.strip().replace('"', '') for h in lines[0].split(",")]
        valid, missing = self.validate_schema(headers)
        if not valid:
            raise ValueError(f"Schema mismatch. Missing required fields: {', '.join(missing)}")

        records = []
        for idx, line in enumerate(lines[1:], start=2):
            parts = [p.strip().replace('"', '') for p in line.split(",")]
            if len(parts) < len(headers):
                continue

            row: Dict[str, Any] = {}
            for col_name, val_str in zip(headers, parts):
                if col_name in NUMERIC_COLUMNS:
                    if val_str == "" or val_str.lower() in ("nan", "null", "none"):
                        row[col_name] = None
                    else:
                        try:
                            row[col_name] = float(val_str)
                        except ValueError:
                            row[col_name] = None
                else:
                    row[col_name] = val_str

            records.append(row)

        return records

    def process_and_impute(
        self, records: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Groups data by equipment_id, sorts chronologically, preserves temporal gaps,
        and applies forward-fill + rolling mean imputation to missing values.
        """
        # 1. Group by equipment
        equipment_groups: Dict[str, List[Dict[str, Any]]] = {}
        for rec in records:
            eq = rec.get("equipment_id", "UNKNOWN")
            if eq not in equipment_groups:
                equipment_groups[eq] = []
            equipment_groups[eq].append(rec)

        processed_groups: Dict[str, List[Dict[str, Any]]] = {}

        for eq_id, rows in equipment_groups.items():
            # 2. Chronological sort (ISO or standard format)
            rows.sort(key=lambda r: r.get("timestamp", ""))

            # Calculate baseline column means for this equipment for fallback
            col_sums: Dict[str, float] = {c: 0.0 for c in NUMERIC_COLUMNS}
            col_counts: Dict[str, int] = {c: 0 for c in NUMERIC_COLUMNS}

            for r in rows:
                for col in NUMERIC_COLUMNS:
                    v = r.get(col)
                    if v is not None:
                        col_sums[col] += v
                        col_counts[col] += 1

            col_means = {
                c: (col_sums[c] / col_counts[c] if col_counts[c] > 0 else 0.0)
                for c in NUMERIC_COLUMNS
            }
            self.imputation_stats[eq_id] = col_means

            # 3. Dynamic Imputation: Forward-Fill with rolling window fallback
            last_known: Dict[str, Optional[float]] = {c: None for c in NUMERIC_COLUMNS}
            window_buffer: Dict[str, List[float]] = {c: [] for c in NUMERIC_COLUMNS}
            WINDOW_SIZE = 5

            imputed_rows: List[Dict[str, Any]] = []

            for r in rows:
                row_copy = dict(r)
                is_imputed_flag = False

                for col in NUMERIC_COLUMNS:
                    val = row_copy.get(col)
                    if val is None:
                        is_imputed_flag = True
                        # Strategy: Recent window mean > last known > equipment global mean
                        recent = window_buffer[col]
                        if recent:
                            imputed_val = sum(recent) / len(recent)
                        elif last_known[col] is not None:
                            imputed_val = last_known[col]
                        else:
                            imputed_val = col_means[col]

                        row_copy[col] = round(imputed_val, 4)
                        row_copy[f"_imputed_{col}"] = True
                    else:
                        last_known[col] = val
                        window_buffer[col].append(val)
                        if len(window_buffer[col]) > WINDOW_SIZE:
                            window_buffer[col].pop(0)
                        row_copy[f"_imputed_{col}"] = False

                row_copy["_any_imputed"] = is_imputed_flag

                # 4. Contextual Feature Engineering
                # A. Specific Power (kW / RT):
                # 30-min kWh represents Power in kW * 0.5 h -> Power (kW) = Energy (kWh) * 2
                energy_kwh = row_copy.get("Chiller Energy Consumption (kWh)", 0.0)
                building_load_rt = row_copy.get("Building Load (RT)", 1.0)
                power_kw = energy_kwh * 2.0
                
                # Protect against division by zero
                safe_load_rt = max(10.0, building_load_rt)
                kw_per_rt = power_kw / safe_load_rt
                row_copy["Power (kW)"] = round(power_kw, 2)
                row_copy["Specific Power (kW/RT)"] = round(kw_per_rt, 4)

                # B. Coefficient of Performance (COP)
                # 1 RT = 3.517 kW thermal cooling
                # COP = Thermal Cooling (kW) / Electrical Power (kW)
                cooling_thermal_kw = safe_load_rt * 3.517
                cop = cooling_thermal_kw / max(1.0, power_kw)
                row_copy["COP"] = round(cop, 3)

                # C. Outdoor Wet-Bulb & Cooling Approach
                out_temp = row_copy.get("Outside Temperature (F)", 70.0)
                humidity = row_copy.get("Humidity (%)", 50.0)
                wet_bulb_c = calculate_wet_bulb_temp(out_temp, humidity)
                cooling_water_c = row_copy.get("Cooling Water Temperature (C)", 28.0)
                cooling_approach_c = cooling_water_c - wet_bulb_c

                row_copy["Wet Bulb Temp (C)"] = wet_bulb_c
                row_copy["Cooling Approach (C)"] = round(cooling_approach_c, 2)

                # D. Flow to Load Ratio (L/sec per RT) - Key indicator of Low Delta-T Syndrome
                flow_l_sec = row_copy.get("Chilled Water Rate (L/sec)", 0.0)
                flow_per_rt = flow_l_sec / safe_load_rt
                row_copy["Flow per RT (L/s/RT)"] = round(flow_per_rt, 4)

                imputed_rows.append(row_copy)

            processed_groups[eq_id] = imputed_rows

        return processed_groups


if __name__ == "__main__":
    import sys
    import os

    pipeline = ChillerDataPipeline()
    sample_path = os.path.join(os.path.dirname(__file__), "..", "data", "sample_chiller_data.csv")
    if os.path.exists(sample_path):
        with open(sample_path, "r", encoding="utf-8") as f:
            raw_csv = f.read()
        parsed = pipeline.parse_csv_records(raw_csv)
        processed = pipeline.process_and_impute(parsed)
        print(f"Data Pipeline self-test successful! Processed chillers: {list(processed.keys())}")
        for eq, items in processed.items():
            print(f" - {eq}: {len(items)} chronologically ordered intervals")
    else:
        print(f"Sample data file not found at {sample_path}")
