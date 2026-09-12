// ────────────────────────────────────────────────────────────────
//  Test rápido de LEDs indicadores (sin MQTT, sin WiFi)
//  Placa: ESP32 Dev Module
//
//  Pines (mismos que el firmware principal):
//    - LED aireador      → GPIO 16
//    - LED dispensador   → GPIO 17
//
//  Conexión: ánodo → GPIO (con resistencia 220 Ω), cátodo → GND.
//  Si no encienden, prueba con la polaridad invertida (a veces los LEDs
//  de los módulos vienen con ánodo/cátodo al revés).
// ────────────────────────────────────────────────────────────────

const int PIN_LED_AIREADOR    = 16;
const int PIN_LED_DISPENSADOR = 17;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("=== Test LEDs indicadores ===");

  pinMode(PIN_LED_AIREADOR, OUTPUT);
  pinMode(PIN_LED_DISPENSADOR, OUTPUT);

  digitalWrite(PIN_LED_AIREADOR, LOW);
  digitalWrite(PIN_LED_DISPENSADOR, LOW);
}

void loop() {
  Serial.println("[TEST] LED aireador ON 1s");
  digitalWrite(PIN_LED_AIREADOR, HIGH);
  delay(1000);
  Serial.println("[TEST] LED aireador OFF");
  digitalWrite(PIN_LED_AIREADOR, LOW);
  delay(500);

  Serial.println("[TEST] LED dispensador ON 1s");
  digitalWrite(PIN_LED_DISPENSADOR, HIGH);
  delay(1000);
  Serial.println("[TEST] LED dispensador OFF");
  digitalWrite(PIN_LED_DISPENSADOR, LOW);
  delay(500);

  Serial.println("[TEST] Ambos LEDs ON 1s");
  digitalWrite(PIN_LED_AIREADOR, HIGH);
  digitalWrite(PIN_LED_DISPENSADOR, HIGH);
  delay(1000);

  Serial.println("[TEST] Ambos LEDs OFF");
  digitalWrite(PIN_LED_AIREADOR, LOW);
  digitalWrite(PIN_LED_DISPENSADOR, LOW);
  delay(2000);
}
