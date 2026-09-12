"""Gestor de historial temporal e informes por planta individual."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from database.models import PlantObservation
from database.repository import VisionRepository


class PlantHistoryManager:
    """Gestiona el historial de evolución temporal y evolución biométrica."""

    def __init__(self, repository: VisionRepository):
        self.repo = repository

    def get_latest_observation(self, plant_id: str) -> Optional[PlantObservation]:
        return self.repo.get_latest_observation(plant_id)

    def get_evolution(self, plant_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        observations = self.repo.get_plant_history(plant_id, limit=limit)
        return [obs.to_dict() for obs in observations]

    def get_summary_card(self, plant_id: str) -> Dict[str, Any]:
        obs = self.get_latest_observation(plant_id)
        if not obs:
            return {
                "plant_id": plant_id,
                "status": "desconocido",
                "area_cm2": 0.0,
                "green_coverage_pct": 0,
                "growth_rate_pct_per_day": 0.0,
                "leaf_count": 0,
                "health_score": 0.0,
                "last_update": "N/A",
            }

        # Formato ISO a hora legible
        try:
            dt = datetime.fromisoformat(obs.timestamp)
            time_str = dt.strftime("%H:%M")
        except Exception:
            time_str = obs.timestamp

        return {
            "plant_id": plant_id,
            "status": obs.status,
            "area_cm2": obs.area_cm2,
            "green_coverage_pct": int(round(obs.green_ratio * 100)),
            "growth_rate_pct_per_day": obs.growth_percent,
            "growth_rate_cm2_per_day": obs.growth_rate,
            "leaf_count": obs.leaf_count,
            "health_score": obs.health_score,
            "anomaly_score": obs.anomaly_score,
            "last_update": time_str,
            "last_update_iso": obs.timestamp,
        }

    def format_text_tree(self, plant_id: str) -> str:
        """Formatea la ficha de la planta según la especificación del requerimiento."""
        card = self.get_summary_card(plant_id)
        growth_sign = "+" if card["growth_rate_pct_per_day"] >= 0 else ""
        growth_str = f"{growth_sign}{card['growth_rate_pct_per_day']:.1f} %/día"

        status_text = {
            "normal": "saludable",
            "atencion": "atención",
            "estres": "posible estrés",
            "anomalia": "anomalía crítica",
        }.get(card["status"], card["status"])

        return (
            f"PLANTA {plant_id}\n"
            f"├── Estado: {status_text}\n"
            f"├── Área vegetal: {card['area_cm2']} cm²\n"
            f"├── Cobertura verde: {card['green_coverage_pct']} %\n"
            f"├── Crecimiento: {growth_str}\n"
            f"├── Número de hojas: {card['leaf_count']}\n"
            f"└── Última actualización: {card['last_update']}"
        )
