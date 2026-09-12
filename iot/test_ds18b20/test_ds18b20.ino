// ────────────────────────────────────────────────────────────────
//  Test individual del termómetro sumergible DS18B20.
//  Placa: ESP32 Dev Module
//
//  Conexión esperada:
//    - DATA → GPIO 4 (bidireccional, con pull-up 4.7 kΩ a 3.3 V)
//    - VCC  → 3.3 V (Rojo)
//    - GND  → GND   (Negro)
//
//  Librerías: OneWire + DallasTemperature (Library Manager).
//
//  Si no detecta dispositivos, la causa más probable es el pull-up
//  faltante: la línea nunca sube y la sonda no responde al reset.
//  Este sketch activa el pull-up INTERNO del GPIO como diagnóstico:
//  si así detecta la sonda, ya sabés que el pull-up externo falta.
// ────────────────────────────────────────────────────────────────

#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_PIN 4

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature sensors(&oneWire);

unsigned long lastReadMs = 0;
const unsigned long READ_INTERVAL_MS = 1500;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Test DS18B20 (GPIO 4) ===");
  Serial.println("Si no detecta dispositivos, lo más probable es pull-up faltante.");
  Serial.println("La placa DFRobot 'Gravity' lo trae integrado; si tu sonda es");
  Serial.println("cruda, agregá una resistencia 4.7 kΩ entre GPIO 4 y 3.3 V.");
  Serial.println();

  pinMode(ONE_WIRE_PIN, INPUT_PULLUP);
  sensors.setResolution(12);
  sensors.begin();

  int count = sensors.getDeviceCount();
  Serial.printf("[INIT] Dispositivos 1-Wire detectados: %d\n", count);

  if (count == 0) {
    Serial.println("[HINT] Activando pull-up INTERNO del GPIO como prueba.");
    Serial.println("[HINT] Si con esto detecta la sonda → pull-up externo faltante.");
  }
}

void loop() {
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) return;
  lastReadMs = now;

  sensors.requestTemperatures();
  int n = sensors.getDeviceCount();

  if (n == 0) {
    Serial.println("[READ] Sin dispositivos 1-Wire. Revisar cableado y pull-up.");
    return;
  }

  for (int i = 0; i < n; i++) {
    float t = sensors.getTempCByIndex(i);
    Serial.printf("[READ] Dispositivo %d: ", i);

    if (t == DEVICE_DISCONNECTED_C) {
      Serial.println("DESCONECTADO (sonda no responde)");
    } else if (t < -50.0f || t > 125.0f) {
      Serial.printf("INVÁLIDO (%.2f °C)\n", t);
    } else {
      Serial.printf("OK · %.2f °C (%.2f °F)\n", t, t * 9.0f / 5.0f + 32.0f);
    }
  }
  Serial.println();
}