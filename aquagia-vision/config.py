"""Configuración de AquaGia Vision."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

import yaml

ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = ROOT / "config" / "config.yaml"


def load_config(path: Path | str | None = None) -> Dict[str, Any]:
    cfg_path = Path(path) if path else DEFAULT_CONFIG_PATH
    if not cfg_path.exists():
        return _get_default_config()

    with open(cfg_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    # Fusionar con valores por defecto para claves faltantes
    defaults = _get_default_config()
    return _deep_merge(defaults, data)


def _deep_merge(base: dict, override: dict) -> dict:
    merged = base.copy()
    for k, v in override.items():
        if k in merged and isinstance(merged[k], dict) and isinstance(v, dict):
            merged[k] = _deep_merge(merged[k], v)
        else:
            merged[k] = v
    return merged


def _get_default_config() -> Dict[str, Any]:
    return {
        "system": {
            "name": "AquaGia Vision",
            "version": "1.0.0",
            "mode": "fixed",
            "bed_id": "cama_01",
        },
        "camera": {
            "source": 0,
            "width": 1280,
            "height": 720,
            "px_to_cm2": 0.015,
        },
        "scheduler": {
            "day_interval_sec": 30,
            "night_interval_sec": 300,
            "day_start_hour": 6,
            "night_start_hour": 20,
            "change_detection_enabled": True,
            "change_threshold_pct": 3.0,
        },
        "grid": {
            "rows": 3,
            "cols": 3,
            "prefix": "P",
            "margin_x_ratio": 0.04,
            "margin_y_ratio": 0.04,
            "custom_rois_file": "config/default_rois.json",
        },
        "segmentation": {
            "exg_threshold": None,
            "min_area_px": 300,
            "morph_kernel_size": 5,
            "morph_iterations": 2,
        },
        "analysis": {
            "chlorosis_hue_min": 20,
            "chlorosis_hue_max": 35,
            "necrosis_brown_threshold": 0.12,
            "healthy_green_ratio_threshold": 0.65,
        },
        "yolo": {
            "model_path": "models/yolov8n_plants.pt",
            "conf_threshold": 0.35,
            "iou_threshold": 0.45,
            "tracker_max_disappeared": 10,
        },
        "database": {
            "db_path": "data/aquagia_vision.db",
        },
        "api": {
            "host": "0.0.0.0",
            "port": 8000,
            "cors_origins": ["*"],
        },
        "mqtt": {
            "enabled": False,
            "host": "localhost",
            "port": 1883,
            "topic_telemetry": "aquaponic/plants/telemetry",
            "topic_individual": "aquaponic/plants/individual",
        },
    }
