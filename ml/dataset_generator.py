#!/usr/bin/env python3
"""
Operational Chiller & HVAC Plant Telemetry Dataset Generator
Generates realistic industrial operational data with genuine thermodynamic physics,
sensor readings, power consumption performance, and operational anomalies.
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_chiller_dataset(n_samples=1200, random_seed=42, output_path="data/operational_chiller_telemetry.csv"):
    np.random.seed(random_seed)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    start_time = datetime(2026, 3, 1, 0, 0, 0)
    timestamps = [start_time + timedelta(minutes=15 * i) for i in range(n_samples)]
    
    # Diurnal time cycle
    hours = np.array([ts.hour + ts.minute / 60.0 for ts in timestamps])
    day_fraction = np.sin(2 * np.pi * (hours - 6) / 24.0) # peak around 12:00 - 15:00
    
    # 1. Outdoor ambient parameters
    # Outdoor temp: base 22°C + diurnal swing 10°C + random variation
    outdoor_ambient_temp_c = np.clip(22.0 + 8.5 * day_fraction + np.random.normal(0, 1.5, n_samples), 15.0, 42.0)
    
    # Outdoor humidity: inverse to temperature (higher at night/dawn)
    outdoor_humidity_pct = np.clip(65.0 - 20.0 * day_fraction + np.random.normal(0, 4.0, n_samples), 25.0, 95.0)
    
    # 2. Cooling Load (Tons) - higher during afternoon peak operations
    # Industrial/commercial load: 220 Tons baseline to 780 Tons peak
    base_load = 320.0 + 260.0 * np.maximum(0, day_fraction)
    cooling_load_tons = np.clip(base_load + np.random.normal(0, 25.0, n_samples), 160.0, 820.0)
    
    # 3. Chilled Water Supply Temperature (°C) - controlled setpoint around 6.5°C
    chilled_water_supply_temp_c = np.clip(6.7 + np.random.normal(0, 0.35, n_samples), 5.2, 8.2)
    
    # 4. Chilled Water Delta T & Return Temperature (°C)
    # Delta T is proportional to load / flow. For normal operation: Delta T ~ 4.5 to 6.2 °C
    delta_t = 4.8 + 1.2 * (cooling_load_tons / 600.0) + np.random.normal(0, 0.25, n_samples)
    chilled_water_return_temp_c = chilled_water_supply_temp_c + delta_t
    
    # 5. Chilled water flow rate (GPM)
    # GPM = Load (Tons) * 24 / Delta T (°F) -> proportional to load
    nominal_flow = (cooling_load_tons * 2.4) + np.random.normal(0, 25.0, n_samples)
    chilled_water_flow_rate_gpm = np.clip(nominal_flow, 450.0, 1950.0)
    
    # 6. Condenser Water Temp (°C)
    # Derived from outdoor wet bulb + cooling tower approach (approx 4°C above wet bulb)
    condenser_water_temp_c = np.clip(18.0 + 0.45 * outdoor_ambient_temp_c + 0.08 * outdoor_humidity_pct + np.random.normal(0, 0.8, n_samples), 20.0, 36.0)
    
    # 7. Condenser Refrigerant Pressure (kPa)
    # Saturation pressure scales with condensing temperature (~700 - 1000 kPa for R134a)
    condenser_pressure_kpa = 320.0 + 21.5 * condenser_water_temp_c + np.random.normal(0, 15.0, n_samples)
    
    # 8. Power Consumption Target Variable (kW)
    # Thermodynamic chiller power model:
    # Lift = Condenser temp - Evaporator temp
    lift = condenser_water_temp_c - chilled_water_supply_temp_c
    # Specific power ~ 0.58 kW/ton baseline + lift penalty
    specific_kw_ton = 0.54 + 0.0085 * (lift - 20.0) + 0.02 * np.maximum(0, (cooling_load_tons - 650) / 100.0)
    power_consumption_kw = cooling_load_tons * specific_kw_ton + np.random.normal(0, 8.0, n_samples)
    
    # Ground truth labels for anomalies
    anomaly_flag = np.zeros(n_samples, dtype=int)
    anomaly_category = ["Normal"] * n_samples
    
    # Inject deliberate operational anomalies (approx 7.5% of samples)
    n_anomalies = int(n_samples * 0.075)
    anomaly_indices = np.random.choice(n_samples, size=n_anomalies, replace=False)
    
    for idx in anomaly_indices:
        anomaly_flag[idx] = 1
        fault_type = np.random.choice(["condenser_fouling", "sensor_drift", "flow_choke", "refrigerant_leak", "power_surge"])
        anomaly_category[idx] = fault_type
        
        if fault_type == "condenser_fouling":
            # Tube scale buildup -> high condenser pressure & elevated power draw
            condenser_pressure_kpa[idx] += np.random.uniform(190.0, 290.0)
            condenser_water_temp_c[idx] += np.random.uniform(4.0, 7.5)
            power_consumption_kw[idx] += np.random.uniform(85.0, 150.0)
        elif fault_type == "sensor_drift":
            # Sensor calibration error
            if np.random.rand() > 0.5:
                chilled_water_return_temp_c[idx] += np.random.uniform(6.0, 12.0)
            else:
                chilled_water_supply_temp_c[idx] -= np.random.uniform(4.0, 7.0)
        elif fault_type == "flow_choke":
            # Pump or valve obstruction -> low flow with abnormal temperature differential
            chilled_water_flow_rate_gpm[idx] *= np.random.uniform(0.35, 0.55)
            chilled_water_return_temp_c[idx] += np.random.uniform(5.0, 8.5)
        elif fault_type == "refrigerant_leak":
            # Compressor works harder, high power, poor delta T
            power_consumption_kw[idx] += np.random.uniform(90.0, 160.0)
            condenser_pressure_kpa[idx] -= np.random.uniform(120.0, 200.0)
        elif fault_type == "power_surge":
            # Electrical phase imbalance / motor winding spike
            power_consumption_kw[idx] += np.random.uniform(110.0, 190.0)
    
    df = pd.DataFrame({
        "timestamp": [ts.strftime("%Y-%m-%d %H:%M:%S") for ts in timestamps],
        "cooling_load_tons": np.round(cooling_load_tons, 1),
        "chilled_water_supply_temp_c": np.round(chilled_water_supply_temp_c, 2),
        "chilled_water_return_temp_c": np.round(chilled_water_return_temp_c, 2),
        "chilled_water_flow_rate_gpm": np.round(chilled_water_flow_rate_gpm, 1),
        "outdoor_ambient_temp_c": np.round(outdoor_ambient_temp_c, 1),
        "outdoor_humidity_pct": np.round(outdoor_humidity_pct, 1),
        "condenser_water_temp_c": np.round(condenser_water_temp_c, 1),
        "condenser_pressure_kpa": np.round(condenser_pressure_kpa, 1),
        "power_consumption_kw": np.round(power_consumption_kw, 2),
        "operational_fault_flag": anomaly_flag,
        "fault_description": anomaly_category
    })
    
    df.to_csv(output_path, index=False)
    print(f"Dataset successfully created at {output_path} with {len(df)} rows.")
    print(f"Anomalies injected: {anomaly_flag.sum()} ({anomaly_flag.mean()*100:.1f}%)")
    return df

if __name__ == "__main__":
    generate_chiller_dataset()
