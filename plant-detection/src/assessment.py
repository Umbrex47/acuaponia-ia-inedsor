"""Construye assessment de anomalías vegetales con probabilidades."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


_FUNGAL_KEYS = ("mold", "powdery", "downy", "rust", "fung", "mildew", "smut")
_SPOT_KEYS = ("spot", "blight", "anthracnose", "scab", "canker")


def _clamp_pct(v: float) -> int:
    return int(max(0, min(100, round(v))))


def build_plant_assessment(analysis: dict[str, Any]) -> dict[str, Any]:
    """A partir del resultado de PlantAnalysisPipeline.analyze()."""
    plants = analysis.get("plants") or []
    summary = analysis.get("summary") or {}

    hyp_scores: dict[str, float] = {}
    hyp_evidence: dict[str, list[str]] = {}
    suggested: list[dict[str, str]] = []

    def bump(hid: str, score: float, evidence: str) -> None:
        hyp_scores[hid] = max(hyp_scores.get(hid, 0.0), score)
        hyp_evidence.setdefault(hid, []).append(evidence)

    for p in plants:
        health = p.get("health") or {}
        label = str(health.get("label", "unknown"))
        conf = float(health.get("confidence") or 0.0)
        details = health.get("details") or {}
        pid = p.get("id")

        if label == "diseased":
            detail_s = str(details).lower()
            brown = float(details.get("brown_ratio") or 0)
            if any(k in detail_s for k in _FUNGAL_KEYS) or brown > 0.2:
                bump(
                    "fungal_infection",
                    conf * 100,
                    f"plant#{pid} label=diseased conf={conf:.2f}",
                )
            elif any(k in detail_s for k in _SPOT_KEYS) or brown > 0.12:
                bump(
                    "leaf_spot_disease",
                    conf * 100,
                    f"plant#{pid} label=diseased conf={conf:.2f}",
                )
            else:
                bump(
                    "fungal_infection",
                    conf * 85,
                    f"plant#{pid} label=diseased conf={conf:.2f}",
                )
                bump(
                    "leaf_spot_disease",
                    conf * 70,
                    f"plant#{pid} diseased_generic",
                )

        if label == "nutrient_deficient":
            bump(
                "abnormal_color_nutrient",
                conf * 100,
                f"plant#{pid} label=nutrient_deficient conf={conf:.2f}",
            )

        if label == "stressed":
            bump(
                "plant_stress",
                conf * 100,
                f"plant#{pid} label=stressed conf={conf:.2f}",
            )

        yellow = float(details.get("yellow_ratio") or 0)
        if yellow > 0.2:
            bump(
                "abnormal_color_nutrient",
                min(95, 40 + yellow * 100),
                f"plant#{pid} yellow_ratio={yellow:.2f}",
            )

    messages = {
        "fungal_infection": "Probabilidad de {p}% de infección fúngica",
        "abnormal_color_nutrient": (
            "Probabilidad de {p}% de color anormal o deficiencia nutricional"
        ),
        "leaf_spot_disease": "Probabilidad de {p}% de manchas patológicas",
        "plant_stress": "Probabilidad de {p}% de estrés hídrico o ambiental",
    }

    actions_map = {
        "fungal_infection": [
            {"action": "inspect_leaves", "reason": "fungal_or_spot"},
            {"action": "improve_airflow_humidity", "reason": "fungal_infection"},
        ],
        "leaf_spot_disease": [
            {"action": "inspect_leaves", "reason": "fungal_or_spot"},
        ],
        "abnormal_color_nutrient": [
            {"action": "check_nutrients_ec_ph", "reason": "abnormal_color"},
        ],
        "plant_stress": [
            {"action": "check_irrigation_and_temp", "reason": "plant_stress"},
        ],
    }

    hypotheses: list[dict[str, Any]] = []
    seen_actions: set[str] = set()
    for hid, score in sorted(hyp_scores.items(), key=lambda x: -x[1]):
        p = _clamp_pct(score)
        if p < 25:
            continue
        hypotheses.append(
            {
                "id": hid,
                "probability": p,
                "message": messages[hid].format(p=p),
                "evidence": hyp_evidence.get(hid, [])[:6],
            }
        )
        for act in actions_map.get(hid, []):
            key = act["action"]
            if key not in seen_actions:
                suggested.append(act)
                seen_actions.add(key)

    total = int(summary.get("total_plants") or 0)
    healthy = int(summary.get("healthy_count") or 0)
    avg = float(summary.get("avg_health_score") or 0)

    if hypotheses:
        status, status_label = "attention", "Atención"
    elif total == 0:
        status, status_label = "unknown", "Sin plantas"
    elif healthy == total and avg >= 0.7:
        status, status_label = "ok", "Normal"
    else:
        status, status_label = "ok", "Normal"

    return {
        "at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "statusLabel": status_label,
        "hypotheses": hypotheses,
        "suggestedActions": suggested,
    }


def to_mqtt_plants_payload(
    analysis: dict[str, Any],
    assessment: dict[str, Any] | None,
) -> dict[str, Any]:
    summary = analysis.get("summary") or {}
    plants = analysis.get("plants") or []
    findings = [
        {
            "id": p.get("id"),
            "label": (p.get("health") or {}).get("label"),
            "confidence": (p.get("health") or {}).get("confidence"),
            "bbox": p.get("bbox"),
        }
        for p in plants
    ]

    status_label = (assessment or {}).get("statusLabel") or (
        "Saludables" if summary.get("healthy_count") == summary.get("total_plants") else "Atención"
    )

    body: dict[str, Any] = {
        "count": summary.get("total_plants", 0),
        "status": status_label,
        "healthMethod": summary.get("health_method"),
        "avgHealthScore": summary.get("avg_health_score"),
        "cameraStatus": "ok",
        "findings": findings,
    }
    if assessment is not None:
        body["assessment"] = assessment
    return body
