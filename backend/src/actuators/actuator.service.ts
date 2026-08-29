import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription } from 'rxjs';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { MqttService } from '../mqtt/mqtt.service';
import { buildPublishTopic } from '../mqtt/topics.constants';
import {
  Actuator,
  ActuatorAction,
  ActuatorDocument,
  ActuatorMode,
  ActuatorLock,
} from './schemas/actuator.schema';
import {
  ActuatorActionLog,
  ActuatorActionDocument,
} from './schemas/actuator-action.schema';
import { NotificationService } from '../notifications/notification.service';
import {
  ActuatorPatch,
  ActuatorRecord,
  ActuatorStore,
  MemoryActuatorStore,
} from './actuator.store';

export type { ActuatorMode, ActuatorAction } from './schemas/actuator.schema';

export interface ActuatorStatus {
  id: string;
  label: string;
  kind: string;
  mode: ActuatorMode;
  on: boolean;
  minStateMs: number;
  lastChangeAt: string | null;
  lastReason: string | null;
  lastActor: string | null;
  lock: { clientId: string; expiresAt: string } | null;
}

export interface ExecuteOpts {
  reason?: string;
  actor?: 'user' | 'ia' | 'emergency' | 'auto';
  /** Permite ejecutar aunque el modo sea manual (usado por emergencias). */
  bypassMode?: boolean;
}

const ACTUATOR_SEED: Array<{
  id: string;
  label: string;
  kind: 'pump' | 'aerator' | 'feeder';
  defaultMode: ActuatorMode;
}> = [
  { id: 'bomba_agua', label: 'Bomba de agua', kind: 'pump', defaultMode: 'ia' },
  { id: 'aireador', label: 'Aireador', kind: 'aerator', defaultMode: 'ia' },
  { id: 'dispensador_comida', label: 'Dispensador de comida', kind: 'feeder', defaultMode: 'manual' },
];

const ACTUATOR_LABELS: Record<string, string> = {
  bomba_agua: 'Bomba de agua',
  aireador: 'Aireador',
  dispensador_comida: 'Dispensador de comida',
};

/** Adaptador de `ActuatorStore` respaldado por Mongoose. */
class MongoActuatorStore implements ActuatorStore {
  readonly persistent = true;

  constructor(private readonly model: Model<ActuatorDocument>) {}

  async findAll(): Promise<ActuatorRecord[]> {
    const docs = await this.model.find().sort({ id: 1 }).lean();
    return docs.map((d) => this.toRecord(d));
  }

  async findOne(id: string): Promise<ActuatorRecord | null> {
    const doc = await this.model.findOne({ id }).lean();
    return doc ? this.toRecord(doc) : null;
  }

  async create(record: ActuatorRecord): Promise<void> {
    await this.model.create(record);
  }

  async update(id: string, patch: ActuatorPatch): Promise<void> {
    await this.model.updateOne({ id }, { $set: { ...patch, updatedAt: new Date() } });
  }

  private toRecord(doc: Record<string, any>): ActuatorRecord {
    return {
      id: doc.id,
      label: doc.label,
      kind: doc.kind,
      mode: doc.mode,
      on: Boolean(doc.on),
      minStateMs: doc.minStateMs,
      lastChangeAt: doc.lastChangeAt ?? 0,
      lastReason: doc.lastReason ?? null,
      lastActor: doc.lastActor ?? null,
      currentLock: doc.currentLock ?? null,
    };
  }
}

@Injectable()
export class ActuatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActuatorService.name);
  private subscription: Subscription | null = null;
  private minStateMs = 60_000;
  private lockTtlMs = 10_000;
  private prefix = 'aquaponic';
  private allowManualUserOverride = true;
  private store!: ActuatorStore;

  constructor(
    private readonly mqtt: MqttService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    @Optional()
    @InjectModel(Actuator.name)
    private readonly model?: Model<ActuatorDocument>,
    @Optional()
    @InjectModel(ActuatorActionLog.name)
    private readonly logModel?: Model<ActuatorActionDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.minStateMs = this.config.get<number>('actuators.minStateMs', 60_000);
    this.lockTtlMs = this.config.get<number>('actuators.lockTtlMs', 10_000);
    this.prefix = this.config.get<string>('mqtt.topicPrefix', 'aquaponic');
    this.allowManualUserOverride = this.config.get<boolean>(
      'actuators.allowManualUserOverride',
      true,
    );
    if (this.allowManualUserOverride) {
      this.logger.warn(
        'Modo manual permite acciones del operador (ACTUATORS_ALLOW_MANUAL_USER_OVERRIDE=false para bloquearlo)',
      );
    }

    // Sin MONGODB_URI el módulo se registra sin modelos: usamos un store en
    // memoria para que la bomba/aireador sigan siendo controlables.
    this.store = this.model
      ? new MongoActuatorStore(this.model)
      : new MemoryActuatorStore();
    if (!this.store.persistent) {
      this.logger.warn(
        'MONGODB_URI no configurado: actuadores en memoria (el estado se pierde al reiniciar)',
      );
    }

    await this.seed();

    this.subscription = this.mqtt.messages$.subscribe(({ topic, payload }) => {
      this.handleStatusMessage(topic, payload);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private async seed(): Promise<void> {
    for (const seed of ACTUATOR_SEED) {
      const exists = await this.store.findOne(seed.id);
      if (!exists) {
        await this.store.create({
          id: seed.id,
          label: seed.label,
          kind: seed.kind,
          mode: seed.defaultMode,
          on: false,
          minStateMs: this.minStateMs,
          lastChangeAt: 0,
          currentLock: null,
        });
        this.logger.log(`Actuador inicializado: ${seed.id} (${seed.defaultMode})`);
      }
    }
  }

  async list(): Promise<ActuatorStatus[]> {
    const records = await this.store.findAll();
    const now = Date.now();
    return records.map((d) => this.toStatus(d, now));
  }

  async getStatus(id: string): Promise<ActuatorStatus | null> {
    const record = await this.store.findOne(id);
    if (!record) return null;
    return this.toStatus(record, Date.now());
  }

  private toStatus(record: ActuatorRecord, now: number): ActuatorStatus {
    return {
      id: record.id,
      label: record.label,
      kind: record.kind,
      mode: record.mode,
      on: Boolean(record.on),
      minStateMs: this.minStateMs,
      lastChangeAt: record.lastChangeAt
        ? new Date(record.lastChangeAt).toISOString()
        : null,
      lastReason: record.lastReason ?? null,
      lastActor: record.lastActor ?? null,
      lock: this.serializeLock(record.currentLock, now),
    };
  }

  async setMode(id: string, mode: ActuatorMode): Promise<ActuatorStatus | null> {
    const record = await this.store.findOne(id);
    if (!record) return null;
    await this.store.update(id, { mode });
    this.logger.log(`Actuador ${id} → modo ${mode}`);
    return this.getStatus(id);
  }

  async acquireLock(id: string, clientId: string): Promise<ActuatorStatus | null> {
    const now = Date.now();
    const expiresAt = new Date(now + this.lockTtlMs);
    const record = await this.store.findOne(id);
    if (!record) return null;

    const lock = this.serializeLock(record.currentLock, now);
    if (lock && lock.clientId !== clientId) {
      return null;
    }

    await this.store.update(id, { currentLock: { clientId, expiresAt } });
    return this.getStatus(id);
  }

  async releaseLock(id: string, clientId: string): Promise<ActuatorStatus | null> {
    const record = await this.store.findOne(id);
    if (!record) return null;
    if (record.currentLock && record.currentLock.clientId !== clientId) {
      return this.getStatus(id);
    }
    await this.store.update(id, { currentLock: null });
    return this.getStatus(id);
  }

  async execute(
    id: string,
    action: ActuatorAction,
    opts: ExecuteOpts = {},
  ): Promise<{ ok: boolean; reason?: string; status?: ActuatorStatus | null }> {
    const record = await this.store.findOne(id);
    if (!record) return { ok: false, reason: `Actuador no encontrado: ${id}` };

    const actor = opts.actor ?? 'user';
    const reason = opts.reason ?? '';

    // El modo manual bloquea a la IA y a los automatismos, pero el operador
    // (actor `user`, botones de la web) sí puede accionar cuando el override
    // está habilitado. Las emergencias siempre pasan.
    const actorAllowedInManual =
      actor === 'emergency' || (this.allowManualUserOverride && actor === 'user');

    if (record.mode === 'manual' && !actorAllowedInManual && !opts.bypassMode) {
      return {
        ok: false,
        reason: `Actuador en modo manual. Solo el operador o emergencias pueden actuar.`,
      };
    }

    const now = Date.now();
    if (
      record.lastChangeAt &&
      now - record.lastChangeAt < this.minStateMs &&
      actor !== 'emergency'
    ) {
      return {
        ok: false,
        reason: `Anti-ciclado: faltan ${Math.round((this.minStateMs - (now - record.lastChangeAt)) / 1000)}s`,
      };
    }

    const desiredOn = action === 'on' || action === 'dispense';
    const previousOn = Boolean(record.on);

    const payload = {
      actuator: id,
      action,
      reason,
      actor,
      mode: record.mode,
      timestamp: new Date().toISOString(),
    };

    const topic = buildPublishTopic(this.prefix, 'commands', id);
    // Los comandos son eventos puntuales: no se retienen, porque si no la
    // ESP32 volvería a ejecutar el último comando cada vez que se reconecta.
    const sent = this.mqtt.publish(topic, payload, false);
    if (!sent) {
      this.logger.warn(`No se pudo publicar comando en ${topic}`);
    }

    // Publicamos también el estado esperado para que el ESP32 (u otros
    // suscriptores) reflejen el cambio en LEDs/indicadores sin depender de
    // que el actuador físico reenvíe su estado de vuelta.
    const statusTopic = buildPublishTopic(this.prefix, 'actuators/status', id);
    const statusPayload = {
      on: desiredOn,
      reason,
      actor,
      ts: new Date().toISOString(),
    };
    const statusSent = this.mqtt.publish(statusTopic, statusPayload, false);
    if (!statusSent) {
      this.logger.warn(`No se pudo publicar estado en ${statusTopic}`);
    } else {
      this.logger.debug(`Estado publicado → ${statusTopic}: ${JSON.stringify(statusPayload)}`);
    }

    await this.store.update(id, {
      on: desiredOn,
      lastChangeAt: now,
      lastReason: reason,
      lastActor: actor,
    });

    await this.logAction(id, action, actor, reason);
    this.logger.log(
      `[${actor}] ${id} → ${action} (${record.mode}) — ${reason || 'sin motivo'}`,
    );

    if (previousOn !== desiredOn) {
      void this.notify(id, action, actor, reason);
      // Notificación central (WebSocket en tiempo real + email/telegram según
      // NOTIFICATIONS_CHANNELS). Cooldown por (actuatorId + action) para no
      // spamear si el operador hace varios toggles seguidos.
      const label = ACTUATOR_LABELS[id] ?? id;
      const verb = action === 'on' ? 'ENCENDIDO' : action === 'dispense' ? 'DISPENSAR' : 'APAGADO';
      void this.notifications.emit({
        category: 'actuator-change',
        severity: action === 'off' ? 'warn' : 'info',
        title: `${label} ${verb}`,
        message: reason || 'Sin motivo especificado',
        dedupeKey: `actuator:${id}:${action}`,
        source: actor === 'emergency' ? 'emergency' : actor === 'ia' ? 'ia' : 'user',
        meta: { actuatorId: id, action, actor, reason },
      });
    }

    return { ok: true, status: await this.getStatus(id) };
  }

  private async logAction(
    id: string,
    action: string,
    actor: string,
    reason: string,
  ): Promise<void> {
    if (!this.logModel) return;
    try {
      await this.logModel.create({
        actuatorId: id,
        action,
        actor,
        reason,
        source: 'actuator',
        ts: new Date(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`No se pudo registrar acción: ${msg}`);
    }
  }

  private async notify(id: string, action: string, actor: string, reason: string): Promise<void> {
    const label = ACTUATOR_LABELS[id] ?? id;
    const verb = action === 'on' ? 'ENCENDIDO' : action === 'dispense' ? 'DISPENSAR' : 'APAGADO';
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });

    const subject = `[AquaGia] ${label} ${verb}`;
    const text = `${label} ${verb}\nMotivo: ${reason || 'n/d'}\nActor: ${actor}\nFecha: ${timestamp}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:#0a0a0a;color:#fff;padding:14px 20px"><h2 style="margin:0;font-size:16px">${label} ${verb}</h2></div>
        <div style="padding:18px;color:#0a0a0a;font-size:14px">
          <p><b>Motivo:</b> ${reason || 'n/d'}</p>
          <p><b>Actor:</b> ${actor}</p>
          <p><b>Fecha:</b> ${timestamp}</p>
        </div>
      </div>`;

    const telegramText = `🔧 <b>${label}</b> ${verb}\n<b>Motivo:</b> ${reason || 'n/d'}\n<b>Actor:</b> ${actor}\n<b>Fecha:</b> ${timestamp}`;

    await Promise.all([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);
  }

  private handleStatusMessage(topic: string, raw: string): void {
    if (!topic.includes('/actuators/status/')) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;
    const record = data as Record<string, unknown>;
    const id = topic.split('/').pop();
    if (!id) return;
    const on = Boolean(record.on);
    const reason = typeof record.reason === 'string' ? record.reason : '';
    const actor = typeof record.actor === 'string' ? record.actor : 'esp32';
    void this.store.update(id, {
      on,
      lastReason: reason,
      lastActor: actor,
      lastChangeAt: Date.now(),
    });
  }

  private serializeLock(lock: ActuatorLock | null | undefined, now: number): ActuatorStatus['lock'] {
    if (!lock) return null;
    const expires = new Date(lock.expiresAt).getTime();
    if (expires <= now) return null;
    return { clientId: lock.clientId, expiresAt: new Date(expires).toISOString() };
  }
}
