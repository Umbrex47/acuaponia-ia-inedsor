"""Reglas deterministas que correlacionan visión, historial y sensores acuapónicos."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class RuleEvaluation:
    rule_id: str
    triggered: bool
    severity: str  # "info", "warning", "critical"
    message: str
    suggested_action: str
    factors: List[str]


def evaluate_rules(
    plant_obs: Dict[str, Any],
    sensor_reading: Optional[Dict[str, Any]] = None,
) -> List[RuleEvaluation]:
    """Evalúa reglas de causa-raíz desacopladas del procesamiento visual."""
    evaluations: List[RuleEvaluation] = []
    sensors = sensor_reading or {}

    plant_id = plant_obs.get("plant_id", "PXX")
    yellow_ratio = float(plant_obs.get("yellow_ratio", 0.0))
    brown_ratio = float(plant_obs.get("brown_ratio", 0.0))
    growth_pct = float(plant_obs.get("growth_percent", 0.0))
    status = plant_obs.get("status", "normal")

    ph = sensors.get("ph")
    ec = sensors.get("ec")
    temp_air = sensors.get("temperature_air")
    temp_water = sensors.get("temperature")
    humidity = sensors.get("humidity")
    oxygen = sensors.get("oxygen")

    # Regla 1: Clorosis + pH alto o EC baja (Bloqueo de hierro / nutrientes)
    if yellow_ratio > 0.14:
        factors = [f"Clorosis foliar detectada ({int(yellow_ratio * 100)}%)"]
        severity = "warning"
        if ph is not None and ph > 7.2:
            factors.append(f"pH elevado ({ph:.1f} > 7.2)")
            severity = "critical"
            msg = f"Posible deficiencia o bloqueo de asimilación de hierro/nutrientes en {plant_id}."
            act = "Ajustar pH hacia 6.2–6.8 y verificar quelato de hierro en el agua."
        elif ec is not None and ec < 0.8:
            factors.append(f"EC baja ({ec:.2f} < 0.8 mS/cm)")
            msg = f"Deficiencia nutricional generalizada en {plant_id} por baja concentración de sales minerales."
            act = "Aumentar suplementación de sales minerales (K, Ca, Mg) o tasa de alimentación de peces."
        else:
            msg = f"Amarillamiento foliar anormal en {plant_id}."
            act = "Monitorear parámetros fisicoquímicos del agua y revisar nutrición foliar."

        evaluations.append(
            RuleEvaluation(
                rule_id="nutrient_chlorosis",
                triggered=True,
                severity=severity,
                message=msg,
                suggested_action=act,
                factors=factors,
            )
        )

    # Regla 2: Necrosis + Alta humedad (Infección fúngica / patógeno)
    if brown_ratio > 0.08:
        factors = [f"Tejido vegetal necrótico ({int(brown_ratio * 100)}%)"]
        severity = "warning"
        if humidity is not None and humidity > 78.0:
            factors.append(f"Humedad ambiental alta ({humidity:.1f}%)")
            severity = "critical"
            msg = f"Riesgo de infección fúngica o bacteriana foliar en {plant_id}."
            act = "Incrementar ventilación del cultivo, separar follaje denso y podar hojas infectadas."
        else:
            msg = f"Manchas patológicas o daño tisular en {plant_id}."
            act = "Inspeccionar hojas de cerca y verificar ausencia de plagas o salpicaduras directas."

        evaluations.append(
            RuleEvaluation(
                rule_id="fungal_necrosis_risk",
                triggered=True,
                severity=severity,
                message=msg,
                suggested_action=act,
                factors=factors,
            )
        )

    # Regla 3: Caída drástica de área + Estrés térmico/hídrico
    if growth_pct < -3.0:
        factors = [f"Reducción de cobertura vegetal ({growth_pct:.1f}%)"]
        severity = "critical"
        if temp_air is not None and temp_air > 28.5:
            factors.append(f"Temperatura ambiente excesiva ({temp_air:.1f}°C)")
            msg = f"Estrés térmico y marchitez foliar aguda en {plant_id}."
            act = "Desplegar malla sombra y asegurar flujo continuo de agua fresca en la cama."
        elif temp_water is not None and temp_water > 27.0:
            factors.append(f"Temperatura alta de agua radicular ({temp_water:.1f}°C)")
            msg = f"Marchitez por sobrecalentamiento del agua en {plant_id}."
            act = "Verificar enfriamiento del tanque y aireación."
        else:
            msg = f"Contracción foliar o marchitez en {plant_id}."
            act = "Revisar flujo de sifón o canal NFT y verificar que las raíces reciban agua suficiente."

        evaluations.append(
            RuleEvaluation(
                rule_id="acute_wilting_stress",
                triggered=True,
                severity=severity,
                message=msg,
                suggested_action=act,
                factors=factors,
            )
        )

    # Regla 4: Oxígeno disuelto crítico + estado no saludable
    if oxygen is not None and oxygen < 4.5 and status != "normal":
        evaluations.append(
            RuleEvaluation(
                rule_id="hypoxia_root_stress",
                triggered=True,
                severity="critical",
                message=f"Hipoxia radicular afectando {plant_id} (O₂ disuelto: {oxygen:.1f} mg/L).",
                suggested_action="Activar compresor/difusores de aire de respaldo inmediatamente.",
                factors=[f"O₂ < 4.5 mg/L ({oxygen:.1f})"],
            )
        )

    return evaluations
