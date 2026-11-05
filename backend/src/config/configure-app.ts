import type { INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication, frontendOrigin: string) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: frontendOrigin });
  app.enableShutdownHooks();
}
