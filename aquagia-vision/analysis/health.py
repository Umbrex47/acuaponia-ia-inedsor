"""Motor de evaluación de salud vegetal multivariable de AquaGia Vision."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def evaluate_plant_health(
    phenotype: Dict[str, Any],
    color_metrics: Dict[str, Any],
    growth_metrics: Dict[str, Any],
    sensor_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Evalúa la salud vegetal combinando visión, historial de crecimiento y sensores.

    Estados:
        🟢 normal: Follaje verde, crecimiento positivo o sostenido, sin necrosis.
        🟡 atencion: Leve decoloración o desaceleración en el crecimiento.
        🟠 estres: Clorosis visible, marchitez o contracción foliar moderada.
        🔴 anomalia: Necrosis severa, caída drástica de área (>5%) o daño patológico.
    """
    green_ratio = float(color_metrics.get("green_ratio", 0.7))
    yellow_ratio = float(color_metrics.get("yellow_ratio", 0.0))
    brown_ratio = float(color_metrics.get("brown_ratio", 0.0))
    solidity = float(phenotype.get("solidity", 0.8))
    growth_pct = float(growth_metrics.get("growth_percent", 0.0))

    factors: List[str] = []

    # 1. Puntuación base a partir de la visión (color y solidez de lámina)
    # Verde aporta hasta 0.45, solidez hasta 0.25
    base_score = (green_ratio * 0.45) + (solidity * 0.25) + 0.30

    # Penalización por clorosis (amarillamiento)
    if yellow_ratio > 0.08:
        penalty = min(0.35, yellow_ratio * 1.5)
        base_score -= penalty
        factors.append(f"Clorosis foliar ({int(yellow_ratio * 100)}%)")

    # Penalización severa por necrosis (manchas pardas/secas)
    if brown_ratio > 0.05:
        penalty = min(0.50, brown_ratio * 2.5)
        base_score -= penalty
        factors.append(f"Pardeamiento/necrosis ({int(brown_ratio * 100)}%)")

    # 2. Factor de crecimiento histórico
    if growth_pct < -3.0:
        base_score -= 0.25
        factors.append(f"Pérdida de área vegetal ({growth_pct:.1f}%)")
    elif growth_pct < -1.0:
        base_score -= 0.12
        factors.append(f"Contracción foliar leve ({growth_pct:.1f}%)")
    elif growth_pct >= 2.0:
        base_score = min(1.0, base_score + 0.05)
        factors.append(f"Crecimiento vigoroso (+{growth_pct:.1f}%)")

    # 3. Factor de sensores ambientales/agua (si están disponibles)
    if sensor_data:
        ph = sensor_data.get("ph")
        ec = sensor_data.get("ec")
        temp = sensor_data.get("temperature")

        if ph is not None and (ph < 5.8 or ph > 7.4):
            base_score -= 0.08
            factors.append(f"pH subóptimo ({ph:.1f})")
        if ec is not None and (ec < 0.7 or ec > 2.5):
            base_score -= 0.06
            factors.append(f"EC fuera de rango ({ec:.2f} mS/cm)")
        if temp is not None and temp > 28.0:
            base_score -= 0.08
            factors.append(f"Temperatura alta de agua ({temp:.1f}°C)")

    # Puntuación final acotada [0.0, 1.0]
    health_score = round(max(0.0, min(1.0, base_score)), 3)
    anomaly_score = round(1.0 - health_score, 3)

    # 4. Clasificación del estado
    if brown_ratio > 0.18 or growth_pct < -6.0 or health_score < 0.35:
        status = "anomalia"
        status_label = "Anomalía crítica"
    elif yellow_ratio > 0.22 or growth_pct < -2.0 or health_score < 0.55:
        status = "estres"
        status_label = "Posible estrés"
    elif yellow_ratio > 0.12 or health_score < 0.70:
        status = "atencion"
        status_label = "Atención"
    else:
        status = "normal"
        status_label = "Saludable"

    if not factors:
        factors.append("Parámetros morfológicos y de color normales")

    return {
        "health_score": health_score,
        "anomaly_score": anomaly_score,
        "status": status,
        "status_label": status_label,
        "factors": factors,
    }
