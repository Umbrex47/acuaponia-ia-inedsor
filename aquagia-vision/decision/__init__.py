"""Módulo de decisión desacoplado y generación de recomendaciones."""

from decision.rules import evaluate_rules
from decision.model import DecisionEngine, DecisionResult

__all__ = ["evaluate_rules", "DecisionEngine", "DecisionResult"]
