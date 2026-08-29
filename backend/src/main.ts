import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 8080;

  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(port);
  Logger.log(`HTTP + WebSocket en http://localhost:${port}`, 'Bootstrap');
  Logger.log(`WebSocket del dashboard: ws://localhost:${port}/ws`, 'Bootstrap');
  Logger.log(`WebSocket del asistente: ws://localhost:${port}/chat`, 'Bootstrap');
}

bootstrap();
