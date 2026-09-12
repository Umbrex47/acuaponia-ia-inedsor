export class CreateReminderDto {
  title!: string;
  description?: string;
  type?: 'recurring' | 'once';
  intervalDays?: number; // Ej: 3 (cada 3 días)
  targetTime?: string;   // Ej: "08:00"
  specificDate?: string; // Fecha concreta ISO si es 'once'
  targetVariables?: string[]; // Ej: ['nitratos', 'nitritos', 'amonio', 'ph']
  targetRole?: string;
  severity?: 'info' | 'warn' | 'critical';
  enabled?: boolean;
}

export class UpdateReminderDto {
  title?: string;
  description?: string;
  intervalDays?: number;
  targetTime?: string;
  specificDate?: string;
  targetVariables?: string[];
  severity?: 'info' | 'warn' | 'critical';
  enabled?: boolean;
}

export class UpdateSettingsDto {
  notificationChannels?: string[];
  cooldownMinutes?: number;
  defaultSamplingDays?: number;
  customThresholds?: Record<string, { min?: number; max?: number }>;
  adminPasscode?: string;
}
