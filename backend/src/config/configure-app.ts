import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

export function configureApp(
  app: INestApplication,
  frontendOrigin: string,
  options: { shutdownHooks?: boolean } = {},
) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
  app.enableCors({ origin: frontendOrigin });
  if (options.shutdownHooks !== false) app.enableShutdownHooks();
}
