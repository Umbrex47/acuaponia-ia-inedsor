#include "led_indicators.h"

#include "../config.h"

#include <Arduino.h>

// ───────────────────────────────────────────────────────────────────────────
//   LEDs indicadores de actuadores (estado físico en GPIO).
//
//   Cada actuador mapea a un GPIO. Si `isOn` es true, el pin conmuta entre
//   HIGH y LOW cada `BLINK_HALF_MS` (efecto "respiración"). Si es false, queda
//   fijo en LOW (LED apagado).
//
//   El estado se alimenta desde MQTT (topic /actuators/status/<id>) por
//   `setActuatorState()`. Si no llega ningún mensaje, los LEDs quedan apagados.
// ───────────────────────────────────────────────────────────────────────────

static const unsigned long BLINK_HALF_MS = 600UL;

struct LedState {
  int8_t        pin;        // -1 si no hay LED físico cableado
  bool          isOn;       // estado lógico del actuador
  bool          phaseHigh;  // mitad actual del parpadeo
  unsigned long lastToggleMs;
};

static LedState leds[3] = {
  { -1,                  false, false, 0 },  // bomba_agua: sin LED físico por ahora
  { PIN_LED_AIREADOR,    false, false, 0 },  // aireador
  { PIN_LED_DISPENSADOR, false, false, 0 },  // dispensador_comida
};

static int8_t indexForId(const char* id) {
  if (!id) return -1;
  if (strcmp(id, "bomba_agua") == 0) return 0;
  if (strcmp(id, "aireador") == 0) return 1;
  if (strcmp(id, "dispensador_comida") == 0) return 2;
  return -1;
}

void led_begin() {
  for (uint8_t i = 0; i < sizeof(leds) / sizeof(leds[0]); i++) {
    if (leds[i].pin >= 0) {
      pinMode(leds[i].pin, OUTPUT);
      digitalWrite(leds[i].pin, LOW);
    }
  }
  Serial.println("[LED] Indicadores inicializados (aireador=GPIO16, dispensador=GPIO17)");
}

void setActuatorState(const char* id, bool isOn) {
  int8_t idx = indexForId(id);
  if (idx < 0) return;
  if (leds[idx].isOn == isOn) return;          // sin cambios
  leds[idx].isOn = isOn;
  leds[idx].phaseHigh = false;
  leds[idx].lastToggleMs = millis();
  if (leds[idx].pin >= 0) {
    digitalWrite(leds[idx].pin, isOn ? HIGH : LOW);
  }
  Serial.printf("[LED] %s → %s\n", id, isOn ? "ON (blink)" : "OFF");
}

void led_loop() {
  const unsigned long now = millis();
  for (uint8_t i = 0; i < sizeof(leds) / sizeof(leds[0]); i++) {
    if (leds[i].pin < 0 || !leds[i].isOn) continue;
    if (now - leds[i].lastToggleMs < BLINK_HALF_MS) continue;

    leds[i].phaseHigh = !leds[i].phaseHigh;
    digitalWrite(leds[i].pin, leds[i].phaseHigh ? HIGH : LOW);
    leds[i].lastToggleMs = now;
  }
}