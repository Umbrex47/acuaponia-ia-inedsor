import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { AquaponicGateway } from './aquaponic.gateway';
import { AquaponicService } from './aquaponic.service';

@Module({
  imports: [MqttModule],
  providers: [AquaponicGateway, AquaponicService],
})
export class AquaponicModule {}
