// ──────────────────────────────────────────────────────────────────
//   Aquaponic OS · Arduino esclavo (solo nivelAgua → ESP32)
// ──────────────────────────────────────────────────────────────────
//   Lee el sensor ultrasónico JSN-SR04T / HC-SR04 (Trig/Echo) y emite
//   UNA línea JSON por puerto serie cada PUB_INTERVAL_MS. La turbidez
//   ya NO se lee acá: la ESP32 la toma por su propia vía (o no la usa).
//
//   Formato (terminado en '\n'):
//     {"nivelAgua":{"value":18.3,"unit":"cm"}}
//
//   Conexión a la ESP32:
//     - Arduino D11 (TX)  ──►  ESP32 GPIO 16 (RX de Serial2)
//     - GND Arduino       ──►  GND ESP32        (COMÚN OBLIGATORIO)
//     - No alimentar nada desde los 3.3 V de la ESP32.
//
//   ⚠️ Echo del JSN-SR04T entrega 5 V: la entrada al Arduino UNO/Nano
//      soporta 5 V en sus pines digitales, así que va directo. Si usás
//      un Arduino de 3.3 V (Due, MKR, ESP… como esclavo), agregá un
//      divisor de voltaje 1 kΩ / 2 kΩ en Echo.
//
//   Sensores / pines:
//     - Trig ultrasonido   → D9
//     - Echo ultrasonido   → D10
//
//   Librerías: ArduinoJson (Benoit Blanchon).
// ──────────────────────────────────────────────────────────────────

#include <ArduinoJson.h>

// ── Pines ─────────────────────────────────────────────────────────
#define PIN_TRIG      9
#define PIN_ECHO      10

// ── Geometría pecera (cm) ────────────────────────────────────────
#define TANK_DEPTH_CM     32.0f
#define SENSOR_OFFSET_CM  7.0f
#define DIST_SENSOR_TO_BOTTOM  (SENSOR_OFFSET_CM + TANK_DEPTH_CM)
#define ECHO_TIMEOUT_US   30000UL   // ~5 m máx

// ── Temporización ────────────────────────────────────────────────
#define PUB_INTERVAL_MS  1000        // publica cada 1 s
#define SERIAL_BAUD       9600       // debe coincidir con SLAVE_BAUD en la ESP32

// ── Calidad / debug ──────────────────────────────────────────────
#define ENABLE_DEBUG_PRINTS  1       // 0 = silencio por USB; 1 = log por Serial

// ────────────────────────────────────────────────────────────────
//   Utilidades
// ────────────────────────────────────────────────────────────────
static float readDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  unsigned long duration = pulseIn(PIN_ECHO, HIGH, ECHO_TIMEOUT_US);
  if (duration == 0) return NAN;
  return duration * 0.0343f / 2.0f;     // cm (ida+vuelta)
}

static void emitJson(float nivelCm) {
  // Serial hacia la ESP32 va por D11 (hardware serial en UNO/Nano es
  // compartido con USB). Usamos Serial (TX en D1) si tu Arduino es
  // UNO/Nano/Mini, O un SoftwareSerial en D11 si necesitás conservar
  // el USB libre para debug. Por simplicidad, usamos Serial aquí:
  Serial.print(F("{\"nivelAgua\":{\"value\":"));
  if (isnan(nivelCm)) Serial.print(F("null")); else Serial.print(nivelCm, 1);
  Serial.print(F(",\"unit\":\"cm\"}}\n"));
}

// ────────────────────────────────────────────────────────────────
//   Setup / Loop
// ────────────────────────────────────────────────────────────────
void setup() {
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);

  Serial.begin(SERIAL_BAUD);
  // D11 TX: el Arduino UNO/Nano usa el mismo UART para USB y D0/D1.
  // Para emitir por D11 sin perder el monitor USB, hace falta
  // SoftwareSerial. Lo habilitamos si NO estás usando un Arduino que
  // ya tiene Serial1 nativo (Mega, Due, Leonardo).
  #if defined(__AVR_ATmega328P__) || defined(__AVR_ATmega168__)
    // Quita el comentario si querés usar D11 como TX hacia la ESP32
    // y dejar el USB libre para debug. Necesita SoftwareSerial.h.
    // swSerial.begin(SERIAL_BAUD);
  #endif

  #if ENABLE_DEBUG_PRINTS
    Serial.println(F("[SLAVE] Arduino esclavo arrancando (solo nivelAgua)"));
    Serial.print(F("[SLAVE] Trig=D"));  Serial.print(PIN_TRIG);
    Serial.print(F(" Echo=D"));         Serial.print(PIN_ECHO);
    Serial.print(F(" 9600 8N1"));
    Serial.println();
  #endif
}

void loop() {
  float dist  = readDistanceCm();

  float nivelCm = NAN;
  if (!isnan(dist)) {
    nivelCm = DIST_SENSOR_TO_BOTTOM - dist;
    if (nivelCm < 0.0f)          nivelCm = 0.0f;
    if (nivelCm > TANK_DEPTH_CM) nivelCm = TANK_DEPTH_CM;
    nivelCm = (int)(nivelCm * 10.0f + 0.5f) / 10.0f;
  }

  emitJson(nivelCm);

  #if ENABLE_DEBUG_PRINTS
    Serial.print(F("[SLAVE] nivel="));
    if (isnan(nivelCm)) Serial.print(F("NaN")); else Serial.print(nivelCm);
    Serial.println(F(" cm"));
  #endif

  delay(PUB_INTERVAL_MS);
}