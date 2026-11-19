import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',') });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`SHADOW FRONT server listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap().catch((err) => {
  Logger.error(err, 'Bootstrap');
  process.exit(1);
});
