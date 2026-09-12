import { Controller, Get } from '@nestjs/common';
import { DebugService, MqttDebugSnapshot } from './debug.service';

/**
 * Endpoints de diagnóstico. No requieren API key: son de solo lectura
 * y devuelven datos no sensibles (último payload MQTT y marcas de
 * tiempo de cada sensor). Pensados para validar el cableado y la
 * publicación de la ESP32 sin abrir el monitor serie.
 */
@Controller('api/debug')
export class DebugController {
  constructor(private readonly debug: DebugService) {}

  /**
   * Devuelve el último payload MQTT recibido y la última vez que se
   * vio cada sensor conocido.
   *
   * Si un sensor aparece con `value: null` o `lastAt` muy viejo, la
   * ESP32 no lo está reportando. Esto suele pasar cuando:
   *   - el sensor no está conectado (pull-up faltante, cable suelto);
   *   - la dirección I2C del BME280 no coincide (0x76/0x77);
   *   - el firmware tiene `valid=false` y omite el sensor del payload.
   */
  @Get('last-mqtt')
  getLastMqtt(): MqttDebugSnapshot {
    return this.debug.getSnapshot();
  }
}