#include "water_level_resistors.h"
#include <Arduino.h>

#define PIN_LEVEL_LOW  35
#define PIN_LEVEL_MID  34
#define PIN_LEVEL_HIGH 33

static const float LEVEL_MAX_CM = 32.0f;

void water_level_begin() {
  pinMode(PIN_LEVEL_LOW, INPUT);
  pinMode(PIN_LEVEL_MID, INPUT);
  pinMode(PIN_LEVEL_HIGH, INPUT);
  Serial.println("[WATER LEVEL] Pines 35, 34, 33 configurados (resistencias)");
}

Reading water_level_read() {
  // Asumimos que el agua conecta a GND (lógica negada).
  // Los pines deben tener resistencias de pull-up externas.
  bool low_active = (digitalRead(PIN_LEVEL_LOW) == LOW);
  bool mid_active = (digitalRead(PIN_LEVEL_MID) == LOW);
  bool high_active = (digitalRead(PIN_LEVEL_HIGH) == LOW);

  float percent = 0.0f;
  if (high_active) {
    percent = 100.0f;
  } else if (mid_active) {
    percent = 66.0f;
  } else if (low_active) {
    percent = 33.0f;
  } else {
    percent = 0.0f;
  }

  float cm = (percent / 100.0f) * LEVEL_MAX_CM;
  const char* status = (percent >= 75.0f) ? "ok" : ((percent >= 45.0f) ? "warn" : "critical");

  return { cm, (int)percent, status, true };
}
