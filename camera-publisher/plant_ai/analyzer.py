"""Wrapper del pipeline plant-detection + AquaGia Vision + assessment MQTT."""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

CAMERA_PUB_ROOT = Path(__file__).resolve().parent
AQUAGIA_VISION_ROOT = Path(__file__).resolve().parents[2] / "aquagia-vision"
PLANT_DET_ROOT = Path(__file__).resolve().parents[2] / "plant-detection"

if str(AQUAGIA_VISION_ROOT) not in sys.path and AQUAGIA_VISION_ROOT.exists():
    sys.path.insert(0, str(AQUAGIA_VISION_ROOT))
if str(PLANT_DET_ROOT) not in sys.path and PLANT_DET_ROOT.exists():
    sys.path.insert(0, str(PLANT_DET_ROOT))


@dataclass
class PlantFrameResult:
    count: int
    status: str
    health_method: str | None
    avg_health_score: float | None
    findings: list[dict[str, Any]]
    assessment: dict[str, Any] | None
    annotated: Any = None  # np.ndarray | None
    raw: dict[str, Any] = field(default_factory=dict)


class PlantAnalyzer:
    def __init__(
        self,
        model_path: Path | None = None,
        assess_interval_sec: float = 90.0,
        config_path: Path | None = None,
    ):
        self.assess_interval_sec = assess_interval_sec
        self._last_assess_at = 0.0
        self._started_at = time.monotonic()
        self.use_aquagia_vision = False
        self.aquagia_pipeline = None

        # Intentar cargar AquaGia Vision prioritariamente
        if AQUAGIA_VISION_ROOT.exists():
            try:
                from config import load_config as load_aq_cfg
                from pipeline import AquaGiaVisionPipeline

                aq_cfg = load_aq_cfg()
                self.aquagia_pipeline = AquaGiaVisionPipeline(aq_cfg)
                self.use_aquagia_vision = True
            except Exception as e:
                pass

        # Fallback al pipeline anterior si no estuviera disponible
        if not self.use_aquagia_vision:
            from src.assessment import build_plant_assessment, to_mqtt_plants_payload
            from src.config import load_config
            from src.pipeline import PlantAnalysisPipeline

            self._build_assessment = build_plant_assessment
            self._to_mqtt = to_mqtt_plants_payload

            cfg = load_config(config_path) if config_path else load_config()
            if model_path is not None:
                cfg = {**cfg, "health": {**cfg.get("health", {}), "model_path": str(model_path)}}
            self.pipeline = PlantAnalysisPipeline(cfg)

            if model_path and model_path.exists():
                from src.models.health import HealthClassifier

                health_cfg = cfg.get("health", {})
                self.pipeline.health_classifier = HealthClassifier(
                    model_path,
                    input_size=health_cfg.get("input_size", 224),
                    fallback_heuristics=health_cfg.get("fallback_heuristics", True),
                )

    def process(self, frame: np.ndarray) -> PlantFrameResult:
        if self.use_aquagia_vision and self.aquagia_pipeline is not None:
            return self._process_aquagia_vision(frame)
        return self._process_legacy(frame)

    def _process_aquagia_vision(self, frame: np.ndarray) -> PlantFrameResult:
        analysis = self.aquagia_pipeline.analyze(frame, persist=True)
        summary = analysis.get("summary", {})
        plants = analysis.get("plants", [])

        # Construir assessment para AquaGia OS (compatibilidad con alertas de correo)
        now = time.monotonic()
        warmed = (now - self._started_at) >= 15.0
        assessment = None

        hypotheses = []
        suggested_actions = []

        for p in plants:
            for rec in p.get("recommendations", []):
                suggested_actions.append({"action": rec["action"], "reason": rec["reason"]})
            for factor in p.get("factors", []):
                if "Clorosis" in factor:
                    hypotheses.append({
                        "id": "abnormal_color_nutrient",
                        "probability": p.get("yellow_coverage_pct", 50),
                        "message": f"Clorosis foliar en {p['plant_id']}",
                        "evidence": [f"{p['plant_id']}: {factor}"],
                    })
                elif "Pardeamiento" in factor or "necrosis" in factor.lower():
                    hypotheses.append({
                        "id": "leaf_spot_disease",
                        "probability": p.get("brown_coverage_pct", 50),
                        "message": f"Necrosis/daño foliar en {p['plant_id']}",
                        "evidence": [f"{p['plant_id']}: {factor}"],
                    })

        if warmed and (now - self._last_assess_at >= self.assess_interval_sec or hypotheses):
            self._last_assess_at = now
            status_label = "Atención" if hypotheses else "Normal"
            assessment = {
                "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "attention" if hypotheses else "ok",
                "statusLabel": status_label,
                "hypotheses": hypotheses,
                "suggestedActions": suggested_actions,
            }

        # Formato de hallazgos individuales para compatibilidad
        findings = [
            {
                "id": p["plant_id"],
                "label": p["status"],
                "confidence": p["health_score"],
                "bbox": p["bbox_px"],
                "areaCm2": p["area_cm2"],
                "greenCoveragePct": p["green_coverage_pct"],
                "growthRatePctPerDay": p["growth_rate_pct_per_day"],
                "leafCount": p["leaf_count"],
            }
            for p in plants
        ]

        raw_mqtt = {
            "count": summary.get("total_plants", len(plants)),
            "status": "Saludables" if summary.get("healthy_count") == summary.get("total_plants") else "Atención",
            "healthMethod": f"aquagia_vision_{self.aquagia_pipeline.mode}",
            "avgHealthScore": summary.get("avg_health_score", 1.0),
            "cameraStatus": "ok",
            "findings": findings,
            "individual": plants,  # Telemetría enriquecida individual
        }
        if assessment:
            raw_mqtt["assessment"] = assessment

        annotated = self.aquagia_pipeline.get_last_annotated_frame()
        if annotated is None:
            annotated = frame

        return PlantFrameResult(
            count=int(raw_mqtt["count"]),
            status=str(raw_mqtt["status"]),
            health_method=raw_mqtt["healthMethod"],
            avg_health_score=raw_mqtt["avgHealthScore"],
            findings=findings,
            assessment=assessment,
            annotated=annotated,
            raw=raw_mqtt,
        )

    def _process_legacy(self, frame: np.ndarray) -> PlantFrameResult:
        analysis = self.pipeline.analyze(frame)
        now = time.monotonic()
        warmed = (now - self._started_at) >= 15.0
        assessment = None
        if warmed and now - self._last_assess_at >= self.assess_interval_sec:
            self._last_assess_at = now
            assessment = self._build_assessment(analysis)

        mqtt_body = self._to_mqtt(analysis, assessment)
        annotated = self.pipeline.draw_annotations(frame, analysis)

        return PlantFrameResult(
            count=int(mqtt_body.get("count") or 0),
            status=str(mqtt_body.get("status") or "—"),
            health_method=mqtt_body.get("healthMethod"),
            avg_health_score=mqtt_body.get("avgHealthScore"),
            findings=list(mqtt_body.get("findings") or []),
            assessment=assessment,
            annotated=annotated,
            raw=mqtt_body,
        )
