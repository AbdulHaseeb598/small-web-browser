// Exercise native Node ESM and emitted DTO metadata, not Vitest's TS transform.
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/config/configure-app.js';

const app = await NestFactory.create(AppModule);
configureApp(app, process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000');
await app.listen(0, '127.0.0.1');
console.log('TEST_SERVER_PORT=' + app.getHttpServer().address().port);
