// ────────────────────────────────────────────────────────────────
//  Test individual del sensor de electroconductividad (EC) analógico.
//  Placa: ESP32 Dev Module
//
//  Conexión esperada:
//    - AO (señal) → GPIO 32 (ADC1, único compatible con WiFi)
//    - VCC        → 3.3 V (sin divisor) o 5 V (con divisor 1 kΩ + 2 kΩ)
//    - GND        → GND
//
//  Este sketch imprime el ADC crudo (0–4095), el voltaje y la EC
//  estimada con la curva del DFRobot DFR0300. NO usa el módulo I2C
//  ni la sonda de temperatura: solo lee el AO y te dice si está
//  saturado, desconectado o leyendo un valor plausible.
// ────────────────────────────────────────────────────────────────

#define PIN_EC 32
#define ADC_VREF 3.3f
#define ADC_MAX 4095

// Curva DFRobot DFR0300 (DFRobot wiki). Temperatura de referencia 25 °C.
static float voltageToEcUs(float voltage, float tempC) {
  float k = 1.0f + 0.0185f * (tempC - 25.0f);
  float v = voltage / k;
  return 133.42f * v * v * v - 255.86f * v * v + 857.39f * v;
}

unsigned long lastReadMs = 0;
const unsigned long READ_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Test EC analógico (GPIO 32) ===");
  Serial.println("ADC esperado con la sonda en agua: 1000–3000.");
  Serial.println("ADC = 0     → sonda desconectada o cable suelto.");
  Serial.println("ADC = 4095  → AO fuera de rango o corto a VCC.");
  Serial.println("ADC estable pero muy bajo → agua muy pura (0 sales).");
  Serial.println();

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
}

void loop() {
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) return;
  lastReadMs = now;

  // 16 muestras para estabilizar la lectura.
  long sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(PIN_EC);
    delay(2);
  }
  int adc = sum / 16;
  float voltage = (adc * ADC_VREF) / ADC_MAX;
  float ecUs    = voltageToEcUs(voltage, 25.0f);
  float ecMs    = ecUs / 1000.0f;

  Serial.printf("[READ] ADC=%4d  V=%.3f  EC=%.2f mS/cm", adc, voltage, ecMs);

  if (adc <= 5)        Serial.println("   → sonda DESCONECTADA");
  else if (adc >= ADC_MAX - 5) Serial.println("   → SATURADO (AO fuera de rango o corto a VCC)");
  else                  Serial.println("   → OK");
}