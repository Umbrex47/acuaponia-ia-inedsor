"""Cálculo de tasas de crecimiento temporal G = (At - At-1) / Δt."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional


def calculate_growth_rate(
    curr_area: float,
    prev_area: Optional[float],
    curr_time_iso: str,
    prev_time_iso: Optional[str],
    prev_growth_rate: Optional[float] = None,
) -> Dict[str, Any]:
    """Calcula la tasa de crecimiento vegetal cuantitativa.

    Fórmula:
        G = (A_t - A_{t-1}) / Δt   (normalizado a cm²/día)
        growth_percent = ((A_t - A_{t-1}) / A_{t-1}) * 100
    """
    if prev_area is None or prev_time_iso is None or prev_area <= 0:
        return {
            "growth_rate_per_day": 0.0,
            "growth_percent": 0.0,
            "growth_acceleration": 0.0,
            "delta_hours": 0.0,
        }

    try:
        t1 = datetime.fromisoformat(prev_time_iso)
        t2 = datetime.fromisoformat(curr_time_iso)
        delta_sec = max(1.0, (t2 - t1).total_seconds())
    except Exception:
        delta_sec = 86400.0  # fallback a 1 día

    delta_days = delta_sec / 86400.0
    delta_hours = delta_sec / 3600.0

    delta_area = curr_area - prev_area
    # Normalizado a cambio por día (24h)
    rate_per_day = delta_area / delta_days if delta_days > 0 else 0.0
    percent_growth = (delta_area / prev_area) * 100.0 if prev_area > 0 else 0.0

    # Aceleración respecto a la tasa de crecimiento previa
    acceleration = 0.0
    if prev_growth_rate is not None:
        acceleration = (rate_per_day - prev_growth_rate) / delta_days if delta_days > 0 else 0.0

    return {
        "growth_rate_per_day": round(rate_per_day, 2),
        "growth_percent": round(percent_growth, 2),
        "growth_acceleration": round(acceleration, 2),
        "delta_hours": round(delta_hours, 2),
    }
