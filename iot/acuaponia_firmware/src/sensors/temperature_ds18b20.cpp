#include "temperature_ds18b20.h"
#include "../config.h"

#include <math.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── Bus 1-Wire en el pin de temperatura ──
// OJO: el DS18B20 necesita un GPIO bidireccional (NO sirve GPIO 34/35/36/39,
// que son solo de entrada) y una resistencia pull-up de 4.7 kΩ entre DATA y
// 3.3 V. La placa adaptadora "Gravity" de DFRobot ya la trae integrada.
static OneWire oneWire(PIN_TEMP);
static DallasTemperature dallas(&oneWire);

// ── Rango ideal para tilapia (para % y estado) ──
static const float T_SCALE_MIN = 15.0f, T_SCALE_MAX = 35.0f;  // mapeo del gauge
static const float T_OK_MIN    = 24.0f, T_OK_MAX    = 30.0f;
static const float T_WARN_MIN  = 20.0f, T_WARN_MAX  = 33.0f;

void ds18b20_begin() {
  dallas.begin();
  dallas.setResolution(12);                 // 12 bits → 0.0625 °C
  int n = dallas.getDeviceCount();
  Serial.printf("[DS18B20] Sonda 1-Wire en GPIO %d · %d dispositivo(s)\n",
                PIN_TEMP, n);
  if (n == 0) {
    Serial.println("[DS18B20] No se detecta la sonda: revisa el pull-up 4.7k "
                   "y que el pin sea bidireccional.");
  }
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

Reading ds18b20_read() {
  dallas.requestTemperatures();
  float tempC = dallas.getTempCByIndex(0);

  // -127 °C = sonda desconectada; descartamos lecturas fuera del rango físico.
  if (tempC == DEVICE_DISCONNECTED_C || tempC < -50.0f || tempC > 125.0f) {
    Serial.printf("[DS18B20] Lectura inválida (%.2f°C)\n", tempC);
    return { NAN, 0, "critical", false };
  }

  float rounded = roundf(tempC * 10.0f) / 10.0f;
  Serial.printf("[DS18B20] T=%.2f°C\n", tempC);
  return { rounded, computePercent(tempC), computeStatus(tempC), true };
}
