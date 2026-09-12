// ────────────────────────────────────────────────────────────────
//  Test individual del sensor ambiental BME280 (I2C).
//  Placa: ESP32 Dev Module
//
//  Conexión esperada:
//    - VCC → 3.3 V
//    - GND → GND
//    - SDA → GPIO 21
//    - SCL → GPIO 22
//
//  Librerías: Adafruit BME280 + Adafruit Unified Sensor.
//
//  Este sketch primero hace un SCANNER I2C (imprime todas las
//  direcciones que respondan), luego intenta abrir el BME280 en
//  0x76 y 0x77. Si no aparece, te dice exactamente qué direcciones
//  hay en el bus, así sabés si tenés que cambiar el módulo o el
//  firmware.
// ────────────────────────────────────────────────────────────────

#include <Wire.h>
#include <Adafruit_BME280.h>

#define I2C_SDA 21
#define I2C_SCL 22

Adafruit_BME280 bme;
bool bmeReady = false;
unsigned long lastReadMs = 0;
const unsigned long READ_INTERVAL_MS = 1500;

void i2cScanner() {
  Serial.println("[I2C] Escaneando bus 0x03..0x77…");
  int found = 0;
  for (byte addr = 0x03; addr <= 0x77; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("[I2C] Dispositivo en 0x%02X\n", addr);
      found++;
    }
  }
  Serial.printf("[I2C] %d dispositivo(s) encontrado(s).\n", found);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Test BME280 (I2C: SDA=21, SCL=22) ===");

  Wire.begin(I2C_SDA, I2C_SCL);
  delay(100);

  i2cScanner();
  Serial.println();

  Serial.println("[INIT] Probando BME280 en 0x76…");
  bmeReady = bme.begin(0x76, &Wire);
  if (!bmeReady) {
    Serial.println("[INIT] No respondió en 0x76. Probando 0x77…");
    bmeReady = bme.begin(0x77, &Wire);
  }

  if (bmeReady) {
    bme.setSampling(Adafruit_BME280::MODE_FORCED,
                    Adafruit_BME280::SAMPLING_X1,
                    Adafruit_BME280::SAMPLING_X1,
                    Adafruit_BME280::SAMPLING_X1,
                    Adafruit_BME280::FILTER_OFF);
    Serial.println("[INIT] BME280 detectado y configurado.");
  } else {
    Serial.println("[INIT] FALLÓ: el BME280 no responde en 0x76 ni 0x77.");
    Serial.println("[HINT] Verificar:");
    Serial.println("       - SDA/SCL en GPIO 21/22 (sin cruzar).");
    Serial.println("       - VCC = 3.3 V (NO 5 V).");
    Serial.println("       - Cables firmes; sin falsos contactos.");
    Serial.println("       - Que la dirección sea 0x76 o 0x77 (mirar SDO del módulo).");
  }
}

void loop() {
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) return;
  lastReadMs = now;

  if (!bmeReady) {
    Serial.println("[READ] BME280 no inicializado. Nada que leer.");
    return;
  }

  bme.takeForcedMeasurement();
  float t  = bme.readTemperature();
  float h  = bme.readHumidity();
  float p  = bme.readPressure() / 100.0f;

  Serial.printf("[READ] T=%.2f °C   HR=%.2f %%   P=%.2f hPa\n", t, h, p);
}