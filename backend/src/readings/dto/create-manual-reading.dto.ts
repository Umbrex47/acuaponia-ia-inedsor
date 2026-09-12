export interface FishObservationDto {
  mortalityCount?: number;
  behaviorNotes?: string;
  averageWeightGrams?: number;
  feedAmountGrams?: number;
  generalHealth?: 'excelente' | 'bueno' | 'regular' | 'critico';
}

export class CreateManualReadingDto {
  /** Nombre o cédula del operador / usuario que realizó la medición. */
  operator!: string;

  /** Rol u oficio del operador (opcional). */
  operatorRole?: string;

  /** Fecha y hora de la toma de muestra (ISO-8601 o timestamp). Si no se provee, se usa la hora actual. */
  timestamp?: string | Date;

  /** Diccionario de variables medidas (ej: { nitratos: 15, nitritos: 0.1, amonio: 0.2, ph: 7.2 }). */
  values!: Record<string, number>;

  /** Notas u observaciones de la muestra o del sistema. */
  notes?: string;

  /** Observaciones directas del estado y comportamiento de los peces. */
  fishObservation?: FishObservationDto;

  /** Origen del registro (por defecto 'mobile-app'). */
  source?: string;
}

export class ManualHistoryQueryDto {
  limit?: number;
  skip?: number;
  operator?: string;
  fromDate?: string;
  toDate?: string;
}
