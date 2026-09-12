// ────────────────────────────────────────────────────────────────
//  Test del puerto Serial2 que recibe los datos del Arduino esclavo.
//  Placa: ESP32 Dev Module
//
//  Pines:
//    - RX Serial2 → GPIO 16
//    - TX Serial2 → GPIO 17
//    - GND común con el esclavo.
//
//  Modos:
//    1) Loopback ESP32: TX (GPIO17) → RX (GPIO16). Si ves el eco,
//       el UART está bien configurado.
//    2) Lectura del esclavo real: poner ENABLE_LOOPBACK=0 y conectar
//       el Arduino esclavo.
//
//  El Arduino esclavo emite, una vez por segundo:
//    {"nivelAgua":{"value":18.3,"unit":"cm"},"turbiedad":{"value":12.4,"unit":"NTU"}}
// ────────────────────────────────────────────────────────────────

#define ENABLE_LOOPBACK 1   // 1 = eco interno, 0 = leer esclavo real
#define PIN_SLAVE_RX 16
#define PIN_SLAVE_TX 17
#define SLAVE_BAUD 9600

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Test Serial2 (RX=16, TX=17, 9600 8N1) ===");
  if (ENABLE_LOOPBACK) {
    Serial.println("[MODE] Loopback interno: TX→RX. Conectar un cable entre");
    Serial.println("       GPIO 17 y GPIO 16, o dejarlos al aire si solo querés");
    Serial.println("       validar que el puerto abre sin errores.");
  } else {
    Serial.println("[MODE] Lectura del esclavo real. Asegurate de que el");
    Serial.println("       Arduino esclavo esté conectado: TX esclavo → GPIO 16.");
  }

  Serial2.begin(SLAVE_BAUD, SERIAL_8N1, PIN_SLAVE_RX, PIN_SLAVE_TX);
  Serial.printf("[INIT] Serial2 abierto en GPIO %d (RX) y %d (TX).\n",
                PIN_SLAVE_RX, PIN_SLAVE_TX);
}

void loop() {
  // ── 1) Lectura: volcamos todo lo que llegue por Serial2 ────────
  while (Serial2.available()) {
    char c = Serial2.read();
    Serial.write(c);   // eco a USB para verlo en el monitor serie
  }

  // ── 2) En modo loopback, enviamos una trama JSON de prueba cada 1 s
  if (ENABLE_LOOPBACK) {
    unsigned long now = millis();
    if (now - lastSendMs < SEND_INTERVAL_MS) return;
    lastSendMs = now;

    static float fakeNivel = 18.0f;
    static float fakeNtu   = 12.0f;
    fakeNivel += ((rand() % 100) / 100.0f - 0.5f) * 0.4f;
    fakeNtu   += ((rand() % 100) / 100.0f - 0.5f) * 1.0f;
    if (fakeNivel < 0) fakeNivel = 0; if (fakeNivel > 32) fakeNivel = 32;
    if (fakeNtu   < 0) fakeNtu   = 0; if (fakeNtu   > 100) fakeNtu   = 100;

    char buf[160];
    int n = snprintf(buf, sizeof(buf),
        "{\"nivelAgua\":{\"value\":%.1f,\"unit\":\"cm\"},"
        "\"turbiedad\":{\"value\":%.1f,\"unit\":\"NTU\"}}\n",
        fakeNivel, fakeNtu);
    Serial2.write((const uint8_t*)buf, n);
    Serial.printf("[TX] %s", buf);
  }
}