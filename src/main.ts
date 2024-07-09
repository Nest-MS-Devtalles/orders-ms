import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from './app.module';
import { envs } from './config';

async function bootstrap() {
  const logger = new Logger('Main-Order');
  const app = await NestFactory.create(AppModule);

  await app.listen(envs.port);
  logger.log(`Order-MS is running on: http://localhost:${envs.port}`);
}
bootstrap();
