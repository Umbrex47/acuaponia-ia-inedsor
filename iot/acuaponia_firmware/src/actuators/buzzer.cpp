#include "buzzer.h"

#include "actuator_relay.h"
#include "../config.h"

#include <Arduino.h>

// ───────────────────────────────────────────────────────────────────────────
//   Buzzer de pre-aviso del dispensador.
//
//   Disparo: `buzzer_start_countdown()` (llamado desde el handler MQTT cuando
//   llega un comando `aquaponic/commands/dispensador_comida` con action=dispense).
//
//   El backend publica ese comando cuando se ejecuta el actuador (vía cron,
//   manual o IA). El ESP32 se suscribe, inicia la cuenta regresiva y pita.
//   El backend YA envió el comando "dispense" original; este firmware no
//   republica nada para evitar bucles.
//
//   Máquina de estados:
//     IDLE
//       └─(start_countdown)─► COUNTDOWN(ts0=now)
//     COUNTDOWN
//       ├─ checkpoints (20/15/10/5 s) → emit BEEP_SHORT (200 ms)
//       └─ cuando han pasado 20 s     → BEEP_LONG_START (1000 ms HIGH)
//     BEEP_LONG_START
//       └─ al cumplir 1000 ms → BEEP_FINAL (índice = 0)
//     BEEP_FINAL
//       ├─ si ciclo < 2 → alterna beep (200 ms) · gap (250 ms)
//       └─ si ciclo >= 2 → IDLE
// ───────────────────────────────────────────────────────────────────────────

namespace {

enum class State : uint8_t {
  IDLE,
  COUNTDOWN,
  BEEP_LONG_START,
  BEEP_FINAL,
};

// Checkpoints como TIEMPO TRANSCURRIDO desde el inicio del countdown.
// Los pitidos cortos suenan a 5 s, 10 s, 15 s y 20 s, dejando 5 s entre cada uno.
constexpr unsigned long CHECKPOINTS_MS[] = { 5000UL, 10000UL, 15000UL, 20000UL };
constexpr uint8_t CHECKPOINT_COUNT = sizeof(CHECKPOINTS_MS) / sizeof(CHECKPOINTS_MS[0]);

State          state            = State::IDLE;
unsigned long  phaseStartMs     = 0;
unsigned long  beepStartMs      = 0;
uint8_t        checkpointIndex  = 0;
uint8_t        finalBeepIndex   = 0;
bool           buzzerActive     = false;

inline void buzzerOn() {
  buzzerActive = true;
#if BUZZER_PASSIVE
  tone(PIN_BUZZER, BUZZER_FREQ_HZ);
#else
  digitalWrite(PIN_BUZZER, HIGH);
#endif
}

inline void buzzerOff() {
  buzzerActive = false;
#if BUZZER_PASSIVE
  noTone(PIN_BUZZER);
#else
  digitalWrite(PIN_BUZZER, LOW);
#endif
}

inline bool isBuzzerOn() { return buzzerActive; }

void startBeep(unsigned long durationMs, unsigned long nowMs) {
  buzzerOn();
  beepStartMs = nowMs;
  (void)durationMs;  // la duración se evalúa fuera, en el switch
}

} // namespace

void buzzer_begin() {
  pinMode(PIN_BUZZER, OUTPUT);
  buzzerOff();
  state = State::IDLE;
  Serial.println("[BUZZER] Inicializado en GPIO 19 (pasivo 3.3V directo, 100Ω serie)");
}

bool buzzer_is_active() {
  return state != State::IDLE;
}

void buzzer_start_countdown() {
  if (state != State::IDLE) {
    Serial.println("[BUZZER] Cuenta regresiva ya en curso, se ignora nuevo inicio");
    return;
  }
  state = State::COUNTDOWN;
  phaseStartMs = millis();
  checkpointIndex = 0;
  finalBeepIndex = 0;
  buzzerOff();
  Serial.println("[BUZZER] Cuenta regresiva 20 s iniciada");
}

void buzzer_loop() {
  const unsigned long now = millis();

  switch (state) {

    // ── IDLE ───────────────────────────────────────────────────────────
    case State::IDLE:
      return;

    // ── COUNTDOWN ──────────────────────────────────────────────────────
    case State::COUNTDOWN: {
      // Si el buzzer está sonando un pitido corto, comprobar si terminó.
      if (isBuzzerOn()) {
        if (now - beepStartMs >= BUZZER_BEEP_SHORT_MS) {
          buzzerOff();
          beepStartMs = now;
        }
        return;
      }

      const unsigned long elapsed = now - phaseStartMs;

      // ¿Toca emitir el siguiente pitido de checkpoint?
      if (checkpointIndex < CHECKPOINT_COUNT
          && elapsed >= CHECKPOINTS_MS[checkpointIndex]) {
        const unsigned long remaining = (BUZZER_COUNTDOWN_MS - elapsed) / 1000UL;
        Serial.printf("[BUZZER] t-%lus → beep corto\n", remaining);
        startBeep(BUZZER_BEEP_SHORT_MS, now);
        checkpointIndex++;
        return;
      }

      // ¿Ya emitimos los 4 pitidos cortos y pasaron los 20 s?
      if (checkpointIndex >= CHECKPOINT_COUNT) {
        // Al finalizar la cuenta regresiva se dispara la dispensación física
        // (relé del dispensador) junto con el pitido largo de aviso.
        Serial.println("[BUZZER] t=0s → beep largo + dispensar");
        relay_execute("dispensador_comida", "dispense");
        buzzerOn();
        beepStartMs = now;
        state = State::BEEP_LONG_START;
      }
      return;
    }

    // ── BEEP_LONG_START ────────────────────────────────────────────────
    case State::BEEP_LONG_START: {
      if (now - beepStartMs >= BUZZER_BEEP_LONG_MS) {
        buzzerOff();
        finalBeepIndex = 0;
        beepStartMs = now;
        state = State::BEEP_FINAL;
      }
      return;
    }

    // ── BEEP_FINAL ─────────────────────────────────────────────────────
    // Patrón: beep (200 ms) · gap (250 ms) · beep (200 ms) · gap (250 ms).
    case State::BEEP_FINAL: {
      const unsigned long cycleMs = BUZZER_BEEP_SHORT_MS + BUZZER_BEEP_GAP_MS;
      const unsigned long elapsed = now - beepStartMs;
      const uint8_t cycle = (uint8_t)(elapsed / cycleMs);     // 0 o 1
      const unsigned long pos = elapsed - cycle * cycleMs;     // 0..cycleMs-1

      if (cycle >= 2) {
        // Terminamos los dos pitidos cortos.
        buzzerOff();
        Serial.println("[BUZZER] Secuencia completa");
        state = State::IDLE;
        return;
      }

      const bool shouldBeep = pos < BUZZER_BEEP_SHORT_MS;
      if (shouldBeep && !isBuzzerOn()) {
        buzzerOn();
        if (finalBeepIndex != cycle) {
          Serial.printf("[BUZZER] beep final %u/2\n", cycle + 1);
          finalBeepIndex = cycle;
        }
      } else if (!shouldBeep && isBuzzerOn()) {
        buzzerOff();
      }
      return;
    }
  }
}