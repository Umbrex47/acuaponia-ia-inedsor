import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ActuatorsModule } from '../actuators/actuators.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { EmergencyPolicyService } from './emergency-policy.service';

@Module({
  imports: [MqttModule, AlertsModule, ActuatorsModule],
  providers: [EmergencyPolicyService],
  exports: [EmergencyPolicyService],
})
export class EmergencyModule {}
