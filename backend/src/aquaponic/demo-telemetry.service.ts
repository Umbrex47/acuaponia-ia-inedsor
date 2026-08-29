import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import { buildPublishTopic, MQTT_TOPIC_SEGMENTS } from '../mqtt/topics.constants';
import { AquaponicGateway } from './aquaponic.gateway';

export type DemoScenario =
  | 'stable'
  | 'realistic'
  | 'unstable'
  | 'chaotic'
  | 'lowOxygen'
  | 'lowPh'
  | 'highTurbidity'
  | 'highEC'
  | 'dryTank'
  | 'normalization';

export type SensorChangeProfile = 'fast' | 'medium' | 'slow';

interface DemoSensor {
  min: number;
  max: number;
  optimal: [number, number];
  /** Velocidad de cambio relativa al rango total por iteración. */
  maxChangePct: number;
  decimals: number;
  /**
   * Perfil de cambio:
   *  - fast   (oxígeno, pH, turbidez): varía cada tick, ruidoso.
   *  - medium (temperatura, EC, nitratos): varía con cadencia moderada.
   *  - slow   (presión, humedad, tempAmbiente): rara vez se mueve.
   *  Esto refleja la dinámica real: la presión barométrica no salta cada 5 s.
   */
  changeProfile: SensorChangeProfile;
  /** Tiempo mínimo (ms) entre cambios significativos del valor (no del ruido). */
  driftCooldownMs: number;
}

interface ScenarioTarget {
  key: string;
  target: number;
  strength: number;
}

interface NormalizationState {
  /** Centro del rango óptimo hacia donde se va a normalizar. */
  target: number;
  /** Cuándo se permite aplicar el siguiente paso de la rampa. */
  nextStepAt: number;
  /** Pasos ya aplicados. */
  steps: number;
  /** Timestamp de cuándo se inició la normalización. */
  startedAt: number;
}

// Rangos calibrados para clima tropical de Cartagena (Colombia).
// Temperaturas bajas de agua (<22 °C) o ambiente (<22 °C) no son realistas.
const DEMO_SENSORS: Record<string, DemoSensor> = {
  temperatura: { min: 20, max: 32, optimal: [25.5, 29], maxChangePct: 0.4, decimals: 1, changeProfile: 'medium', driftCooldownMs: 30_000 },
  ph: { min: 5, max: 9, optimal: [6.5, 7.5], maxChangePct: 1.0, decimals: 2, changeProfile: 'fast', driftCooldownMs: 5_000 },
  oxigeno: { min: 2, max: 12, optimal: [6, 9], maxChangePct: 2.0, decimals: 1, changeProfile: 'fast', driftCooldownMs: 5_000 },
  nivelAgua: { min: 0, max: 32, optimal: [24, 32], maxChangePct: 1.0, decimals: 1, changeProfile: 'medium', driftCooldownMs: 15_000 },
  nitratos: { min: 0, max: 50, optimal: [5, 40], maxChangePct: 0.4, decimals: 0, changeProfile: 'medium', driftCooldownMs: 30_000 },
  co2: { min: 200, max: 1200, optimal: [350, 600], maxChangePct: 0.2, decimals: 0, changeProfile: 'medium', driftCooldownMs: 30_000 },
  electroconductividad: { min: 0, max: 4, optimal: [1, 1.8], maxChangePct: 0.5, decimals: 2, changeProfile: 'medium', driftCooldownMs: 30_000 },
  turbiedad: { min: 0, max: 50, optimal: [0, 10], maxChangePct: 2.0, decimals: 1, changeProfile: 'fast', driftCooldownMs: 5_000 },
  temperaturaAmbiente: { min: 22, max: 38, optimal: [26, 32], maxChangePct: 0.15, decimals: 1, changeProfile: 'slow', driftCooldownMs: 60_000 },
  humedad: { min: 50, max: 100, optimal: [70, 90], maxChangePct: 0.25, decimals: 0, changeProfile: 'slow', driftCooldownMs: 60_000 },
  presion: { min: 990, max: 1025, optimal: [1005, 1015], maxChangePct: 0.04, decimals: 0, changeProfile: 'slow', driftCooldownMs: 120_000 },
};

const SCENARIO_TARGETS: Record<DemoScenario, ScenarioTarget[]> = {
  stable: [],
  realistic: [],
  // Inestable: pH y oxígeno bajan lo suficiente para que la IA encienda
  // el aireador; turbiedad sube para alertar limpieza de filtros.
  unstable: [
    { key: 'ph', target: 5.8, strength: 3.0 },
    { key: 'oxigeno', target: 3.5, strength: 3.0 },
    { key: 'turbiedad', target: 40, strength: 2.0 },
  ],
  // Caótico: múltiples parámetros fuera de rango con cambios rápidos.
  chaotic: [
    { key: 'ph', target: 5.2, strength: 4.0 },
    { key: 'oxigeno', target: 2.0, strength: 4.0 },
    { key: 'turbiedad', target: 45, strength: 4.0 },
    { key: 'electroconductividad', target: 3.5, strength: 3.5 },
    { key: 'temperatura', target: 32.5, strength: 3.0 },
    { key: 'nivelAgua', target: 10, strength: 2.5 },
  ],
  lowOxygen: [{ key: 'oxigeno', target: 3.5, strength: 2.5 }],
  lowPh: [{ key: 'ph', target: 6.0, strength: 2.0 }],
  highTurbidity: [{ key: 'turbiedad', target: 40, strength: 2.5 }],
  highEC: [{ key: 'electroconductividad', target: 3.2, strength: 2.0 }],
  dryTank: [{ key: 'nivelAgua', target: 10, strength: 1.5 }],
  // `normalization` no tira de ningún sensor: la rampa la maneja
  // `nextValue` cuando `this.normalization` tiene una entrada.
  normalization: [],
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const round = (v: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

const SMOOTHING: Record<SensorChangeProfile, number> = {
  fast: 0.25,
  medium: 0.55,
  slow: 0.85,
};

/**
 * Genera telemetría simulada y la entrega al dashboard por WebSocket
 * (siempre) y por MQTT (si el broker está disponible).
 *
 * El generador aplica una caminata aleatoria suavizada para que los cambios
 * entre lecturas sean realistas (la presión atmosférica no salta de 900 a
 * 1085 en 5 s). Cada sensor tiene un `changeProfile` (`fast` / `medium` /
 * `slow`) que define con qué frecuencia se mueve su ruido de fondo.
 *
 * Además expone escenarios de prueba que tiran de un sensor hacia un valor
 * crítico y un escenario `normalization` (activado por el DecisionFlowService)
 * que devuelve suavemente los sensores afectados al centro del rango óptimo.
 */
@Injectable()
export class DemoTelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoTelemetryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly state = new Map<string, number>();
  /** Última vez que cada sensor tuvo un cambio significativo (no solo ruido). */
  private readonly lastDriftAt = new Map<string, number>();
  private readonly normalization = new Map<string, NormalizationState>();
  private scenario: DemoScenario = 'stable';
  /** Callback que se invoca cuando la normalización de un sensor termina. */
  private onRecoveryHook: ((sensorKey: string) => void) | null = null;
  /** Estado de la bomba de agua según los comandos MQTT recibidos. */
  private pumpOn = false;
  private mqttSubscription: Subscription | null = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly gateway: AquaponicGateway,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<boolean>('mqtt.demoEnabled', true);
    if (!enabled) return;

    const intervalMs = this.config.get<number>('mqtt.demoIntervalMs', 5000);
    const prefix = this.config.get<string>('mqtt.topicPrefix', 'aquaponic');
    const initialScenario = this.config.get<string>('demo.scenario', 'stable');
    this.scenario = this.isValidScenario(initialScenario)
      ? initialScenario
      : 'stable';

    const now = Date.now();
    for (const [key, def] of Object.entries(DEMO_SENSORS)) {
      this.state.set(key, (def.optimal[0] + def.optimal[1]) / 2);
      this.lastDriftAt.set(key, now);
    }

    this.logger.warn(
      `Modo demo activo — escenario "${this.scenario}" — enviando telemetría suavizada al dashboard`,
    );

    // Escuchamos los comandos de la bomba para que el nivel de agua responda
    // al estado del actuador: bomba on → nivel tiende a bajar; off → sube.
    this.mqttSubscription = this.mqtt.messages$.subscribe(({ topic, payload }) => {
      this.handleCommandMessage(topic, payload);
    });

    const sensorsTopic = buildPublishTopic(
      prefix,
      MQTT_TOPIC_SEGMENTS.sensors,
      'telemetry',
    );

    const publish = () => {
      const payload = this.buildPayload();
      const body = JSON.stringify(payload);

      this.gateway.broadcast(body);
      const mqttOk = this.mqtt.publish(sensorsTopic, payload);
      if (!mqttOk) {
        this.logger.debug('Demo: MQTT no conectado; solo WebSocket');
      }
    };

    publish();
    this.timer = setInterval(publish, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.mqttSubscription?.unsubscribe();
  }

  getScenario(): DemoScenario {
    return this.scenario;
  }

  setScenario(scenario: DemoScenario): { ok: boolean; scenario: DemoScenario; activeTargets: string[] } {
    if (!this.isValidScenario(scenario)) {
      return { ok: false, scenario: this.scenario, activeTargets: [] };
    }
    this.scenario = scenario;
    if (scenario !== 'normalization') {
      this.normalization.clear();
    }
    const activeTargets = SCENARIO_TARGETS[scenario].map((t) => t.key);
    this.logger.log(
      `Escenario demo cambiado → ${scenario} (${activeTargets.join(', ') || 'normalización activa'})`,
    );
    return { ok: true, scenario, activeTargets };
  }

  getStatus() {
    return {
      enabled: this.config.get<boolean>('mqtt.demoEnabled', true),
      scenario: this.scenario,
      intervalMs: this.config.get<number>('mqtt.demoIntervalMs', 5000),
      sensors: Object.keys(DEMO_SENSORS),
      normalizing: Array.from(this.normalization.keys()),
    };
  }

  /**
   * Activa el escenario `normalization` dirigido a los sensores recibidos.
   * Cada sensor se moverá con una rampa suave hacia el centro de su rango
   * óptimo, espaciada por `stepMs`. El DecisionFlowService cancela la
   * normalización (o deja que termine) según la siguiente lectura.
   */
  triggerIaRecovery(
    sensorKeys: string[],
    opts: { stepMs?: number; maxSteps?: number; tolerancePct?: number } = {},
  ): { ok: boolean; normalizing: string[] } {
    const stepMs = opts.stepMs ?? this.config.get<number>('decision.flow.normalizationStepMs', 5000);
    const maxSteps = opts.maxSteps ?? this.config.get<number>('decision.flow.normalizationMaxSteps', 20);
    const tolerancePct = opts.tolerancePct ?? this.config.get<number>('decision.flow.normalizationTolerancePct', 10);

    this.scenario = 'normalization';
    const now = Date.now();
    const keys: string[] = [];
    for (const key of sensorKeys) {
      const def = DEMO_SENSORS[key];
      if (!def) continue;
      const center = (def.optimal[0] + def.optimal[1]) / 2;
      this.normalization.set(key, {
        target: center,
        nextStepAt: now,
        steps: 0,
        startedAt: now,
      });
      keys.push(key);
    }
    this.logger.log(
      `Normalización IA activa: ${keys.join(', ')} (paso ${stepMs}ms, margen ${tolerancePct}%)`,
    );
    return { ok: keys.length > 0, normalizing: keys };
  }

  /**
   * Cancela la normalización de uno o todos los sensores. Útil cuando se
   * quiere volver al escenario `stable` antes de tiempo.
   */
  cancelNormalization(sensorKey?: string): void {
    if (!sensorKey) {
      this.normalization.clear();
      this.logger.log('Normalización IA cancelada para todos los sensores');
      return;
    }
    this.normalization.delete(sensorKey);
    this.logger.log(`Normalización IA cancelada para ${sensorKey}`);
  }

  isNormalizing(sensorKey: string): boolean {
    return this.normalization.has(sensorKey);
  }

  /** Registra el callback que se invoca cuando la normalización de un sensor
   *  termina (la usa DecisionFlowService para emitir ia-recovery). */
  setOnRecoveryHook(hook: (sensorKey: string) => void): void {
    this.onRecoveryHook = hook;
  }

  /** Lee comandos de actuadores para reflejar el estado de la bomba en la
   *  simulación del nivel de agua. */
  private handleCommandMessage(topic: string, raw: string): void {
    if (!topic || !topic.endsWith('/commands/bomba_agua')) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;
    const cmd = data as Record<string, unknown>;
    const action = typeof cmd.action === 'string' ? cmd.action : '';
    if (action === 'on') {
      this.pumpOn = true;
      this.logger.debug('Demo: bomba ON → nivel de agua tenderá a bajar');
    } else if (action === 'off') {
      this.pumpOn = false;
      this.logger.debug('Demo: bomba OFF → nivel de agua tenderá a subir');
    }
  }

  private isValidScenario(s: string): s is DemoScenario {
    return Object.prototype.hasOwnProperty.call(SCENARIO_TARGETS, s);
  }

  /**
   * Siguiente paso de la rampa de normalización. Devuelve el nuevo valor o
   * `null` si todavía no toca aplicar el siguiente step (devuelve el último
   * valor calculado para no evolucionar la rampa con ruido).
   */
  private applyNormalizationStep(
    key: string,
    def: DemoSensor,
    norm: NormalizationState,
    current: number,
    now: number,
  ): { value: number; finished: boolean } {
    const maxSteps = this.config.get<number>('decision.flow.normalizationMaxSteps', 20);
    const stepMs = this.config.get<number>('decision.flow.normalizationStepMs', 5000);
    const tolerancePct = this.config.get<number>('decision.flow.normalizationTolerancePct', 10);
    const halfRange = (def.optimal[1] - def.optimal[0]) / 2 || 1;
    const tolerance = Math.max(halfRange * (tolerancePct / 100), 0.001);

    if (Math.abs(current - norm.target) <= tolerance) {
      // Ya está en rango: terminar la normalización.
      return { value: norm.target, finished: true };
    }

    if (norm.steps >= maxSteps) {
      // Cuidamos el caso de pasos agotados: cerramos la normalización con el
      // último valor posible para no quedarnos oscilando.
      return { value: current, finished: true };
    }

    if (now < norm.nextStepAt) {
      // Todavía no toca el próximo step: devolvemos el último valor.
      return { value: current, finished: false };
    }

    // Step real: rampa del 25 % de la distancia hacia el target.
    const ratio = 0.25;
    const value = current + (norm.target - current) * ratio;
    norm.steps += 1;
    norm.nextStepAt = now + stepMs;
    return { value, finished: false };
  }

  /**
   * Caminata aleatoria con suavizado. Refleja la dinámica del sensor
   * según su `changeProfile` y su `driftCooldownMs`.
   */
  private applyRandomWalk(
    key: string,
    def: DemoSensor,
    current: number,
    now: number,
  ): number {
    const [lo, hi] = def.optimal;
    const center = (lo + hi) / 2;
    const halfRange = (hi - lo) / 2 || 1;
    const range = def.max - def.min;

    const maxChange = range * (def.maxChangePct / 100);
    const noise = (Math.random() * 2 - 1) * maxChange;
    const pull = ((center - current) / halfRange) * maxChange * 0.35;

    let scenarioPull = 0;
    const target = SCENARIO_TARGETS[this.scenario].find((t) => t.key === key);
    if (target) {
      const scenarioRange = def.max - def.min || 1;
      scenarioPull = ((target.target - current) / scenarioRange) * maxChange * target.strength;
    }

    const lastDrift = this.lastDriftAt.get(key) ?? 0;
    const driftElapsed = now - lastDrift;
    const allowBigDrift = driftElapsed >= def.driftCooldownMs;
    const driftFactor = allowBigDrift ? 1 : clamp(driftElapsed / def.driftCooldownMs, 0.05, 0.3);

    // Si la bomba de agua está encendida, el nivel tiende a bajar (drenaje);
    // si está apagada, tiende a recuperarse hacia el rango óptimo.
    let pumpPull = 0;
    if (key === 'nivelAgua') {
      // Bomba on → drenaje sostenido; off → recuperación hacia el óptimo.
      pumpPull = this.pumpOn ? -maxChange : maxChange * 0.3;
    }

    const targetValue = current + (noise + pull + scenarioPull + pumpPull) * driftFactor;

    const smoothing = SMOOTHING[def.changeProfile];
    let value = current * smoothing + targetValue * (1 - smoothing);

    // En escenarios activos permitimos que un sensor alcance su target
    // crítico; si no, nos quedamos cerca del rango óptimo.
    let margin: number;
    if (this.scenario === 'stable' || this.scenario === 'realistic') {
      margin = halfRange * 0.2;
    } else if (target) {
      margin = Math.max(halfRange * 1.5, Math.abs(target.target - center) + halfRange * 0.5);
    } else {
      margin = halfRange * 0.5;
    }
    value = clamp(value, lo - margin, hi + margin);
    value = clamp(value, def.min, def.max);

    if (allowBigDrift && Math.abs(value - current) > maxChange * 0.05) {
      this.lastDriftAt.set(key, now);
    }

    return value;
  }

  private nextValue(key: string, def: DemoSensor): number {
    const [, ] = def.optimal;
    const center = (def.optimal[0] + def.optimal[1]) / 2;
    const now = Date.now();
    const current = this.state.get(key) ?? center;

    // 1) Normalización: rampa suave hacia el target. Bloquea el ruido
    //    para que no contamine el camino de vuelta.
    const norm = this.normalization.get(key);
    if (norm) {
      const { value, finished } = this.applyNormalizationStep(key, def, norm, current, now);
      if (finished) {
        this.normalization.delete(key);
        this.state.set(key, norm.target);
        if (this.onRecoveryHook) {
          try {
            this.onRecoveryHook(key);
          } catch (err) {
            this.logger.warn(`onRecoveryHook error: ${(err as Error).message}`);
          }
        }
      } else {
        this.state.set(key, value);
      }
      return round(this.state.get(key) ?? norm.target, def.decimals);
    }

    // 2) Caminata aleatoria suave.
    const value = this.applyRandomWalk(key, def, current, now);
    this.state.set(key, value);
    return round(value, def.decimals);
  }

  private buildPayload() {
    const sensors: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(DEMO_SENSORS)) {
      const value = this.nextValue(key, def);
      const percent = clamp(
        Math.round(((value - def.min) / (def.max - def.min)) * 100),
        0,
        100,
      );
      sensors[key] = { value, percent, status: 'ok' };
    }

    return {
      sensors,
      source: 'demo',
      system: {
        status: this.normalization.size > 0 ? 'warning' : 'stable',
        statusLabel: this.normalization.size > 0 ? 'IA recuperando' : 'Estable',
      },
      normalizing: Array.from(this.normalization.keys()),
      timestamp: new Date().toISOString(),
    };
  }
}
