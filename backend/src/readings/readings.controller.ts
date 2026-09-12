import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Optional,
} from '@nestjs/common';
import { ReadingsService } from './readings.service';
import { CreateManualReadingDto } from './dto/create-manual-reading.dto';
import { SENSOR_THRESHOLDS } from '../alerts/thresholds';
import { DeduplicationService } from '../deduplication/deduplication.service';

@Controller('readings')
export class ReadingsController {
  constructor(
    private readonly readings: ReadingsService,
    @Optional() private readonly dedup?: DeduplicationService,
  ) {}

  /**
   * Registra una medición manual desde la app móvil o web.
   * Guarda quién lo hizo (operator), cuándo (timestamp), valores y observaciones.
   * Soporta capas de fidelidad MQTT (QoS 0, 1, 2) y deduplicación idempotente.
   */
  @Post('manual')
  async createManualSample(
    @Body() body: CreateManualReadingDto & { messageId?: string; qos?: number },
    @Headers('x-message-id') headerMessageId?: string,
    @Headers('x-qos') headerQos?: string,
  ) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('El cuerpo de la solicitud es inválido');
    }

    if (!body.operator || !body.operator.trim()) {
      throw new BadRequestException('El campo "operator" (quién realizó la medición) es obligatorio');
    }

    if (!body.values || typeof body.values !== 'object' || Object.keys(body.values).length === 0) {
      throw new BadRequestException('Debe proporcionar al menos una variable numérica en "values"');
    }

    const messageId = headerMessageId || body.messageId;
    const qos = Number(headerQos || body.qos || 1);

    // Verificación de deduplicación (QoS 2: Exactly Once)
    if (this.dedup && messageId) {
      const check = await this.dedup.checkDuplicate(messageId, 'POST /readings/manual');
      if (check.isDuplicate) {
        return check.response;
      }
    }

    const result = await this.readings.recordManualSample(body);

    if (this.dedup && messageId) {
      await this.dedup.storeKey(messageId, 'POST /readings/manual', 201, result, qos);
    }

    return result;
  }

  /**
   * Historial de mediciones manuales con auditoría (quién y a qué hora).
   * Ej: GET /readings/manual?limit=20&operator=Juan
   */
  @Get('manual')
  async listManual(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('operator') operator?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.readings.findManualHistory({
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
      operator,
      fromDate,
      toDate,
    });
  }

  /**
   * Último registro manual tomado con sus evaluaciones de riesgo.
   * Ej: GET /readings/manual/latest
   */
  @Get('manual/latest')
  async latestManual() {
    const latest = await this.readings.findLatestManual();
    if (!latest) {
      return { message: 'No hay registros manuales aún', data: null };
    }
    return latest;
  }

  /**
   * Detalle de un muestreo manual específico por su ID.
   * Ej: GET /readings/manual/66e2a7b8c...
   */
  @Get('manual/:id')
  async getManualById(@Param('id') id: string) {
    const record = await this.readings.findManualById(id);
    if (!record) {
      throw new NotFoundException(`Registro manual con ID ${id} no encontrado`);
    }
    return record;
  }

  /**
   * Metadatos de umbrales y rangos óptimos para que la app móvil valide en tiempo real.
   * Ej: GET /readings/thresholds
   */
  @Get('thresholds')
  getThresholds() {
    return SENSOR_THRESHOLDS;
  }

  /** Historial reciente de lecturas (IoT o manuales). Ej: GET /readings?sensor=ph&limit=50 */
  @Get()
  async list(
    @Query('sensor') sensor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return this.readings.findRecent(sensor, parsedLimit);
  }

  /** Última lectura por sensor. Ej: GET /readings/latest */
  @Get('latest')
  async latest() {
    return this.readings.findLatestBySensor();
  }
}
