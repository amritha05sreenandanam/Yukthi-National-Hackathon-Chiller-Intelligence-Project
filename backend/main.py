"""
YUKTHI 2026 National-Level Hackathon: Intelligent Energy & Equipment Monitoring
FastAPI Backend Application (backend/main.py)

Endpoints:
- GET /api/equipment: List available chiller units with aggregate health scores.
- GET /api/data/{equipment_id}: Fetch historical time-series data with filtering options.
- GET /api/anomalies/{equipment_id}: Return detected anomalies, severity scores, and evidence.
- POST /api/upload: Upload new CSV conforming to the 11-field data contract.
- GET /api/summary: System-level fleet metrics and operational KPIs.
- GET /api/health: Service health check.
"""

import os
import sys
from typing import Dict, List, Any, Optional
from datetime import datetime

# Local imports
sys.path.insert(0, os.path.dirname(__file__))
from pipeline import ChillerDataPipeline, EXPECTED_COLUMNS
from ml_model import ChillerAnomalyEngine

# Note: FastAPI / Pydantic when running in an environment with FastAPI installed
try:
    from fastapi import FastAPI, UploadFile, File, Query, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

# Initialize pipeline and model engine
pipeline = ChillerDataPipeline()
anomaly_engine = ChillerAnomalyEngine(sensitivity_threshold=50.0)

# Global in-memory storage for processed data
DATA_STORE: Dict[str, List[Dict[str, Any]]] = {}
ANOMALY_STORE: Dict[str, List[Dict[str, Any]]] = {}


def load_default_dataset():
    """Loads and processes the baseline historical dataset."""
    sample_path = os.path.join(os.path.dirname(__file__), "..", "data", "sample_chiller_data.csv")
    if os.path.exists(sample_path):
        with open(sample_path, "r", encoding="utf-8") as f:
            content = f.read()
        records = pipeline.parse_csv_records(content)
        processed = pipeline.process_and_impute(records)
        DATA_STORE.clear()
        ANOMALY_STORE.clear()
        for eq_id, rows in processed.items():
            DATA_STORE[eq_id] = rows
            ANOMALY_STORE[eq_id] = anomaly_engine.detect_anomalies(eq_id, rows)
        print(f"Loaded default dataset: {len(DATA_STORE)} chillers initialized.")


load_default_dataset()

if HAS_FASTAPI:
    app = FastAPI(
        title="Yukthi Chiller Intelligence API",
        description="Contextual Anomaly Detection & Energy Monitoring API for YUKTHI 2026",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health_check():
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "chillers_loaded": list(DATA_STORE.keys()),
        }

    @app.get("/api/equipment")
    def get_equipment_list():
        results = []
        for eq_id in sorted(DATA_STORE.keys()):
            rows = DATA_STORE[eq_id]
            anomalies = ANOMALY_STORE.get(eq_id, [])
            flagged = [a for a in anomalies if a.get("is_anomaly")]
            critical_count = sum(1 for a in flagged if a.get("severity") == "CRITICAL")
            high_count = sum(1 for a in flagged if a.get("severity") == "HIGH")

            total_kwh = sum(r.get("Chiller Energy Consumption (kWh)", 0.0) for r in rows)
            avg_kw_rt = (
                sum(r.get("Specific Power (kW/RT)", 0.0) for r in rows) / len(rows)
                if rows
                else 0.0
            )

            # Health index score: 100 base, penalized by anomaly frequency & severity
            health_score = max(
                20.0,
                round(100.0 - (len(flagged) / max(1, len(rows))) * 150.0 - (critical_count * 2.5), 1),
            )

            results.append({
                "equipment_id": eq_id,
                "record_count": len(rows),
                "anomaly_count": len(flagged),
                "critical_count": critical_count,
                "high_count": high_count,
                "total_energy_kwh": round(total_kwh, 1),
                "avg_specific_power_kw_rt": round(avg_kw_rt, 3),
                "health_score": health_score,
                "start_time": rows[0]["timestamp"] if rows else None,
                "end_time": rows[-1]["timestamp"] if rows else None,
            })
        return results

    @app.get("/api/data/{equipment_id}")
    def get_equipment_data(
        equipment_id: str,
        limit: int = Query(500, ge=1, le=5000),
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ):
        if equipment_id not in DATA_STORE:
            raise HTTPException(status_code=404, detail=f"Equipment {equipment_id} not found")

        rows = DATA_STORE[equipment_id]
        if start_time:
            rows = [r for r in rows if r.get("timestamp", "") >= start_time]
        if end_time:
            rows = [r for r in rows if r.get("timestamp", "") <= end_time]

        return {
            "equipment_id": equipment_id,
            "total_available": len(rows),
            "data": rows[:limit],
        }

    @app.get("/api/anomalies/{equipment_id}")
    def get_equipment_anomalies(
        equipment_id: str,
        severity: Optional[str] = None,
        limit: int = Query(200, ge=1, le=1000),
    ):
        if equipment_id not in ANOMALY_STORE:
            raise HTTPException(status_code=404, detail=f"Equipment {equipment_id} not found")

        anomalies = ANOMALY_STORE[equipment_id]
        flagged = [a for a in anomalies if a.get("is_anomaly")]

        if severity:
            flagged = [a for a in flagged if a.get("severity", "").upper() == severity.upper()]

        return {
            "equipment_id": equipment_id,
            "total_anomalies": len(flagged),
            "anomalies": flagged[:limit],
        }

    @app.post("/api/upload")
    async def upload_dataset(file: UploadFile = File(...)):
        content = (await file.read()).decode("utf-8")
        try:
            records = pipeline.parse_csv_records(content)
            processed = pipeline.process_and_impute(records)

            DATA_STORE.clear()
            ANOMALY_STORE.clear()
            for eq_id, rows in processed.items():
                DATA_STORE[eq_id] = rows
                ANOMALY_STORE[eq_id] = anomaly_engine.detect_anomalies(eq_id, rows)

            return {
                "message": "Dataset uploaded and processed successfully",
                "filename": file.filename,
                "equipment_units": list(DATA_STORE.keys()),
                "total_records": sum(len(r) for r in DATA_STORE.values()),
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
else:
    print("FastAPI package not installed in environment; FastAPI app definition skipped.")
