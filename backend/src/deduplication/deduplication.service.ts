import {
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IdempotencyKey,
  IdempotencyKeyDocument,
} from './schemas/idempotency-key.schema';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);
  // Cache en memoria con límite de 2000 entradas para cuando MongoDB no está disponible
  private readonly memoryCache = new Map<
    string,
    { status: number; body: any; expiresAt: number; qos: number }
  >();

  constructor(
    @Optional()
    @InjectModel(IdempotencyKey.name)
    private readonly model?: Model<IdempotencyKeyDocument>,
  ) {}

  /**
   * Comprueba si una clave de mensaje ya fue procesada anteriormente.
   * Si ya existe, retorna el registro existente para devolver un ACK idempotente.
   */
  async checkDuplicate(
    messageId: string,
    endpoint: string,
  ): Promise<{ isDuplicate: boolean; response?: any; status?: number }> {
    if (!messageId) return { isDuplicate: false };

    const lookupKey = `${endpoint}::${messageId}`;

    // 1. Revisar en MongoDB si está activo
    if (this.model) {
      try {
        const found = await this.model.findOne({ key: lookupKey }).lean().exec();
        if (found) {
          this.logger.log(`[Deduplicación] Mensaje duplicado detectado (QoS ${found.qos}): ${messageId}`);
          return {
            isDuplicate: true,
            status: found.responseStatus || 200,
            response: {
              ...found.responseBody,
              _deduplicated: true,
              _messageId: messageId,
              _ack: 'EXACTLY_ONCE_ACK',
            },
          };
        }
      } catch (err) {
        this.logger.warn(`Error consultando deduplicación en MongoDB: ${(err as Error).message}`);
      }
    }

    // 2. Revisar en memoria (fallback)
    const mem = this.memoryCache.get(lookupKey);
    if (mem && mem.expiresAt > Date.now()) {
      this.logger.log(`[Deduplicación Memoria] Mensaje duplicado detectado: ${messageId}`);
      return {
        isDuplicate: true,
        status: mem.status,
        response: {
          ...mem.body,
          _deduplicated: true,
          _messageId: messageId,
          _ack: 'EXACTLY_ONCE_ACK',
        },
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Almacena una clave de idempotencia una vez que el mensaje ha sido procesado con éxito.
   */
  async storeKey(
    messageId: string,
    endpoint: string,
    status: number,
    responseBody: any,
    qos = 2,
  ): Promise<void> {
    if (!messageId) return;

    const lookupKey = `${endpoint}::${messageId}`;

    if (this.model) {
      try {
        await this.model.create({
          key: lookupKey,
          endpoint,
          qos,
          responseStatus: status,
          responseBody,
          createdAt: new Date(),
        });
      } catch (err) {
        // En concurrencia alta, si se inserta duplicada al mismo milisegundo, la clave única lo previene
        this.logger.debug(`Clave ya registrada: ${(err as Error).message}`);
      }
    }

    // Guardar en memoria (TTL de 24 horas)
    this.memoryCache.set(lookupKey, {
      status,
      body: responseBody,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      qos,
    });

    // Limpieza preventiva si supera 2000 elementos
    if (this.memoryCache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.expiresAt <= now) this.memoryCache.delete(k);
      }
    }
  }
}
