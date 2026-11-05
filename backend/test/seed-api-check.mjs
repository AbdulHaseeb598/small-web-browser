// Native Node HTTP regression: seed BSON references must be readable by the API.
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/config/configure-app.js';
import { SEED_PEOPLE, SEED_SITES, SEED_VISITS } from '../dist/seed/seed-data.js';

const app = await NestFactory.create(AppModule, { logger: false });
try {
  configureApp(app, 'http://localhost:3000');
  await app.listen(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + app.getHttpServer().address().port + '/api';
  for (const site of SEED_SITES) {
    const response = await fetch(base + '/sites/' + site.address);
    assert.equal(response.status, 200);
    const body = await response.json();
    for (const key of ['_id', 'address', 'title', 'html', 'authorId', 'createdAt', 'updatedAt']) {
      assert.equal(body[key], site[key]);
    }
  }
  for (const person of SEED_PEOPLE) {
    const response = await fetch(base + '/people/' + person._id + '/visits?limit=100');
    assert.equal(response.status, 200);
    const body = await response.json();
    const expected = SEED_VISITS.filter((visit) => visit.personId === person._id)
      .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt) || b._id.localeCompare(a._id));
    assert.equal(body.total, expected.length);
    assert.deepEqual(body.items.map((visit) => visit._id), expected.map((visit) => visit._id));
  }
  console.log('Verified all seeded sites and histories through HTTP');
} finally {
  await app.close();
}
