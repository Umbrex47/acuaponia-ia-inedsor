// ────────────────────────────────────────────────────────────────
//  Test individual del sensor de turbidez analógico (AO).
//  Placa: ESP32 Dev Module
//
//  Conexión esperada:
//    - VCC → 5 V (el módulo suele requerirlo)
//    - GND → GND
//    - AO  → GPIO 33 (ADC1) con divisor resistivo 1 kΩ + 2 kΩ
//            (ratio = 1.5; cambiá DIVIDER_RATIO abajo si usás otro).
//
//  En la telemetría final la turbidez llega del Arduino esclavo por
//  Serial2. Este test es solo para validar el sensor de forma
//  aislada mientras armás el cableado.
// ────────────────────────────────────────────────────────────────

#define PIN_TURB 33
#define ADC_VREF 3.3f
#define ADC_MAX  4095
#define DIVIDER_RATIO 1.5f

unsigned long lastReadMs = 0;
const unsigned long READ_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Test turbidez analógica (GPIO 33) ===");
  Serial.println("ADC esperado: 0–3500 según claridad del agua.");
  Serial.println("ADC = 0     → sonda desconectada.");
  Serial.println("ADC = 4095  → AO > 3.3 V, divisor resistivo faltante o mal.");
  Serial.println();
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
}

void loop() {
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) return;
  lastReadMs = now;

  // 9 muestras para estabilizar (mediana).
  float samples[9];
  for (int i = 0; i < 9; i++) {
    samples[i] = (float)analogReadMilliVolts(PIN_TURB);
    delay(2);
  }
  for (int i = 1; i < 9; i++) {
    float k = samples[i]; int j = i - 1;
    while (j >= 0 && samples[j] > k) { samples[j+1] = samples[j]; j--; }
    samples[j+1] = k;
  }
  float mvAdc = samples[4];
  float vAdc  = mvAdc / 1000.0f;
  float vAo   = vAdc * DIVIDER_RATIO;
  int   adc   = (int)((vAdc / ADC_VREF) * ADC_MAX);

  Serial.printf("[READ] ADC=%4d  Vadc=%.3f  Vao=%.3f", adc, vAdc, vAo);
  if (adc <= 5)            Serial.println("   → DESCONECTADO");
  else if (adc >= ADC_MAX - 5) Serial.println("   → SATURADO (divisor faltante o AO fuera de rango)");
  else if (vAo >= 4.2f)     Serial.println("   → AGUA MUY CLARA (≈ 0 NTU)");
  else                      Serial.println("   → OK");
}