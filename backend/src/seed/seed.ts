import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import { Person } from '../people/person.schema.js';
import { Site } from '../sites/site.schema.js';
import { Visit } from '../visits/visit.schema.js';
import { SeedConflictError, seedDatabase } from './seed-runner.js';

let app: INestApplicationContext | undefined;
try {
  // Reuse the application's validated environment and Mongoose providers without
  // starting an HTTP server or taking the running backend's port.
  app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const summary = await seedDatabase({
    people: app.get<Model<Person>>(getModelToken(Person.name)),
    sites: app.get<Model<Site>>(getModelToken(Site.name)),
    visits: app.get<Model<Visit>>(getModelToken(Visit.name)),
  });
  console.log('Seed complete: ' + JSON.stringify(summary));
} catch (error: unknown) {
  console.error(
    error instanceof SeedConflictError
      ? error.message
      : 'Seed failed. Check environment configuration and MongoDB availability. Partial inserts may remain; retries do not overwrite existing records.',
  );
  process.exitCode = 1;
} finally {
  if (app) {
    try {
      await app.close();
    } catch {
      console.error('Seed connection shutdown failed.');
      process.exitCode = 1;
    }
  }
}
