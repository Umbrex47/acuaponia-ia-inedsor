#include "actuator_relay.h"

#include "../config.h"
#include <Arduino.h>
#include <string.h>

// ───────────────────────────────────────────────────────────────────────────
//   Relés de actuadores (activos en LOW, como los módulos con optoacoplador
//   más comunes). HIGH = relé desactivado (carga apagada).
//
//   El dispensador puede ser un relé con motor DC o un servo PWM; aquí se
//   trata como relé: un pulso de DISPENSE_PULSE_MS activa la tolva.
// ───────────────────────────────────────────────────────────────────────────

static const unsigned long DISPENSE_PULSE_MS = 500UL;

struct RelayDef {
  const char* id;
  int8_t      pin;
  bool        activeLow;
  bool        on;
};

static RelayDef RELAYS[] = {
  { "bomba_agua",         PIN_RELAY_BOMBA_AGUA,  true, false },
  { "aireador",           PIN_RELAY_AIREADOR,    true, false },
  { "dispensador_comida", PIN_RELAY_DISPENSADOR, true, false },
};
static const uint8_t RELAY_COUNT = sizeof(RELAYS) / sizeof(RELAYS[0]);

// Para el pulso del dispensador.
static bool     dispensing = false;
static unsigned long dispenseEndMs = 0;

static RelayStatusCallback statusCb = nullptr;

static RelayDef* relayForId(const char* id) {
  if (!id) return nullptr;
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    if (strcmp(RELAYS[i].id, id) == 0) return &RELAYS[i];
  }
  return nullptr;
}

static void writeRelay(RelayDef& r) {
  // activeLow: LOW enciende la carga, HIGH apaga.
  bool pinHigh = r.activeLow ? !r.on : r.on;
  digitalWrite(r.pin, pinHigh ? HIGH : LOW);
}

static void notifyStatus(const char* id, bool on, const char* reason) {
  if (statusCb) statusCb(id, on, reason ? reason : "");
}

void relay_set_status_callback(RelayStatusCallback cb) {
  statusCb = cb;
}

void relay_begin() {
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    // Antes de configurar como salida, forzar el pin a HIGH para módulos
    // active-low (así no se energizan durante el boot ROM del ESP32).
    digitalWrite(RELAYS[i].pin, HIGH);
    pinMode(RELAYS[i].pin, OUTPUT);
    RELAYS[i].on = false;
    writeRelay(RELAYS[i]);
  }
  Serial.println("[RELAY] Relés inicializados (bomba=26, aireador=27, dispensador=25)");
}

void relay_loop() {
  if (!dispensing) return;
  if (millis() - dispenseEndMs >= DISPENSE_PULSE_MS) {
    RelayDef* r = relayForId("dispensador_comida");
    if (r) {
      r->on = false;
      writeRelay(*r);
      Serial.println("[RELAY] dispensador_comida → OFF (fin de pulso)");
      notifyStatus("dispensador_comida", false, "fin de pulso dispense");
    }
    dispensing = false;
  }
}

bool relay_execute(const char* id, const char* action) {
  if (!id || !action) return false;

  RelayDef* r = relayForId(id);
  if (!r) return false;

  if (strcmp(action, "on") == 0) {
    r->on = true;
    writeRelay(*r);
    Serial.printf("[RELAY] %s → ON\n", id);
    notifyStatus(id, true, "comando on desde backend");
    return true;
  }

  if (strcmp(action, "off") == 0) {
    r->on = false;
    writeRelay(*r);
    Serial.printf("[RELAY] %s → OFF\n", id);
    notifyStatus(id, false, "comando off desde backend");
    return true;
  }

  if (strcmp(action, "dispense") == 0) {
    if (strcmp(id, "dispensador_comida") != 0) return false;
    r->on = true;
    writeRelay(*r);
    dispensing = true;
    dispenseEndMs = millis();
    Serial.printf("[RELAY] %s → pulso %lu ms (dispense)\n", id, DISPENSE_PULSE_MS);
    notifyStatus(id, true, "dispensar comando");
    return true;
  }

  return false;
}

bool relay_is_on(const char* id) {
  RelayDef* r = relayForId(id);
  return r ? r->on : false;
}
