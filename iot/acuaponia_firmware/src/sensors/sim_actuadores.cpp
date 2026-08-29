#include "sim_actuadores.h"

#include <math.h>

// ───────────────────────────────────────────────────────────────────────────
//   Sensor virtual para validar lógica de actuadores sin hardware físico.
//
//   Cada clave rota por tres valores (ok, warn, critical) cada SIM_DWELL_MS
//   para que el motor de bomba, las alertas y el dashboard vean transiciones
//   de estado reales. La secuencia es: ok → warn → critical → ok (ciclo).
//
//   Coherente con los rangos de los .cpp reales: mismos límites ok/warn/
//   critical, mismas unidades y misma forma del Reading { value, percent,
//   status, valid }. Así el firmware que consume estos datos no nota diferencia.
// ───────────────────────────────────────────────────────────────────────────

static const unsigned long SIM_DWELL_MS = 10000UL;  // 10 s por estado → ciclo de 30 s

// ── Tabla de casos por clave ──────────────────────────────────────────────
// Cada caso: { value, status, scale_min, scale_max }
// percent = (value - scale_min) / (scale_max - scale_min) * 100, clamp 0–100.
struct SimCase {
  float       value;
  const char* status;
  float       scaleMin;
  float       scaleMax;
};

static const SimCase CASES_TEMPERATURA[] = {
  { 26.0f, "ok",       15.0f, 35.0f },  // tilapia: 24–30 ideal
  { 31.5f, "warn",     15.0f, 35.0f },  // 20–33 tolerable
  {  9.0f, "critical", 15.0f, 35.0f },  // fuera de rango
};

static const SimCase CASES_ELECTROCONDUCTIVIDAD[] = {
  { 1.40f, "ok",       0.0f, 3.0f },  // 0.8–2.0 ideal
  { 0.55f, "warn",     0.0f, 3.0f },  // 0.5–2.5 tolerable
  { 2.90f, "critical", 0.0f, 3.0f },  // fuera de rango alto
};

static const SimCase CASES_NIVEL_AGUA[] = {
  { 28.0f, "ok",        0.0f, 32.0f },  // ≥ 75 % llenado
  { 18.0f, "warn",      0.0f, 32.0f },  // 45–75 %
  {  8.0f, "critical",  0.0f, 32.0f },  // < 10 cm → anti-marcha en seco
};

static const SimCase CASES_TURBIEDAD[] = {
  {  10.0f, "ok",       0.0f, 300.0f },  // < 25 NTU
  {  60.0f, "warn",     0.0f, 300.0f },  // 25–100 NTU
  { 220.0f, "critical", 0.0f, 300.0f },  // > 100 NTU
};

static const SimCase CASES_TEMP_AMBIENTE[] = {
  { 24.0f, "ok",       5.0f, 45.0f },
  { 35.0f, "warn",     5.0f, 45.0f },
  { 42.0f, "critical", 5.0f, 45.0f },
};

static const SimCase CASES_HUMEDAD[] = {
  { 60.0f, "ok",       0.0f, 100.0f },
  { 30.0f, "warn",     0.0f, 100.0f },
  { 92.0f, "critical", 0.0f, 100.0f },
};

static const SimCase CASES_PRESION[] = {
  {1013.0f, "ok",       900.0f, 1100.0f },
  { 945.0f, "warn",     900.0f, 1100.0f },
  {1085.0f, "critical", 900.0f, 1100.0f },
};

// ── Helpers ───────────────────────────────────────────────────────────────
static int computePercent(float v, float minV, float maxV) {
  if (maxV == minV) return 0;
  float p = (v - minV) / (maxV - minV) * 100.0f;
  if (p < 0)   p = 0;
  if (p > 100) p = 100;
  return (int)(p + 0.5f);
}

static Reading pickCase(const SimCase* cases, int count) {
  unsigned long step = (millis() / SIM_DWELL_MS) % (unsigned long)count;
  const SimCase& c = cases[step];
  return {
    c.value,
    computePercent(c.value, c.scaleMin, c.scaleMax),
    c.status,
    true
  };
}

// ── API pública ───────────────────────────────────────────────────────────
void sim_begin() {
  Serial.println("[SIM] Modo simulación activo · sin sensores físicos.");
  Serial.printf("[SIM] Cada estado dura %lu ms (ciclo = %lu s).\n",
                SIM_DWELL_MS, (SIM_DWELL_MS * 3UL) / 1000UL);
}

Reading sim_temperatura_read()       { return pickCase(CASES_TEMPERATURA,       3); }
Reading sim_electroconductividad_read(){ return pickCase(CASES_ELECTROCONDUCTIVIDAD, 3); }
Reading sim_nivelAgua_read()          { return pickCase(CASES_NIVEL_AGUA,        3); }
Reading sim_turbiedad_read()          { return pickCase(CASES_TURBIEDAD,         3); }
Reading sim_temperaturaAmbiente_read(){ return pickCase(CASES_TEMP_AMBIENTE,     3); }
Reading sim_humedad_read()            { return pickCase(CASES_HUMEDAD,           3); }
Reading sim_presion_read()            { return pickCase(CASES_PRESION,           3); }