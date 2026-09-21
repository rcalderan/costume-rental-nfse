import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const isProd = ['docker', 'prod'].includes(process.env.NODE_ENV ?? '');
  const logLevels = isProd
    ? (['log', 'error', 'warn'] as const)
    : (['log', 'error', 'warn', 'debug', 'verbose'] as const);
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new ConsoleLogger({
      json: isProd,
      colors: !isProd,
      logLevels: [...logLevels],
    }),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number(process.env.PORT ?? 8082);
  await app.listen(port);
  new Logger('Bootstrap').log(`costume-rental-nfse listening on :${port}`);
}

bootstrap();
