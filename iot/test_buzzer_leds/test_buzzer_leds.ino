// ────────────────────────────────────────────────────────────────
//  Test rápido de buzzer y LEDs indicadores
//  Placa: ESP32 Dev Module
//
//  Pines (mismos que usa el firmware principal):
//    - LED aireador      → GPIO 16
//    - LED dispensador   → GPIO 17
//    - Buzzer            → GPIO 19
//
//  Conexión LED: ánodo → GPIO (con resistencia 220 Ω), cátodo → GND.
//  Conexión buzzer: GPIO 19 → resistencia 100 Ω → (+) buzzer, (-) → GND.
//
//  IMPORTANTE: define BUZZER_PASSIVE según tu tipo de buzzer.
//    1 = pasivo (necesita tone() para sonar)
//    0 = activo (suena con HIGH)
// ────────────────────────────────────────────────────────────────

#define BUZZER_PASSIVE 1
#define BUZZER_FREQ_HZ 2000

const int PIN_LED_AIREADOR    = 16;
const int PIN_LED_DISPENSADOR = 17;
const int PIN_BUZZER          = 19;

const unsigned long BEEP_SHORT_MS = 200;
const unsigned long BEEP_LONG_MS  = 1000;
const unsigned long BEEP_GAP_MS   = 250;

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("=== Test buzzer + LEDs ===");
#if BUZZER_PASSIVE
  Serial.println("Modo buzzer: PASIVO (usando tone)");
#else
  Serial.println("Modo buzzer: ACTIVO (usando HIGH/LOW)");
#endif

  pinMode(PIN_LED_AIREADOR, OUTPUT);
  pinMode(PIN_LED_DISPENSADOR, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_LED_AIREADOR, LOW);
  digitalWrite(PIN_LED_DISPENSADOR, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // 1) Parpadeo conjunto de LEDs.
  Serial.println("[TEST] Parpadeo LEDs x5");
  for (int i = 0; i < 5; i++) {
    digitalWrite(PIN_LED_AIREADOR, HIGH);
    digitalWrite(PIN_LED_DISPENSADOR, HIGH);
    delay(300);
    digitalWrite(PIN_LED_AIREADOR, LOW);
    digitalWrite(PIN_LED_DISPENSADOR, LOW);
    delay(300);
  }

  // 2) Pitido corto del buzzer.
  Serial.println("[TEST] Beep corto");
  beep(BEEP_SHORT_MS);
  delay(500);

  // 3) LED aireador ON 2 s.
  Serial.println("[TEST] LED aireador ON 2s");
  digitalWrite(PIN_LED_AIREADOR, HIGH);
  delay(2000);
  digitalWrite(PIN_LED_AIREADOR, LOW);
  delay(500);

  // 4) LED dispensador ON 2 s.
  Serial.println("[TEST] LED dispensador ON 2s");
  digitalWrite(PIN_LED_DISPENSADOR, HIGH);
  delay(2000);
  digitalWrite(PIN_LED_DISPENSADOR, LOW);
  delay(500);

  // 5) Pitido largo.
  Serial.println("[TEST] Beep largo 1s");
  beep(BEEP_LONG_MS);
  delay(500);

  // 6) Secuencia tipo dispensador.
  Serial.println("[TEST] Secuencia dispensador");
  countdownBeepSequence();

  Serial.println("[TEST] Fin. Repitiendo en 5s...");
}

void loop() {
  countdownBeepSequence();
  delay(5000);
}

void buzzerOn() {
#if BUZZER_PASSIVE
  tone(PIN_BUZZER, BUZZER_FREQ_HZ);
#else
  digitalWrite(PIN_BUZZER, HIGH);
#endif
}

void buzzerOff() {
#if BUZZER_PASSIVE
  noTone(PIN_BUZZER);
#else
  digitalWrite(PIN_BUZZER, LOW);
#endif
}

void beep(unsigned long ms) {
  buzzerOn();
  delay(ms);
  buzzerOff();
}

void countdownBeepSequence() {
  // 4 pitidos cortos.
  for (int i = 0; i < 4; i++) {
    beep(BEEP_SHORT_MS);
    delay(500);
  }
  // Pitido largo final.
  beep(BEEP_LONG_MS);
  delay(200);
  // Dos pitidos cortos finales.
  beep(BEEP_SHORT_MS);
  delay(BEEP_GAP_MS);
  beep(BEEP_SHORT_MS);
}
