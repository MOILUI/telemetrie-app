"""
Service IA — Maintenance prédictive + Forecasting + Anomaly detection.

FastAPI sur port 8000, exposé en interne au backend Node.js.

Endpoints :
  POST /predict/maintenance  → score de risque de panne pour une machine
  POST /forecast/sales       → prévision de ventes 7-30 jours
  POST /anomaly/detect       → liste d'anomalies sur 24h
  GET  /health               → liveness

Tout est gratuit (scikit-learn + statsmodels), tourne en local, pas d'appel
externe. Aucune donnée ne sort de ton serveur.
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest

try:
    from statsmodels.tsa.arima.model import ARIMA
    HAS_ARIMA = True
except ImportError:
    HAS_ARIMA = False

app = FastAPI(title="Telemetry AI Service", version="1.0.0")

# =========================================================
# Modèles Pydantic (validation des entrées)
# =========================================================
class TelemetryPoint(BaseModel):
    ts: int                         # timestamp ms
    values: Dict[str, float]        # ex: { "vibrations_g": 0.45, "temp_c": 72 }

class MaintenanceRequest(BaseModel):
    device_id: str
    history: List[TelemetryPoint]   # idéalement >= 7 jours de données
    metrics_to_watch: List[str] = ["vibrations_g", "temp_c", "current_a"]
    baseline_days: int = 7
    critical_threshold_multiplier: float = 1.5

class ForecastRequest(BaseModel):
    device_id: str
    daily_values: List[float]       # ex: [120, 135, 142, ...] ventes par jour
    horizon_days: int = 7

class AnomalyRequest(BaseModel):
    device_id: str
    metric_name: str
    series: List[float]             # série temporelle régulière (1 point / heure typiquement)
    contamination: float = 0.05

# =========================================================
# Endpoints
# =========================================================
@app.get("/health")
def health():
    return {"ok": True, "ts": int(datetime.now().timestamp() * 1000), "arima": HAS_ARIMA}


@app.post("/predict/maintenance")
def predict_maintenance(req: MaintenanceRequest):
    """
    Calcule un score de risque par métrique.
    Renvoie : {risk_score: 0-100, predicted_failure_days: int|null, details: {...}}
    """
    if len(req.history) < 50:
        raise HTTPException(400, f"Pas assez de données ({len(req.history)} points, minimum 50)")

    # Trier par timestamp
    sorted_pts = sorted(req.history, key=lambda p: p.ts)
    cutoff = sorted_pts[0].ts + req.baseline_days * 86400000

    per_metric_risk = {}
    overall_risk = 0.0
    earliest_failure_days = None

    for metric in req.metrics_to_watch:
        baseline = [p.values[metric] for p in sorted_pts if p.ts < cutoff and metric in p.values]
        recent = [p.values[metric] for p in sorted_pts if p.ts >= cutoff and metric in p.values]

        if len(baseline) < 20 or len(recent) < 10:
            per_metric_risk[metric] = {"status": "insufficient_data"}
            continue

        baseline_arr = np.array(baseline).reshape(-1, 1)
        recent_arr = np.array(recent).reshape(-1, 1)

        # Isolation Forest : détecte les anomalies par rapport à la baseline
        clf = IsolationForest(contamination=0.05, random_state=42).fit(baseline_arr)
        scores = clf.score_samples(recent_arr)
        anomaly_ratio = float((scores < -0.5).sum()) / len(scores)

        # Tendance : drift moyen baseline → recent
        b_mean, b_std = float(np.mean(baseline)), float(np.std(baseline)) or 0.001
        r_mean = float(np.mean(recent))
        drift_sigma = abs(r_mean - b_mean) / b_std

        # Score de risque combiné (0-100)
        score = min(100.0, anomaly_ratio * 200 + drift_sigma * 15)
        per_metric_risk[metric] = {
            "anomaly_ratio": round(anomaly_ratio, 3),
            "drift_sigma": round(drift_sigma, 2),
            "baseline_mean": round(b_mean, 3),
            "recent_mean": round(r_mean, 3),
            "risk_score": round(score, 1),
        }

        # Prévision si drift inquiétant + ARIMA dispo
        if HAS_ARIMA and score > 40 and len(sorted_pts) > 100:
            try:
                series = [p.values[metric] for p in sorted_pts if metric in p.values]
                model = ARIMA(series[-500:], order=(2, 1, 1)).fit()
                horizon = 24 * 30  # 30 jours en heures
                fc = model.forecast(steps=horizon)
                threshold = b_mean + req.critical_threshold_multiplier * (b_mean - min(baseline))
                breach_idx = next((i for i, v in enumerate(fc) if v > threshold), None)
                if breach_idx is not None:
                    days = breach_idx // 24
                    per_metric_risk[metric]["predicted_failure_days"] = days
                    if earliest_failure_days is None or days < earliest_failure_days:
                        earliest_failure_days = days
            except Exception as e:
                per_metric_risk[metric]["arima_error"] = str(e)

        overall_risk = max(overall_risk, score)

    return {
        "device_id": req.device_id,
        "overall_risk_score": round(overall_risk, 1),
        "risk_level": _risk_level(overall_risk),
        "predicted_failure_days": earliest_failure_days,
        "confidence_pct": round(min(99, 50 + overall_risk / 2), 0),
        "per_metric": per_metric_risk,
    }


@app.post("/forecast/sales")
def forecast_sales(req: ForecastRequest):
    """Prévision simple ARIMA des ventes."""
    if not HAS_ARIMA:
        return _forecast_naive(req)
    if len(req.daily_values) < 14:
        raise HTTPException(400, "Au moins 14 jours d'historique requis")
    try:
        model = ARIMA(req.daily_values, order=(2, 1, 2)).fit()
        forecast = model.forecast(steps=req.horizon_days)
        conf = model.get_forecast(steps=req.horizon_days).conf_int(alpha=0.10)
        result = [
            {"day": i + 1, "predicted": round(float(forecast[i]), 1),
             "low": round(float(conf[i][0]), 1), "high": round(float(conf[i][1]), 1)}
            for i in range(req.horizon_days)
        ]
        return {"device_id": req.device_id, "horizon_days": req.horizon_days, "forecast": result}
    except Exception:
        return _forecast_naive(req)


def _forecast_naive(req: ForecastRequest):
    """Fallback simple : moyenne mobile sur les 7 derniers jours."""
    last_7 = req.daily_values[-7:] if len(req.daily_values) >= 7 else req.daily_values
    mean = sum(last_7) / max(1, len(last_7))
    result = [
        {"day": i + 1, "predicted": round(mean, 1), "low": round(mean * 0.85, 1), "high": round(mean * 1.15, 1)}
        for i in range(req.horizon_days)
    ]
    return {"device_id": req.device_id, "horizon_days": req.horizon_days, "forecast": result, "method": "naive_moving_average"}


@app.post("/anomaly/detect")
def detect_anomaly(req: AnomalyRequest):
    """Liste les indices anormaux dans une série temporelle."""
    if len(req.series) < 20:
        raise HTTPException(400, "Au moins 20 points requis")
    arr = np.array(req.series).reshape(-1, 1)
    clf = IsolationForest(contamination=req.contamination, random_state=42).fit(arr)
    preds = clf.predict(arr)
    scores = clf.score_samples(arr)
    anomalies = [
        {"index": i, "value": req.series[i], "score": round(float(scores[i]), 3)}
        for i in range(len(req.series)) if preds[i] == -1
    ]
    return {
        "device_id": req.device_id,
        "metric": req.metric_name,
        "n_points": len(req.series),
        "n_anomalies": len(anomalies),
        "anomaly_rate_pct": round(len(anomalies) / len(req.series) * 100, 1),
        "anomalies": anomalies[:50],
    }


def _risk_level(score: float) -> str:
    if score < 25: return "low"
    if score < 50: return "moderate"
    if score < 75: return "high"
    return "critical"
