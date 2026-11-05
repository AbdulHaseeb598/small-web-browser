// Manual/Playwright QA fixture. Always seeds a unique database; never the dev DB.
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { seedDatabase } from '../dist/seed/seed-runner.js';
import { Person } from '../dist/people/person.schema.js';
import { Site } from '../dist/sites/site.schema.js';
import { Visit } from '../dist/visits/visit.schema.js';

const name = 'small_web_browser_test_' + randomUUID().replaceAll('-', '');
const parts = /^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?(\?.*)?$/.exec(process.env.MONGODB_URI ?? '');
if (!parts) throw new Error('A reachable MONGODB_URI is required');
process.env.MONGODB_URI = parts[1] + '/' + name + (parts[2] ?? '');
process.env.FRONTEND_ORIGIN = process.env.BROWSER_TEST_ORIGIN ?? 'http://localhost:3001';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/config/configure-app.js');
const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
const connection = app.get(getConnectionToken());
let closing = false;
async function cleanup() {
  if (closing) return; closing = true;
  try {
    if (connection.name !== name || !/^small_web_browser_test_[a-f0-9]{32}$/.test(name)) throw new Error('Refusing to clean an unexpected database');
    await connection.dropDatabase();
  } finally { await app.close(); }
}
process.once('SIGTERM', () => { void cleanup().then(() => process.exit(0), () => process.exit(1)); });
process.once('SIGINT', () => { void cleanup().then(() => process.exit(0), () => process.exit(1)); });
try {
  // This fixture owns signal handling: drop its database before closing MongoDB.
  configureApp(app, process.env.FRONTEND_ORIGIN, { shutdownHooks: false });
  app.getHttpAdapter().get('/__browser-test', (_request, response) => response.json({ database: name }));
  await seedDatabase({ people: app.get(getModelToken(Person.name)), sites: app.get(getModelToken(Site.name)), visits: app.get(getModelToken(Visit.name)) });
  await app.listen(4000, '0.0.0.0');
  console.log('BROWSER_TEST_READY database=' + name);
} catch (error) { await cleanup(); throw error; }
