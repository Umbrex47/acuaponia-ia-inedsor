#include "water_level_ultrasonic.h"
#include "../config.h"

#include <math.h>

// ── Medición ──
static const int   PULSE_SAMPLES   = 7;        // muestras por lectura (mediana)
static const unsigned long ECHO_TIMEOUT_US = 30000UL;  // ~5 m máx
static const float SOUND_CM_PER_US = 0.0343f;  // velocidad del sonido / 2

// Distancia total del sensor al fondo de la pecera (pecera vacía).
static const float DIST_SENSOR_TO_BOTTOM = SENSOR_OFFSET_CM + TANK_DEPTH_CM;

// ── Estado del nivel según % de llenado ──
static const float LEVEL_OK_PCT   = 75.0f;   // ≥ 75 % → ok
static const float LEVEL_WARN_PCT = 45.0f;   // 45–75 % → warn; < 45 % → critical

// Una medición individual de distancia (cm). Devuelve NAN si no hay eco.
static float readDistanceOnce() {
  digitalWrite(PIN_LEVEL_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_LEVEL_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_LEVEL_TRIG, LOW);

  unsigned long duration = pulseIn(PIN_LEVEL_ECHO, HIGH, ECHO_TIMEOUT_US);
  if (duration == 0) return NAN;            // sin eco / fuera de rango

  return duration * SOUND_CM_PER_US;
}

// Ordena un arreglo pequeño (insertion sort) para tomar la mediana.
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

void water_level_begin() {
  pinMode(PIN_LEVEL_TRIG, OUTPUT);
  pinMode(PIN_LEVEL_ECHO, INPUT);
  digitalWrite(PIN_LEVEL_TRIG, LOW);
  Serial.printf("[NIVEL] Ultrasónico Trig=%d Echo=%d · sensor a %.0f cm sobre "
                "pecera de %.0f cm (fondo a %.0f cm)\n",
                PIN_LEVEL_TRIG, PIN_LEVEL_ECHO, SENSOR_OFFSET_CM,
                TANK_DEPTH_CM, DIST_SENSOR_TO_BOTTOM);
}

Reading water_level_read() {
  float samples[PULSE_SAMPLES];
  int valid = 0;

  for (int i = 0; i < PULSE_SAMPLES; i++) {
    float d = readDistanceOnce();
    if (!isnan(d)) samples[valid++] = d;
    delay(40);   // el JSN-SR04T necesita separación entre disparos
  }

  if (valid == 0) {
    Serial.println("[NIVEL] Sin eco válido");
    return { NAN, 0, "critical", false };
  }

  sortFloats(samples, valid);
  float distance = samples[valid / 2];   // mediana (robusta a ruido)

  // Altura de la columna de agua = (sensor→fondo) − distancia a la superficie.
  float level = DIST_SENSOR_TO_BOTTOM - distance;
  if (level < 0.0f)            level = 0.0f;
  if (level > TANK_DEPTH_CM)   level = TANK_DEPTH_CM;

  float pct = (level / TANK_DEPTH_CM) * 100.0f;
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;

  const char* status = (pct >= LEVEL_OK_PCT)   ? "ok"
                     : (pct >= LEVEL_WARN_PCT) ? "warn"
                                               : "critical";

  float rounded = roundf(level * 10.0f) / 10.0f;
  Serial.printf("[NIVEL] dist=%.1f cm  nivel=%.1f cm  (%.0f%%)\n",
                distance, rounded, pct);

  return { rounded, (int)(pct + 0.5f), status, true };
}
