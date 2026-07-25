#include "turbidity_sensor.h"
#include "../config.h"

#include <math.h>

// ── ADC ──
// El módulo suele alimentarse a 5 V y AO puede llegar ~4.5 V. El ADC1 del
// ESP32 solo tolera ~3.3 V: usa un divisor de voltaje en AO → PIN_TURB
// (p. ej. 1 kΩ + 2 kΩ → ratio 1.5) y ajusta DIVIDER_RATIO abajo.
static const float ADC_VREF       = 3.3f;
static const int   ADC_MAX        = 4095;
static const int   ADC_SAMPLES    = 9;     // mediana (impar)
static const float DIVIDER_RATIO  = 1.5f;  // V_ao = V_adc * ratio; 1.0 si no hay divisor

// ── Calibración NTU ─────────────────────────────────────────────────────────
// Curva DFRobot SEN0189 (wiki): para V_ao ≤ 4.2 V
//   NTU = -1120.4·V² + 5742.3·V − 4353.8
//   V_ao > 4.2 V → ~0 NTU (agua clara)
// La fórmula asume la tensión en el pin AO del módulo (referencia ~5 V), NO
// la tensión cruda del ADC. Por eso se reconstruye V_ao con DIVIDER_RATIO.
//
// IMPORTANTE: es una aproximación de fábrica. Calibra en campo con agua clara
// y una suspensión conocida; ajusta NTU_A/B/C, CLEAR_VOLTAGE o DIVIDER_RATIO.
static const float NTU_A          = -1120.4f;
static const float NTU_B          =  5742.3f;
static const float NTU_C          = -4353.8f;
static const float CLEAR_VOLTAGE  = 4.2f;    // V_ao ≥ esto → 0 NTU
static const float NTU_CLAMP_MAX  = 3000.0f;

// Escala del gauge: 100 % = agua perfectamente clara (0 NTU).
static const float NTU_SCALE_MAX  = 300.0f;  // ≥ esto → percent = 0

// Umbrales acuapónicos (agua turbia = malo para peces / UV / filtros).
static const float NTU_OK_MAX     = 25.0f;   // < 25 → ok
static const float NTU_WARN_MAX   = 100.0f;  // 25–100 → warn; > 100 → critical

static void sortFloats(float* a, int n) {
  for (int i = 1; i < n; i++) {
    float key = a[i];
    int j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
  }
}

// Voltaje AO del módulo → NTU (cuadrática DFRobot + clamp).
static float voltageToNtu(float vAo) {
  if (vAo >= CLEAR_VOLTAGE) return 0.0f;

  float ntu = NTU_A * vAo * vAo + NTU_B * vAo + NTU_C;
  if (ntu < 0.0f)           ntu = 0.0f;
  if (ntu > NTU_CLAMP_MAX)  ntu = NTU_CLAMP_MAX;
  return ntu;
}

// Claridad 0–100 (100 = cristalina).
static int computePercent(float ntu) {
  float p = 100.0f * (1.0f - ntu / NTU_SCALE_MAX);
  if (p < 0)   p = 0;
  if (p > 100) p = 100;
  return (int)(p + 0.5f);
}

static const char* computeStatus(float ntu) {
  if (ntu < NTU_OK_MAX)   return "ok";
  if (ntu < NTU_WARN_MAX) return "warn";
  return "critical";
}

void turbidity_begin() {
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  Serial.printf("[TURB] Turbidez en GPIO %d (AO + divisor ratio=%.2f)\n",
                PIN_TURB, DIVIDER_RATIO);
}

Reading turbidity_read() {
  float samplesMv[ADC_SAMPLES];
  for (int i = 0; i < ADC_SAMPLES; i++) {
    // analogReadMilliVolts mejora la linealidad frente a (adc * 3.3 / 4095).
    samplesMv[i] = (float)analogReadMilliVolts(PIN_TURB);
    delay(2);
  }
  sortFloats(samplesMv, ADC_SAMPLES);
  float mvAdc = samplesMv[ADC_SAMPLES / 2];  // mediana
  int   adc   = (int)((mvAdc / 1000.0f) * ADC_MAX / ADC_VREF + 0.5f);

  // Desconectado / saturado (cable suelto o AO > 3.3 V sin divisor).
  if (mvAdc < 20.0f || mvAdc > 3250.0f || adc <= 5 || adc >= ADC_MAX - 5) {
    Serial.printf("[TURB] Lectura inválida (ADC≈%d  mV=%.0f)\n", adc, mvAdc);
    return { NAN, 0, "critical", false };
  }

  float vAdc = mvAdc / 1000.0f;
  float vAo  = vAdc * DIVIDER_RATIO;
  float ntu  = voltageToNtu(vAo);
  float rounded = roundf(ntu * 10.0f) / 10.0f;  // 0.1 NTU

  Serial.printf("[TURB] ADC≈%d  Vadc=%.3f  Vao=%.3f  NTU=%.1f\n",
                adc, vAdc, vAo, rounded);

  return { rounded, computePercent(ntu), computeStatus(ntu), true };
}
