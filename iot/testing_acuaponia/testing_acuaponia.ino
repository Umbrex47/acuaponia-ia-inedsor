// ────────────────────────────────────────────────────────────────
//   Aquaponic OS · Firmware ESP32
//   Lee un módulo de termistor NTC (tipo KY-028, salida AO analógica)
//   en GPIO 15 y publica la temperatura por MQTT al backend NestJS.
//
//   Librerías requeridas (Arduino IDE → Library Manager):
//     - PubSubClient  (Nick O'Leary)
//     - ArduinoJson   (Benoît Blanchon)
//   Placa: ESP32 Dev Module
//
//   Cableado del módulo NTC:
//     - VCC / +  → 3V3
//     - GND / G  → GND
//     - AO       → GPIO 15   (pin analógico, NO el DO digital)
//
//   ⚠️ ADVERTENCIA: GPIO 15 pertenece al ADC2 del ESP32, y el ADC2
//   NO funciona de forma fiable mientras el WiFi está activo. Si ves
//   lecturas en 0 o "no disponible", mueve el cable AO a un pin del
//   ADC1 (GPIO 32, 33, 34, 35, 36 o 39) y cambia PIN_SENSOR.
// ────────────────────────────────────────────────────────────────

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#include "arduino_secrets.h"

// ── Hardware ──────────────────────────────────────────────
const int   PIN_SENSOR     = 34;       // AO del módulo NTC (ADC2 — ver advertencia)
const float ADC_VREF       = 3.3f;     // Voltaje de referencia
const int   ADC_MAX        = 4095;     // 12 bits
const int   ADC_SAMPLES    = 16;       // Promediado de lecturas

// ── Parámetros del termistor NTC (ecuación Beta) ──────────
// Valores típicos de un módulo KY-028 (NTC 10k, B=3950, resistencia
// serie de 10k). Si la temperatura sale desfasada, ajústalos o invierte
// NTC_ON_HIGH_SIDE según cómo esté armado el divisor de tu módulo.
const float NTC_SERIES_R   = 10000.0f; // Resistencia fija del divisor (Ω)
const float NTC_NOMINAL_R  = 1287.0f;  // Calibrado: R medido a la temp. de referencia
const float NTC_NOMINAL_T  = 20.0f;    // Temperatura de referencia (°C) del punto anterior
const float NTC_BETA       = 3950.0f;  // Coeficiente Beta
const bool  NTC_ON_HIGH_SIDE = false;  // true: NTC entre VCC y AO; false: NTC a GND

// ── Temporización ─────────────────────────────────────────
const unsigned long SAMPLE_INTERVAL_MS  = 1000;   // Lectura por serial
const unsigned long PUBLISH_INTERVAL_MS = 2000;   // Publicación MQTT
const unsigned long MQTT_RETRY_MS       = 3000;

// ── Rango ideal para tilapia (para el % del gauge y status) ──
const float TEMP_MIN_OK   = 24.0f;
const float TEMP_MAX_OK   = 30.0f;
const float TEMP_MIN_WARN = 20.0f;
const float TEMP_MAX_WARN = 33.0f;
const float TEMP_SCALE_MIN = 15.0f;   // 0% del gauge
const float TEMP_SCALE_MAX = 35.0f;   // 100% del gauge

// ── Estado global ─────────────────────────────────────────
WiFiClient    wifiClient;
PubSubClient  mqtt(wifiClient);

unsigned long lastSampleMs  = 0;
unsigned long lastPublishMs = 0;
unsigned long lastMqttTryMs = 0;
float         lastTempC     = NAN;

// ──────────────────────────────────────────────────────────
//   WiFi
// ──────────────────────────────────────────────────────────
void setupWifi() {
  Serial.print("[WiFi] Conectando a ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WiFi] OK · IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[WiFi] No se pudo conectar (se reintentará en loop)");
  }
}

// ──────────────────────────────────────────────────────────
//   MQTT
// ──────────────────────────────────────────────────────────
bool mqttConnect() {
  Serial.print("[MQTT] Conectando a ");
  Serial.print(MQTT_HOST);
  Serial.print(':');
  Serial.print(MQTT_PORT);
  Serial.print(" como ");
  Serial.println(MQTT_CLIENT_ID);

  // Last Will: si el ESP32 se desconecta, el broker publica "offline".
  const char* willTopic   = MQTT_TOPIC_STATUS;
  const char* willPayload = "{\"online\":false}";

  bool ok = mqtt.connect(
      MQTT_CLIENT_ID,
      MQTT_USERNAME, MQTT_PASSWORD,
      willTopic, 0, true, willPayload);

  if (ok) {
    Serial.println("[MQTT] Conectado");
    mqtt.publish(MQTT_TOPIC_STATUS, "{\"online\":true}", true);
  } else {
    Serial.print("[MQTT] Falló (rc=");
    Serial.print(mqtt.state());
    Serial.println("). Reintento en breve.");
  }
  return ok;
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  if (millis() - lastMqttTryMs < MQTT_RETRY_MS) return;
  lastMqttTryMs = millis();
  mqttConnect();
}

// ──────────────────────────────────────────────────────────
//   Sensor
// ──────────────────────────────────────────────────────────
float readTemperatureC() {
  // Promedio de varias muestras para reducir ruido.
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_SENSOR);
    delay(2);
  }
  int adc = sum / ADC_SAMPLES;

  // ADC pegado a los extremos → sensor abierto/en corto o, lo más
  // probable aquí, el ADC2 bloqueado por el WiFi. No es un dato válido.
  if (adc <= 5 || adc >= ADC_MAX - 5) {
    Serial.printf(
      "[SENSOR] Lectura inválida (ADC=%d). Si es 0, el GPIO 15/ADC2 no "
      "funciona con WiFi: mueve AO a GPIO 34.\n",
      adc);
    return NAN;
  }

  // Reconstruye la resistencia del NTC desde el divisor de tensión.
  float vOut = (adc * ADC_VREF) / ADC_MAX;
  float rNtc;
  if (NTC_ON_HIGH_SIDE) {
    // NTC entre VCC y AO, resistencia serie a GND.
    rNtc = NTC_SERIES_R * (ADC_VREF / vOut - 1.0f);
  } else {
    // NTC entre AO y GND, resistencia serie a VCC.
    rNtc = NTC_SERIES_R * (vOut / (ADC_VREF - vOut));
  }

  // Ecuación Beta: 1/T = 1/T0 + (1/B)·ln(R/R0)
  float t0 = NTC_NOMINAL_T + 273.15f;
  float invT = 1.0f / t0 + (1.0f / NTC_BETA) * logf(rNtc / NTC_NOMINAL_R);
  float tempC = 1.0f / invT - 273.15f;

  Serial.printf("[SENSOR] ADC=%d  V=%.3f  R=%.0fΩ  T=%.2f°C\n",
                adc, vOut, rNtc, tempC);
  return tempC;
}

int computePercent(float tempC) {
  float pct = (tempC - TEMP_SCALE_MIN) / (TEMP_SCALE_MAX - TEMP_SCALE_MIN) * 100.0f;
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;
  return (int)(pct + 0.5f);
}

const char* computeStatus(float tempC) {
  if (tempC >= TEMP_MIN_OK   && tempC <= TEMP_MAX_OK)   return "ok";
  if (tempC >= TEMP_MIN_WARN && tempC <= TEMP_MAX_WARN) return "warn";
  return "critical";
}

// ──────────────────────────────────────────────────────────
//   Publicación MQTT (formato esperado por el normalizer del frontend)
// ──────────────────────────────────────────────────────────
void publishTelemetry(float tempC) {
  if (!mqtt.connected()) return;
  if (isnan(tempC)) return;

  StaticJsonDocument<256> doc;
  JsonObject sensors = doc.createNestedObject("sensors");
  JsonObject temp    = sensors.createNestedObject("temperatura");

  temp["value"]   = roundf(tempC * 10.0f) / 10.0f;
  temp["unit"]    = "°C";
  temp["percent"] = computePercent(tempC);
  temp["status"]  = computeStatus(tempC);

  JsonObject system = doc.createNestedObject("system");
  system["status"]      = "stable";
  system["statusLabel"] = "Estable";
  doc["device"]         = MQTT_CLIENT_ID;
  doc["uptimeMs"]       = millis();

  char buffer[256];
  size_t n = serializeJson(doc, buffer, sizeof(buffer));

  bool ok = mqtt.publish(MQTT_TOPIC_TELEMETRY, (const uint8_t*)buffer, n, false);
  Serial.print("[MQTT] publish → ");
  Serial.print(MQTT_TOPIC_TELEMETRY);
  Serial.print(" · ");
  Serial.print(n);
  Serial.print("B · ");
  Serial.println(ok ? "OK" : "FAIL");
}

// ──────────────────────────────────────────────────────────
//   Setup / Loop
// ──────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("=== Aquaponic ESP32 · arrancando ===");

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);   // Rango completo ~0–3.3 V
  Serial.printf("[SENSOR] Termistor NTC (AO) en GPIO %d\n", PIN_SENSOR);

  setupWifi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(30);
  mqtt.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWifi();
  }

  ensureMqtt();
  mqtt.loop();

  unsigned long now = millis();

  if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;
    lastTempC = readTemperatureC();
  }

  if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    publishTelemetry(lastTempC);
  }
}
