#include "water_level_resistors.h"
#include "../config.h"
#include <Arduino.h>

static const float LEVEL_MAX_CM = 32.0f;

void water_level_begin() {
  pinMode(PIN_LEVEL_LOW, INPUT);
  pinMode(PIN_LEVEL_MID, INPUT);
  pinMode(PIN_LEVEL_HIGH, INPUT);
  Serial.printf("[WATER LEVEL] Pines %d, %d, %d configurados (resistencias)\n", PIN_LEVEL_LOW, PIN_LEVEL_MID, PIN_LEVEL_HIGH);
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
