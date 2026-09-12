import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Optional,
} from '@nestjs/common';
import { FishAssessmentService } from './fish-assessment.service';
import { ReadingsService } from '../readings/readings.service';
import { FishObservationDto } from '../readings/dto/create-manual-reading.dto';
import { DeduplicationService } from '../deduplication/deduplication.service';

@Controller('fish')
export class FishController {
  constructor(
    private readonly fishAssessment: FishAssessmentService,
    private readonly readings: ReadingsService,
    @Optional() private readonly dedup?: DeduplicationService,
  ) {}

  /**
   * Estado unificado de los peces para la app móvil y el dashboard:
   * - Telemetría en vivo de visión artificial (YOLO/SORT: conteo, actividad, postura, cámara).
   * - Último registro de inspección manual (mortalidad, peso promedio, conducta reportada).
   * - Evaluación de riesgo ambiental para la especie (Tilapia).
   */
  @Get('status')
  async getFishStatus() {
    const aiTelemetry = this.fishAssessment.getLastFish();
    const latestManual = await this.readings.findLatestManual();

    return {
      species: 'Tilapia Roja',
      aiTelemetry: aiTelemetry || {
        count: null,
        mood: 'Monitoreando',
        behavior: { activityState: 'normal', activityScore: 75 },
        cameraStatus: 'offline',
      },
      latestObservation: latestManual?.fishObservation || null,
      lastInspectedAt: latestManual?.timestamp || null,
      lastInspectedBy: latestManual?.operator || null,
      notes: latestManual?.notes || '',
    };
  }

  /**
   * Registra una observación manual del estado de los peces desde la app móvil.
   * Ej: POST /fish/observation
   * {
   *   "operator": "Khris",
   *   "mortalityCount": 0,
   *   "behaviorNotes": "Peces nadando en cardumen activo, apetito vigoroso",
   *   "averageWeightGrams": 45.2,
   *   "generalHealth": "excelente"
   * }
   */
  @Post('observation')
  async recordObservation(
    @Body()
    body: {
      operator: string;
      operatorRole?: string;
      mortalityCount?: number;
      behaviorNotes?: string;
      averageWeightGrams?: number;
      feedAmountGrams?: number;
      generalHealth?: 'excelente' | 'bueno' | 'regular' | 'critico';
      notes?: string;
      timestamp?: string;
      messageId?: string;
      qos?: number;
    },
    @Headers('x-message-id') headerMessageId?: string,
    @Headers('x-qos') headerQos?: string,
  ) {
    if (!body?.operator?.trim()) {
      throw new BadRequestException('El campo "operator" es obligatorio');
    }

    const messageId = headerMessageId || (body as any).messageId;
    const qos = Number(headerQos || (body as any).qos || 1);

    if (this.dedup && messageId) {
      const check = await this.dedup.checkDuplicate(messageId, 'POST /fish/observation');
      if (check.isDuplicate) {
        return check.response;
      }
    }

    const fishObservation: FishObservationDto = {
      mortalityCount: Number(body.mortalityCount ?? 0),
      behaviorNotes: body.behaviorNotes || '',
      averageWeightGrams: body.averageWeightGrams ? Number(body.averageWeightGrams) : undefined,
      feedAmountGrams: body.feedAmountGrams ? Number(body.feedAmountGrams) : undefined,
      generalHealth: body.generalHealth || 'bueno',
    };

    const result = await this.readings.recordManualSample({
      operator: body.operator.trim(),
      operatorRole: body.operatorRole,
      timestamp: body.timestamp || new Date().toISOString(),
      values: {},
      notes: body.notes || `Inspección de peces: ${fishObservation.generalHealth}`,
      fishObservation,
      source: 'mobile-app',
    });

    if (this.dedup && messageId) {
      await this.dedup.storeKey(messageId, 'POST /fish/observation', 201, result, qos);
    }

    return result;
  }
}
