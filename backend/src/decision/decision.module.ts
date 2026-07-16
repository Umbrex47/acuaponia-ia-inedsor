import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { AlertsModule } from '../alerts/alerts.module';
import { DecisionController } from './decision.controller';
import { FishAssessmentService } from './fish-assessment.service';
import { PumpDecisionService } from './pump-decision.service';
import { ReportService } from './report.service';

/**
 * Motor de decisiones (fase 1 del enfoque híbrido):
 *  - PumpDecisionService: reglas en tiempo real para la bomba de agua.
 *  - ReportService: reporte de progreso (correo + Telegram).
 *  - FishAssessmentService: conducta de peces → correo (sin actuadores aún).
 *
 * ReadingsService se inyecta desde el módulo global de lecturas.
 * MailService/TelegramService provienen de AlertsModule.
 */
@Module({
  imports: [MqttModule, AlertsModule],
  controllers: [DecisionController],
  providers: [PumpDecisionService, ReportService, FishAssessmentService],
})
export class DecisionModule {}
