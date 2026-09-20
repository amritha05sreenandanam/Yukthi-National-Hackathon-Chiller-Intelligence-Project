# YUKTHI 2026: Intelligent Energy & Equipment Monitoring

## Production-Grade Unsupervised Contextual Anomaly Detection Engine

This directory contains the machine learning backend and pipeline engineered for the **YUKTHI 2026 National-Level Hackathon**.

---

### 1. Data Contract & Schema (11 Fields)
1. `timestamp` (Datetime: e.g. `2026-03-01 00:00:00`)
2. `equipment_id` (Categorical: `CHILLER-01`, `CHILLER-02`, `CHILLER-03`)
3. `Chilled Water Rate (L/sec)` (Continuous, flow rate)
4. `Cooling Water Temperature (C)` (Continuous, condenser supply)
5. `Building Load (RT)` (Continuous, refrigeration tons)
6. `Chiller Energy Consumption (kWh)` (Target feature for contextual expected baseline)
7. `Outside Temperature (F)` (Continuous ambient dry-bulb)
8. `Dew Point (F)` (Continuous ambient dew point)
9. `Humidity (%)` (Continuous ambient relative humidity)
10. `Wind Speed (mph)` (Continuous ambient wind speed)
11. `Pressure (in)` (Continuous barometric pressure)

---

### 2. Preprocessing & Engineering Pipeline (`pipeline.py`)
- **Dynamic Ingestion:** Reads arbitrary CSV datasets conforming to the 11 columns without hardcoded row lengths.
- **Chronological Sorting & Temporal Gap Preservation:** Respects intermittent telemetry dropouts without fabricating pseudo-records or marking time gaps as operational anomalies.
- **Domain-Aware Imputation:** Forward-fill with rolling 5-step window fallback, resolving sporadic missing values while preventing future data leakage.
- **Engineered Contextual Features:**
  - **Specific Power ($kW/RT$):** Electrical demand normalized by thermal tonnage.
  - **Coefficient of Performance (COP):** $COP = \frac{\text{Thermal Cooling (kW)}}{\text{Electrical Power (kW)}}$.
  - **Stull's Wet-Bulb Temperature ($T_{wb}$):** Critical for thermodynamic cooling tower approach.
  - **Cooling Approach ($C$):** $T_{cooling\_water} - T_{wb}$ to isolate condenser scaling and cooling tower fan failures.
  - **Flow-to-Load Ratio ($L/s/RT$):** Diagnostic indicator for *Low $\Delta T$ Syndrome*.

---

### 3. Contextual Anomaly Detection Model (`ml_model.py`)
- **Stage 1 - Expected Baseline Regression:** Trains equipment-specific contextual regressors predicting expected energy consumption conditioned on:
  $$\hat{E} = f(\text{Building Load}, \text{Outside Temp}, \text{Cooling Water Temp}, \text{Chilled Water Rate}, \text{Wet-Bulb Temp}, \text{Load} \times \text{Lift})$$
- **Stage 2 - Contextual Residual Computation:**
  $$e_t = E_{actual, t} - \hat{E}_t$$
- **Stage 3 - Multi-Dimensional Outlier Scoring:**
  Integrates standardized energy residual $Z(e_t)$, specific power deviation $Z(kW/RT)$, excessive condenser approach penalty, and low $\Delta T$ penalties into a continuous Anomaly Score ($0 - 100$).
- **Stage 4 - Automated Root-Cause Attribution & Actionable Recommendations:**
  Pinpoints specific physical mechanisms (condenser fouling, Low Delta-T bypass, compressor mechanical degradation, sensor drift).

---

### 4. Running the Standalone Python Pipeline
```bash
# Optional: Install requirements
pip install -r requirements.txt

# Run pipeline validation and feature transformation
python3 backend/pipeline.py

# Run contextual anomaly detection self-test
python3 backend/ml_model.py

# Launch FastAPI backend (if uvicorn installed)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
