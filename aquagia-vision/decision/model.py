"""Motor de decisión que coordina reglas y persiste alertas accionables."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from database.models import PlantAlert
from database.repository import VisionRepository
from decision.rules import RuleEvaluation, evaluate_rules


@dataclass
class DecisionResult:
    plant_id: str
    status: str
    health_score: float
    has_alert: bool
    evaluations: List[RuleEvaluation]
    recommended_actions: List[Dict[str, str]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plant_id": self.plant_id,
            "status": self.status,
            "health_score": self.health_score,
            "has_alert": self.has_alert,
            "evaluations": [
                {
                    "rule_id": e.rule_id,
                    "severity": e.severity,
                    "message": e.message,
                    "suggested_action": e.suggested_action,
                    "factors": e.factors,
                }
                for e in self.evaluations
            ],
            "recommended_actions": self.recommended_actions,
        }


class DecisionEngine:
    """Evalúa diagnósticos integrales y genera acciones recomendadas desacopladas."""

    def __init__(self, repository: VisionRepository):
        self.repo = repository

    def analyze_plant(
        self,
        plant_obs: Dict[str, Any],
        sensor_data: Optional[Dict[str, Any]] = None,
        persist_alerts: bool = True,
    ) -> DecisionResult:
        evaluations = evaluate_rules(plant_obs, sensor_data)
        plant_id = plant_obs.get("plant_id", "PXX")
        status = plant_obs.get("status", "normal")
        health_score = float(plant_obs.get("health_score", 1.0))

        recommended: List[Dict[str, str]] = []
        for ev in evaluations:
            if ev.suggested_action:
                recommended.append(
                    {
                        "action": ev.suggested_action,
                        "reason": ev.message,
                        "severity": ev.severity,
                    }
                )

            if persist_alerts:
                alert = PlantAlert(
                    plant_id=plant_id,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    severity=ev.severity,
                    rule_id=ev.rule_id,
                    message=ev.message,
                    suggested_action=ev.suggested_action,
                    resolved=False,
                )
                self.repo.add_alert(alert)

        return DecisionResult(
            plant_id=plant_id,
            status=status,
            health_score=health_score,
            has_alert=len(evaluations) > 0,
            evaluations=evaluations,
            recommended_actions=recommended,
        )

    def analyze_all(
        self,
        observations: List[Dict[str, Any]],
        sensor_data: Optional[Dict[str, Any]] = None,
    ) -> List[DecisionResult]:
        return [self.analyze_plant(obs, sensor_data) for obs in observations]
