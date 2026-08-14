import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const isProd = ['docker', 'prod'].includes(process.env.NODE_ENV ?? '');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: isProd ? ['log', 'error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  if (isProd) {
    app.useLogger({
      log: (message: string) => console.log(JSON.stringify({ level: 'log', message })),
      error: (message: string, trace: string) => console.error(JSON.stringify({ level: 'error', message, trace })),
      warn: (message: string) => console.warn(JSON.stringify({ level: 'warn', message })),
      debug: () => void 0,
      verbose: () => void 0,
    });
  }

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
