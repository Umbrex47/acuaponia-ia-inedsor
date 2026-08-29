import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MqttModule } from '../mqtt/mqtt.module';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AquaponicModule } from '../aquaponic/aquaponic.module';
import { AssistantsModule } from '../assistants/assistants.module';
import { DecisionController } from './decision.controller';
import { AeratorDecisionService } from './aerator-decision.service';
import { DecisionFlowService } from './decision-flow.service';
import { EarlyWarningReportService } from './early-warning-report.service';
import { FilterCleaningAlertService } from './filter-cleaning-alert.service';
import { FishAssessmentService } from './fish-assessment.service';
import { PlantAssessmentService } from './plant-assessment.service';
import { PumpDecisionService } from './pump-decision.service';
import { ReportService } from './report.service';
import {
  IaActionLog,
  IaActionLogSchema,
} from './schemas/ia-action-log.schema';

/**
 * Motor de decisiones (fase 1 del enfoque híbrido):
 *  - PumpDecisionService: reglas en tiempo real para la bomba de agua.
 *  - AeratorDecisionService: reglas en tiempo real para el aireador (pH/O2).
 *  - FilterCleaningAlertService: alertas de mantenimiento de filtros.
 *  - EarlyWarningReportService: reporte periódico de alertas y control.
 *  - ReportService: reporte de progreso (correo + Telegram).
 *  - FishAssessmentService: conducta de peces → correo.
 *  - PlantAssessmentService: anomalías de plantas → correo.
 *  - DecisionFlowService: ciclo Alerta temprana → IA → Normalización.
 *
 * Depende de ActuatorService (global, provisto por ActuatorsModule.forRoot() en
 * AppModule) para ejecutar el aireador desde las reglas automáticas.
 */
@Module({
  imports: [
    MqttModule,
    AlertsModule,
    NotificationsModule,
    AquaponicModule,
    AssistantsModule,
    ...(process.env.MONGODB_URI
      ? [
          MongooseModule.forFeature([
            { name: IaActionLog.name, schema: IaActionLogSchema },
          ]),
        ]
      : []),
  ],
  controllers: [DecisionController],
  providers: [
    PumpDecisionService,
    AeratorDecisionService,
    FilterCleaningAlertService,
    EarlyWarningReportService,
    ReportService,
    FishAssessmentService,
    PlantAssessmentService,
    DecisionFlowService,
  ],
})
export class DecisionModule {
  constructor() {
    if (!process.env.MONGODB_URI) {
      new Logger(DecisionModule.name).warn(
        'MONGODB_URI no definido — IaActionLog sin persistencia (bitácora en memoria)',
      );
    }
  }
}
