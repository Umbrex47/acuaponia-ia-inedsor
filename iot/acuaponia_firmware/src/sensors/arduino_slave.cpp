#include "arduino_slave.h"
#include "../config.h"

#include <ArduinoJson.h>
#include <math.h>

// ── Rangos para % y status ─────────────────────────────────────────────────────
// Nivel: 0–32 cm · ≥ 75 % → ok · ≥ 45 % → warn · resto critical.
static const float LEVEL_OK_PCT   = 75.0f;
static const float LEVEL_WARN_PCT = 45.0f;
static const float LEVEL_MAX_CM   = 32.0f;

// ── Estado compartido del esclavo ──────────────────────────────────────────────
// Última muestra válida recibida. valid=false hasta la primera trama.
// Solo se procesa `nivelAgua`: la turbidez ya no se envía desde el esclavo.
static float lastNivelCm   = NAN;
static unsigned long lastSeenMs = 0;
static char rxLine[192];
static size_t rxLen = 0;

static int computePercentLevel(float levelCm) {
  float p = (levelCm / LEVEL_MAX_CM) * 100.0f;
  if (p < 0)   p = 0;
  if (p > 100) p = 100;
  return (int)(p + 0.5f);
}

static const char* computeStatusLevel(float levelCm) {
  float pct = (levelCm / LEVEL_MAX_CM) * 100.0f;
  if (pct >= LEVEL_OK_PCT)   return "ok";
  if (pct >= LEVEL_WARN_PCT) return "warn";
  return "critical";
}

// Procesa una línea completa (terminada en '\n'). Acepta tramas con sólo
// `nivelAgua` (formato actual del slave). Las claves que lleguen de más
// (por ejemplo `turbiedad`) se ignoran silenciosamente para compatibilidad
// con versiones viejas del firmware del esclavo.
static void handleLine(const char* line) {
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) {
    Serial.printf("[SLAVE] JSON inválido: %s\n", err.c_str());
    return;
  }

  JsonObject nivel = doc["nivelAgua"];
  if (nivel.isNull()) {
    Serial.println("[SLAVE] Falta nivelAgua");
    return;
  }

  float n = nivel["value"].as<float>();
  if (isnan(n)) {
    Serial.println("[SLAVE] value NaN");
    return;
  }

  lastNivelCm = n;
  lastSeenMs  = millis();
  Serial.printf("[SLAVE] OK · nivel=%.2f cm\n", n);
}

// Vacía el buffer Serial2 parseando por líneas. Llamar en cada loop().
static void pollSerial() {
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\r') continue;
    if (c == '\n') {
      rxLine[rxLen] = '\0';
      if (rxLen > 0) handleLine(rxLine);
      rxLen = 0;
      continue;
    }
    if (rxLen < sizeof(rxLine) - 1) {
      rxLine[rxLen++] = c;
    } else {
      // Línea demasiado larga: descartar y reiniciar.
      rxLen = 0;
    }
  }
}

void slave_begin() {
  Serial2.begin(SLAVE_BAUD, SERIAL_8N1, PIN_SLAVE_RX, PIN_SLAVE_TX);
  Serial.printf("[SLAVE] Serial2 abierto · RX=GPIO%d · TX=GPIO%d · %u bps\n",
                PIN_SLAVE_RX, PIN_SLAVE_TX, (unsigned)SLAVE_BAUD);
}

static bool freshAndValid() {
  pollSerial();
  if (lastSeenMs == 0) return false;
  if (millis() - lastSeenMs > SLAVE_TIMEOUT_MS) return false;
  if (isnan(lastNivelCm))                       return false;
  return true;
}

Reading slave_nivelAgua_read() {
  if (!freshAndValid()) {
    return { NAN, 0, "critical", false };
  }
  float v = roundf(lastNivelCm * 10.0f) / 10.0f;
  return { v, computePercentLevel(v), computeStatusLevel(v), true };
}