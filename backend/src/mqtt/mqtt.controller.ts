import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildPublishTopic } from './topics.constants';
import { MqttService } from './mqtt.service';

class PublishDto {
  topic!: string;
  payload!: unknown;
  retain?: boolean;
}

@Controller('api/mqtt')
export class MqttController {
  constructor(
    private readonly mqtt: MqttService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  getStatus() {
    return this.mqtt.getConnectionStatus();
  }

  @Post('publish')
  publish(@Body() body: PublishDto) {
    const prefix = this.config.get<string>('mqtt.topicPrefix', 'aquaponic');
    const topic = body.topic.startsWith(prefix)
      ? body.topic
      : buildPublishTopic(prefix, body.topic);

    const ok = this.mqtt.publish(topic, body.payload, body.retain ?? false);
    return { ok, topic };
  }
}
