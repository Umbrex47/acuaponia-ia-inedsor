"""Modelos de datos para SQLite de AquaGia Vision."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def utcnow_str() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Plant:
    id: str  # Ej: "P01"
    species: str = "Lactuca sativa"
    position: str = "ROI_01"  # "ROI_01" o coordenadas JSON
    created_at: str = field(default_factory=utcnow_str)
    status: str = "normal"  # "normal", "atencion", "estres", "anomalia"
    roi_bbox: Optional[List[float]] = None  # [x, y, w, h] en valores normalizados

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlantObservation:
    id: Optional[int] = None
    plant_id: str = "P01"
    timestamp: str = field(default_factory=utcnow_str)
    area: float = 0.0  # px
    area_cm2: float = 0.0  # cm² calibrado
    green_ratio: float = 0.0  # [0.0, 1.0]
    yellow_ratio: float = 0.0  # clorosis [0.0, 1.0]
    brown_ratio: float = 0.0  # necrosis [0.0, 1.0]
    mean_hue: float = 0.0  # Tono medio HSV (0-179)
    mean_saturation: float = 0.0  # Saturación media (0-255)
    leaf_count: int = 0  # Hojas estimadas
    growth_rate: float = 0.0  # cm²/día
    growth_percent: float = 0.0  # % de crecimiento respecto a observación anterior
    health_score: float = 1.0  # [0.0, 1.0]
    anomaly_score: float = 0.0  # [0.0, 1.0]
    status: str = "normal"
    extra_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SensorReading:
    id: Optional[int] = None
    timestamp: str = field(default_factory=utcnow_str)
    temperature: Optional[float] = None  # Agua (°C)
    temperature_air: Optional[float] = None  # Ambiente (°C)
    humidity: Optional[float] = None  # % humedad relativa
    ph: Optional[float] = None
    ec: Optional[float] = None  # mS/cm
    water_level: Optional[float] = None  # cm
    oxygen: Optional[float] = None  # mg/L O2 disuelto

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlantAlert:
    id: Optional[int] = None
    plant_id: str = "P01"
    timestamp: str = field(default_factory=utcnow_str)
    severity: str = "warning"  # "info", "warning", "critical"
    rule_id: str = "unknown"
    message: str = ""
    suggested_action: str = ""
    resolved: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
