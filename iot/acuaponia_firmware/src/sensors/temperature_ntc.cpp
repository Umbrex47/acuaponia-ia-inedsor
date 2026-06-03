#include "temperature_ntc.h"
#include "../config.h"

#include <math.h>

// ── Calibración del termistor NTC (módulo tipo KY-028) ──
// Punto de calibración tomado en campo: R ≈ 1287 Ω a 20 °C.
static const float ADC_VREF        = 3.3f;
static const int   ADC_MAX         = 4095;
static const int   ADC_SAMPLES     = 16;       // promediado anti-ruido

static const float NTC_SERIES_R    = 10000.0f; // resistencia fija del divisor (Ω)
static const float NTC_NOMINAL_R   = 1287.0f;  // R medido a la temp. de referencia
static const float NTC_NOMINAL_T   = 20.0f;    // °C de referencia
static const float NTC_BETA        = 3950.0f;  // coeficiente Beta
static const bool  NTC_ON_HIGH_SIDE = false;   // true: NTC a VCC; false: NTC a GND

// ── Rango ideal para tilapia (para % y estado) ──
static const float T_SCALE_MIN = 15.0f, T_SCALE_MAX = 35.0f;  // mapeo del gauge
static const float T_OK_MIN    = 24.0f, T_OK_MAX    = 30.0f;
static const float T_WARN_MIN  = 20.0f, T_WARN_MAX  = 33.0f;

void ntc_begin() {
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);   // rango completo ~0–3.3 V
  Serial.printf("[NTC] Termistor en GPIO %d\n", PIN_TEMP);
}

static int computePercent(float t) {
  float p = (t - T_SCALE_MIN) / (T_SCALE_MAX - T_SCALE_MIN) * 100.0f;
  if (p < 0)   p = 0;
  if (p > 100) p = 100;
  return (int)(p + 0.5f);
}

static const char* computeStatus(float t) {
  if (t >= T_OK_MIN   && t <= T_OK_MAX)   return "ok";
  if (t >= T_WARN_MIN && t <= T_WARN_MAX) return "warn";
  return "critical";
}

Reading ntc_read() {
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_TEMP);
    delay(2);
  }
  int adc = sum / ADC_SAMPLES;

  // ADC pegado a los extremos → sensor abierto/en corto o ADC2 con WiFi.
  if (adc <= 5 || adc >= ADC_MAX - 5) {
    Serial.printf("[NTC] Lectura inválida (ADC=%d)\n", adc);
    return { NAN, 0, "critical", false };
  }

  float vOut = (adc * ADC_VREF) / ADC_MAX;
  float rNtc = NTC_ON_HIGH_SIDE
      ? NTC_SERIES_R * (ADC_VREF / vOut - 1.0f)   // NTC entre VCC y AO
      : NTC_SERIES_R * (vOut / (ADC_VREF - vOut)); // NTC entre AO y GND

  // Ecuación Beta: 1/T = 1/T0 + (1/B)·ln(R/R0)
  float t0   = NTC_NOMINAL_T + 273.15f;
  float invT = 1.0f / t0 + (1.0f / NTC_BETA) * logf(rNtc / NTC_NOMINAL_R);
  float tempC = 1.0f / invT - 273.15f;

  Serial.printf("[NTC] ADC=%d  V=%.3f  R=%.0f  T=%.2f°C\n",
                adc, vOut, rNtc, tempC);

  float rounded = roundf(tempC * 10.0f) / 10.0f;
  return { rounded, computePercent(tempC), computeStatus(tempC), true };
}
