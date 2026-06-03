/**
 * Catálogo de sensores y dispositivos del sistema acuapónico.
 * Incluye especificaciones técnicas y consumo eléctrico real.
 *
 * Las claves coinciden con los `id` de `DEFAULT_STATE.devices`.
 */
export const SENSORS_INFO = {
  termometro: {
    id: 'termometro',
    name: 'Termómetro sumergible',
    model: 'DFRobot DFR0198 (DS18B20)',
    manufacturer: 'DFRobot',
    parameter: 'Temperatura',
    sensorKey: 'temperatura',
    range: '-55 °C a +125 °C',
    accuracy: '±0.5 °C',
    interface: '1-Wire',
    voltage: '3.0 – 5.5 V',
    currentMa: 1.5,
    currentTyp: '1.5 mA (activo) · 750 µA (idle)',
    powerW: 0.0075,
    description:
      'Termómetro sumergible 1-Wire para monitorear la temperatura del agua de la pecera y la cama de cultivo.',
    location: 'Inmersión · pecera principal',
    pin: 'GPIO 4',
    icon: 'Thermo',
  },
  ph: {
    id: 'ph',
    name: 'Medidor de pH',
    model: 'PH-4502C + sonda pH-E201',
    manufacturer: 'Generic / Atlas Scientific compatible',
    parameter: 'pH',
    sensorKey: 'ph',
    range: '0 – 14 pH',
    accuracy: '±0.1 pH (a 25 °C)',
    interface: 'Analógico (BNC)',
    voltage: '5 V',
    currentMa: 8,
    currentTyp: '8 mA típico',
    powerW: 0.04,
    description:
      'Sonda de pH con módulo amplificador. Calibración recomendada cada 30 días con buffers 4.0 y 7.0.',
    location: 'Inmersión · pecera principal',
    pin: 'GPIO 34 (ADC1)',
    icon: 'pH',
  },
  oxigeno: {
    id: 'oxigeno',
    name: 'Sensor de Oxígeno Disuelto',
    model: 'DFRobot SEN0237-A',
    manufacturer: 'DFRobot',
    parameter: 'Oxígeno disuelto',
    sensorKey: 'oxigeno',
    range: '0 – 20 mg/L',
    accuracy: '±0.3 mg/L',
    interface: 'Analógico',
    voltage: '5 V',
    currentMa: 12,
    currentTyp: '12 mA',
    powerW: 0.06,
    description:
      'Sonda galvánica de oxígeno disuelto. Crítico para la salud de los peces; valores < 5 mg/L disparan alerta.',
    location: 'Inmersión · pecera principal',
    pin: 'GPIO 35 (ADC1)',
    icon: 'O2',
  },
  nivel: {
    id: 'nivel',
    name: 'Sensor de nivel de agua',
    model: 'JSN-SR04T (ultrasónico waterproof)',
    manufacturer: 'Generic',
    parameter: 'Nivel de agua',
    sensorKey: 'nivelAgua',
    range: '20 – 600 cm',
    accuracy: '±1 cm',
    interface: 'Digital (Trigger/Echo)',
    voltage: '3.3 – 5 V',
    currentMa: 30,
    currentTyp: '30 mA durante medición · 5 mA idle',
    powerW: 0.15,
    description:
      'Sensor ultrasónico waterproof que mide la distancia desde la tapa hasta la superficie del agua. Calcula litros mediante volumen del tanque.',
    location: 'Tapa de pecera',
    pin: 'GPIO 5 (Trig) · GPIO 18 (Echo)',
    icon: 'Drop',
  },
  electroconductividad: {
    id: 'electroconductividad',
    name: 'Sensor de Electroconductividad',
    model: 'DFRobot DFR0300 (Analog EC Meter V2)',
    manufacturer: 'DFRobot',
    parameter: 'Electroconductividad / TDS',
    sensorKey: 'electroconductividad',
    range: '0 – 20 mS/cm',
    accuracy: '±5 % FS',
    interface: 'Analógico',
    voltage: '3.3 – 5 V',
    currentMa: 7,
    currentTyp: '7 mA',
    powerW: 0.035,
    description:
      'Mide la concentración de sales y nutrientes disueltos en el agua. Indicador clave para sistemas hidropónicos / acuapónicos.',
    location: 'Inmersión · cama de cultivo',
    pin: 'GPIO 32 (ADC1)',
    icon: 'pH',
  },
  turbidez: {
    id: 'turbidez',
    name: 'Sensor de Turbidez',
    model: 'DFRobot SEN0189',
    manufacturer: 'DFRobot',
    parameter: 'Turbidez',
    sensorKey: 'turbiedad',
    range: '0 – 1000 NTU',
    accuracy: '±5 % FS',
    interface: 'Analógico',
    voltage: '5 V',
    currentMa: 40,
    currentTyp: '40 mA típico',
    powerW: 0.2,
    description:
      'Mide la cantidad de partículas en suspensión en el agua. Una turbidez alta puede indicar exceso de sólidos, restos de comida o problemas de filtración que afectan a peces y plantas.',
    location: 'Inmersión · pecera principal',
    pin: 'GPIO 33 (ADC1)',
    icon: 'Turbidity',
  },
  bme280: {
    id: 'bme280',
    name: 'Sensor ambiental BME280',
    model: 'Bosch BME280 (Gravity / breakout I2C)',
    manufacturer: 'Bosch Sensortec',
    parameter: 'Ambiente (T, HR, presión)',
    sensorKey: 'humedad',
    range: 'T: −40–85 °C · HR: 0–100 % · P: 300–1100 hPa',
    accuracy: '±1 °C · ±3 % HR · ±1 hPa',
    interface: 'I2C',
    voltage: '3.3 V',
    currentMa: 0.4,
    currentTyp: '0.4 mA típico (modo normal)',
    powerW: 0.0013,
    description:
      'Mide condiciones del aire alrededor del sistema (no sumergible). Útil para monitorear humedad del invernadero, temperatura ambiente y presión atmosférica.',
    location: 'Ambiente · cerca del cultivo',
    pin: 'GPIO 21 (SDA) · GPIO 22 (SCL)',
    icon: 'Cloud',
  },
  cam1: {
    id: 'cam1',
    name: 'Cámara 1 — Pecera',
    model: 'ESP32-CAM (OV2640)',
    manufacturer: 'Espressif / Generic',
    parameter: 'Video',
    sensorKey: null,
    range: 'Resolución 1600×1200 (UXGA)',
    accuracy: 'Hasta 30 fps a 800×600',
    interface: 'Wi-Fi (MJPEG / RTSP)',
    voltage: '5 V',
    currentMa: 180,
    currentTyp: '180 mA promedio · picos hasta 310 mA en transmisión',
    powerW: 0.9,
    description:
      'Cámara dentro de la pecera con visión nocturna IR. Stream MJPEG hacia el dashboard para monitoreo de los peces.',
    location: 'Pecera · vista lateral',
    pin: 'Stream HTTP',
    icon: 'Camera',
  },
  cam2: {
    id: 'cam2',
    name: 'Cámara 2 — Cultivo',
    model: 'ESP32-CAM (OV2640)',
    manufacturer: 'Espressif / Generic',
    parameter: 'Video',
    sensorKey: null,
    range: 'Resolución 1600×1200 (UXGA)',
    accuracy: 'Hasta 30 fps a 800×600',
    interface: 'Wi-Fi (MJPEG / RTSP)',
    voltage: '5 V',
    currentMa: 180,
    currentTyp: '180 mA promedio · picos hasta 310 mA en transmisión',
    powerW: 0.9,
    description:
      'Cámara cenital sobre la cama de cultivo. Monitorea crecimiento de las plantas y permite análisis visual.',
    location: 'Cama de cultivo · vista cenital',
    pin: 'Stream HTTP',
    icon: 'Camera',
  },
};

export function getSensorInfo(id) {
  return SENSORS_INFO[id] ?? null;
}

// Devuelve la ficha del dispositivo a partir de la clave del sensor
// (p. ej. 'temperatura' → ficha del termómetro).
export function getInfoBySensorKey(sensorKey) {
  return (
    Object.values(SENSORS_INFO).find((s) => s.sensorKey === sensorKey) ?? null
  );
}

// Consumo total. Si se pasa una lista de ids, solo suma esos dispositivos.
export function getTotalConsumption(ids = null) {
  const items = ids
    ? ids.map((id) => SENSORS_INFO[id]).filter(Boolean)
    : Object.values(SENSORS_INFO);
  const totalMa = items.reduce((acc, s) => acc + (s.currentMa || 0), 0);
  const totalW = items.reduce((acc, s) => acc + (s.powerW || 0), 0);
  return { totalMa, totalW };
}
