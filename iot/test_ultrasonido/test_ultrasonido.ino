// ────────────────────────────────────────────────────────────────
//  Test individual del sensor ultrasónico JSN-SR04T / HC-SR04.
//  Placa: ESP32 Dev Module
//
//  Conexión esperada:
//    - VCC  → 5 V
//    - GND  → GND
//    - Trig → GPIO 5
//    - Echo → GPIO 18 (con divisor 1 kΩ + 2 kΩ si Echo entrega 5 V)
//
//  La telemetría real recibe estos datos desde el Arduino esclavo
//  por Serial2 (ver test_serial2_slave). Este test te sirve para
//  verificar el sensor directamente en la ESP32, útil cuando estás
//  armando el cableado y querés descartar al esclavo.
// ────────────────────────────────────────────────────────────────

#define PIN_TRIG 5
#define PIN_ECHO 18
#define ECHO_TIMEOUT_US 30000UL

unsigned long lastReadMs = 0;
const unsigned long READ_INTERVAL_MS = 500;

float readDistanceOnce() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, ECHO_TIMEOUT_US);
  if (duration == 0) return NAN;
  return duration * 0.0343f / 2.0f;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Test JSN-SR04T / HC-SR04 (Trig=5, Echo=18) ===");
  Serial.println("Apuntando al aire deberías ver distancias de > 100 cm.");
  Serial.println("Apuntando a una pared a 50 cm deberías ver ~50 cm (±3 cm).");
  Serial.println();
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);
}

void loop() {
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) return;
  lastReadMs = now;

  // 5 muestras, mediana.
  float samples[5];
  int valid = 0;
  for (int i = 0; i < 5; i++) {
    float d = readDistanceOnce();
    if (!isnan(d)) samples[valid++] = d;
    delay(60);
  }
  if (valid == 0) {
    Serial.println("[READ] Sin eco (Echo=18 sin respuesta). Revisar cableado.");
    return;
  }
  for (int i = 1; i < valid; i++) {
    float k = samples[i]; int j = i - 1;
    while (j >= 0 && samples[j] > k) { samples[j+1] = samples[j]; j--; }
    samples[j+1] = k;
  }
  float d = samples[valid / 2];
  Serial.printf("[READ] distancia = %.1f cm   (raw=%d muestras)\n", d, valid);
}