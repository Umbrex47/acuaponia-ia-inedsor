import { ActuatorLock, ActuatorMode } from './schemas/actuator.schema';

/**
 * Representación mínima de un actuador, independiente de Mongoose.
 * Permite que `ActuatorService` opere igual con MongoDB o en memoria.
 */
export interface ActuatorRecord {
  id: string;
  label: string;
  kind: string;
  mode: ActuatorMode;
  on: boolean;
  minStateMs: number;
  lastChangeAt: number;
  lastReason?: string | null;
  lastActor?: string | null;
  currentLock?: ActuatorLock | null;
}

export type ActuatorPatch = Partial<Omit<ActuatorRecord, 'id'>>;

/**
 * Contrato de persistencia de actuadores. Implementado por
 * `MongoActuatorStore` (producción) y `MemoryActuatorStore` (sin MONGODB_URI).
 */
export interface ActuatorStore {
  readonly persistent: boolean;
  findAll(): Promise<ActuatorRecord[]>;
  findOne(id: string): Promise<ActuatorRecord | null>;
  create(record: ActuatorRecord): Promise<void>;
  update(id: string, patch: ActuatorPatch): Promise<void>;
}

/**
 * Store en memoria: mantiene el estado de los actuadores en el proceso.
 * El estado se pierde al reiniciar el backend, pero permite controlar bomba,
 * aireador y dispensador sin depender de una base de datos.
 */
export class MemoryActuatorStore implements ActuatorStore {
  readonly persistent = false;
  private readonly records = new Map<string, ActuatorRecord>();

  async findAll(): Promise<ActuatorRecord[]> {
    return [...this.records.values()]
      .map((r) => ({ ...r }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async findOne(id: string): Promise<ActuatorRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async create(record: ActuatorRecord): Promise<void> {
    this.records.set(record.id, { ...record });
  }

  async update(id: string, patch: ActuatorPatch): Promise<void> {
    const current = this.records.get(id);
    if (!current) return;
    this.records.set(id, { ...current, ...patch });
  }
}
