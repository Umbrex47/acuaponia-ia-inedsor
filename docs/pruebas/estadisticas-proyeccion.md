# Números que esperamos obtener en la vida real (peces y plantas)

> **Aviso importante:** Estos números son **estimaciones**, no mediciones reales. Están basados en lo que sabemos de los modelos (qué tan buenos son) y en la configuración del sistema. Cuando tengamos los videos y fotos de la guía de "qué grabar", correremos las pruebas y estos números se volverán reales.

---

## A. Peces (cámara que cuenta y observa)

### A.1 ¿Qué tan bien cuenta y ve los peces?
El modelo de visión tiene una calidad conocida (mAP50 ≈ 0.77). En la pecera real esperamos esto:

| Qué miramos | En agua clara y pocos peces | En agua turbia o de noche |
|---|---|---|
| Acierto al ver un pez | 78% a 85% | 55% a 70% |
| De cada 100 peces, cuántos detecta | 74 a 82 | 50 a 68 |
| Error al contar | se equivoca por 1 pez | se equivoca por 3 a 5 peces |

**En resumen:** cuenta bien cuando el agua está clara y hay pocos peces. Se equivoca más si el agua está sucia, es de noche, o hay muchos peces juntos.

### A.2 Comportamiento (si están activos o en la superficie)
La IA mira el movimiento y si suben a la superficie:
- Si los peces apenas se mueven → avisa "poco movimiento".
- Si muchos suben a la superficie → avisa "puede faltar oxígeno o comida".
- Si hay poco oxígeno de verdad (menos de 4 mg/L), la IA acierta un **70% a 85%** de las veces.
- Si la temperatura o el pH están mal, la IA acierta un **65% a 80%** de las veces.

### A.3 Alerta y sensores
Rangos buenos (del documento del colegio): oxígeno 4–8, temperatura 24–30 °C, pH 6–7, turbidez 0–25.
- La alerta por correo llega en **menos de 90 segundos**.
- Se espera que la alerta sea correcta al menos el **75%** de las veces.

---

## B. Plantas (mangle rojo)

### B.1 ¿La planta está sana?
- **Sin entrenar (modo simple):** acierta un **60% a 72%** (se confunde con la luz).
- **Con el modelo entrenado (EfficientNet):** acierta un **85% a 92%**.

| Estado de la planta | Cuántas esperamos que reconozca bien (modelo entrenado) |
|---|---|
| Sana | 90% a 95% |
| Estrés | 80% a 88% |
| Enferma | 82% a 90% |
| Falta de nutrientes | 78% a 86% |

### B.2 Crecimiento y tamaño
- La cámara dice en qué etapa está (plántula, creciendo, floración).
- Si calibramos con el objeto de medida, el tamaño de hoja sale con **menos del 10% de error**.
- Un "puntaje de salud" (0 a 1) resume qué tan bien está la planta.

### B.3 El "puntaje de simbiosis" (todo junto)
Juntamos: salud de planta + comportamiento de peces + sensores del agua. Ese número dice si el cultivo está equilibrado:
- **Cultivo equilibrado:** 0.80 a 0.92 (todo bien).
- **Cultivo en problemas:** 0.45 a 0.65 (poca agua oxigenada + peces en superficie + planta amarilla) → el sistema avisa.

---

## C. Para el reporte
- Los peces se cuentan bien en agua clara; hay que entrenar más para agua turbia/noche.
- El comportamiento sirve como alerta temprana si lo cruzamos con los sensores.
- Las plantas: de ~65% (simple) a ~88% (entrenado). El tamaño calibrado da medida real.
- Lo más útil es **juntar las 3 fuentes** (peces + plantas + sensores) en un solo indicador de equilibrio.
