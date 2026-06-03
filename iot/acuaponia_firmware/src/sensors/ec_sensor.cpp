#include "ec_sensor.h"
#include "../config.h"

#include <math.h>

// ── ADC ──
static const float ADC_VREF    = 3.3f;
static const int   ADC_MAX     = 4095;
static const int   ADC_SAMPLES = 16;

// ── Escala del dashboard (mS/cm) ──
static const float EC_SCALE_MIN = 0.0f, EC_SCALE_MAX = 3.0f;
static const float EC_OK_MIN    = 0.8f, EC_OK_MAX    = 2.0f;
static const float EC_WARN_MIN  = 0.5f, EC_WARN_MAX  = 2.5f;

// Temperatura de referencia para compensación (ideal: leer del DS18B20).
static const float EC_REF_TEMP_C = 25.0f;

static int computePercent(float ec) {
  float p = (ec - EC_SCALE_MIN) / (EC_SCALE_MAX - EC_SCALE_MIN) * 100.0f;
  if (p < 0)   p = 0;
  if (p > 100) p = 100;
  return (int)(p + 0.5f);
}

static const char* computeStatus(float ec) {
  if (ec >= EC_OK_MIN   && ec <= EC_OK_MAX)   return "ok";
  if (ec >= EC_WARN_MIN && ec <= EC_WARN_MAX) return "warn";
  return "critical";
}

// Convierte voltaje (V) a EC en µS/cm con la curva del DFR0300 (DFRobot wiki).
static float voltageToEcUs(float voltage, float tempC) {
  float k = 1.0f + 0.0185f * (tempC - 25.0f);
  float v = voltage / k;
  return 133.42f * v * v * v - 255.86f * v * v + 857.39f * v;
}

void ec_begin() {
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  Serial.printf("[EC] Medidor en GPIO %d (DFRobot DFR0300)\n", PIN_EC);
}

Reading ec_read() {
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_EC);
    delay(2);
  }
  int adc = sum / ADC_SAMPLES;

  if (adc <= 5 || adc >= ADC_MAX - 5) {
    Serial.printf("[EC] Lectura inválida (ADC=%d)\n", adc);
    return { NAN, 0, "critical", false };
  }

  float voltage = (adc * ADC_VREF) / ADC_MAX;
  float ecUs    = voltageToEcUs(voltage, EC_REF_TEMP_C);
  float ecMs    = ecUs / 1000.0f;   // µS/cm → mS/cm (coincide con el dashboard)

  float rounded = roundf(ecMs * 100.0f) / 100.0f;
  Serial.printf("[EC] ADC=%d  V=%.3f  EC=%.2f mS/cm\n", adc, voltage, rounded);

  return { rounded, computePercent(ecMs), computeStatus(ecMs), true };
}
