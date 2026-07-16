"""Wrapper del pipeline plant-detection + assessment MQTT."""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

PLANT_DET_ROOT = Path(__file__).resolve().parents[2] / "plant-detection"
if str(PLANT_DET_ROOT) not in sys.path:
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
        from src.assessment import build_plant_assessment, to_mqtt_plants_payload
        from src.config import load_config
        from src.pipeline import PlantAnalysisPipeline

        self._build_assessment = build_plant_assessment
        self._to_mqtt = to_mqtt_plants_payload

        cfg = load_config(config_path) if config_path else load_config()
        if model_path is not None:
            cfg = {**cfg, "health": {**cfg.get("health", {}), "model_path": str(model_path)}}
            # PlantAnalysisPipeline reads relative to plant-detection ROOT
        self.pipeline = PlantAnalysisPipeline(cfg)
        # Override model path if absolute file provided
        if model_path and model_path.exists():
            from src.models.health import HealthClassifier

            health_cfg = cfg.get("health", {})
            self.pipeline.health_classifier = HealthClassifier(
                model_path,
                input_size=health_cfg.get("input_size", 224),
                fallback_heuristics=health_cfg.get("fallback_heuristics", True),
            )

        self.assess_interval_sec = assess_interval_sec
        self._last_assess_at = 0.0
        self._started_at = time.monotonic()

    def process(self, frame: np.ndarray) -> PlantFrameResult:
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
