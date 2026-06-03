import {
  Controller,
  Get,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReadingsService } from './readings.service';

@Controller('readings')
export class ReadingsController {
  constructor(private readonly readings: ReadingsService) {}

  /** Historial reciente. Ej: GET /readings?sensor=temperatura&limit=50 */
  @Get()
  async list(
    @Query('sensor') sensor?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureEnabled();
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return this.readings.findRecent(sensor, parsedLimit);
  }

  /** Última lectura por sensor. Ej: GET /readings/latest */
  @Get('latest')
  async latest() {
    this.ensureEnabled();
    return this.readings.findLatestBySensor();
  }

  private ensureEnabled(): void {
    if (!this.readings.isEnabled) {
      throw new ServiceUnavailableException(
        'El registro en base de datos no está configurado (MONGODB_URI)',
      );
    }
  }
}
