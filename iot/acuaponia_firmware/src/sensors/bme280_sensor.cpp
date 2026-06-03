#include "bme280_sensor.h"
#include "../config.h"

#include <Wire.h>
#include <Adafruit_BME280.h>
#include <math.h>

static Adafruit_BME280 bme;
static bool bmeReady = false;

struct BmeSample {
  float tempC;
  float humidity;
  float pressureHpa;
  bool  valid;
};

static BmeSample lastSample = { NAN, NAN, NAN, false };
static unsigned long lastReadMs = 0;
static const unsigned long READ_INTERVAL_MS = 1000;

// ── Rangos para % y estado (ambiente / invernadero) ──
static const float T_SCALE_MIN = 5.0f,  T_SCALE_MAX = 45.0f;
static const float T_OK_MIN    = 18.0f, T_OK_MAX    = 32.0f;
static const float T_WARN_MIN  = 10.0f, T_WARN_MAX  = 38.0f;

static const float H_SCALE_MIN = 0.0f,  H_SCALE_MAX = 100.0f;
static const float H_OK_MIN    = 40.0f, H_OK_MAX    = 75.0f;
static const float H_WARN_MIN  = 25.0f, H_WARN_MAX  = 90.0f;

static const float P_SCALE_MIN = 900.0f, P_SCALE_MAX = 1100.0f;
static const float P_OK_MIN    = 950.0f, P_OK_MAX    = 1050.0f;
static const float P_WARN_MIN  = 930.0f, P_WARN_MAX  = 1070.0f;

static int computePercent(float v, float minV, float maxV) {
  float p = (v - minV) / (maxV - minV) * 100.0f;
  if (p < 0)   p = 0;
  if (p > 100) p = 100;
  return (int)(p + 0.5f);
}

static const char* computeStatus3(float v, float okMin, float okMax,
                                  float warnMin, float warnMax) {
  if (v >= okMin   && v <= okMax)   return "ok";
  if (v >= warnMin && v <= warnMax) return "warn";
  return "critical";
}

static void refreshSample() {
  if (!bmeReady) return;
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) return;

  lastReadMs = now;
  bme.takeForcedMeasurement();
  lastSample.tempC      = bme.readTemperature();
  lastSample.humidity   = bme.readHumidity();
  lastSample.pressureHpa = bme.readPressure() / 100.0f;   // Pa → hPa
  lastSample.valid =
      isfinite(lastSample.tempC) &&
      isfinite(lastSample.humidity) &&
      isfinite(lastSample.pressureHpa) &&
      lastSample.humidity >= 0.0f && lastSample.humidity <= 100.0f;

  if (lastSample.valid) {
    Serial.printf("[BME280] T=%.1f°C  HR=%.1f%%  P=%.1f hPa\n",
                  lastSample.tempC, lastSample.humidity, lastSample.pressureHpa);
  } else {
    Serial.println("[BME280] Lectura inválida");
  }
}

void bme280_begin() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  // Dirección I2C habitual: 0x76 (SDO→GND) o 0x77 (SDO→VCC).
  bmeReady = bme.begin(0x76, &Wire);
  if (!bmeReady) bmeReady = bme.begin(0x77, &Wire);

  if (bmeReady) {
    bme.setSampling(Adafruit_BME280::MODE_FORCED,
                    Adafruit_BME280::SAMPLING_X1,
                    Adafruit_BME280::SAMPLING_X1,
                    Adafruit_BME280::SAMPLING_X1,
                    Adafruit_BME280::FILTER_OFF);
    Serial.printf("[BME280] Listo en I2C (SDA=%d, SCL=%d)\n",
                  PIN_I2C_SDA, PIN_I2C_SCL);
  } else {
    Serial.println("[BME280] No detectado — revisa cableado I2C y dirección 0x76/0x77");
  }
}

Reading bme280_temp_ambiente_read() {
  refreshSample();
  if (!lastSample.valid) return { NAN, 0, "critical", false };
  float v = roundf(lastSample.tempC * 10.0f) / 10.0f;
  return {
    v,
    computePercent(v, T_SCALE_MIN, T_SCALE_MAX),
    computeStatus3(v, T_OK_MIN, T_OK_MAX, T_WARN_MIN, T_WARN_MAX),
    true
  };
}

Reading bme280_humedad_read() {
  refreshSample();
  if (!lastSample.valid) return { NAN, 0, "critical", false };
  float v = roundf(lastSample.humidity * 10.0f) / 10.0f;
  return {
    v,
    computePercent(v, H_SCALE_MIN, H_SCALE_MAX),
    computeStatus3(v, H_OK_MIN, H_OK_MAX, H_WARN_MIN, H_WARN_MAX),
    true
  };
}

Reading bme280_presion_read() {
  refreshSample();
  if (!lastSample.valid) return { NAN, 0, "critical", false };
  float v = roundf(lastSample.pressureHpa * 10.0f) / 10.0f;
  return {
    v,
    computePercent(v, P_SCALE_MIN, P_SCALE_MAX),
    computeStatus3(v, P_OK_MIN, P_OK_MAX, P_WARN_MIN, P_WARN_MAX),
    true
  };
}
