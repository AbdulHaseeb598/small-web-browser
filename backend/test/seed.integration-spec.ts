import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import mongoose, { type Connection } from 'mongoose';
import { Person, PersonSchema } from '../src/people/person.schema.js';
import { Site, SiteSchema } from '../src/sites/site.schema.js';
import { Visit, VisitSchema } from '../src/visits/visit.schema.js';
import { SEED_PEOPLE, SEED_SITES, SEED_VISITS } from '../src/seed/seed-data.js';
import {
  seedDatabase,
  type SeedModels,
  type SeedSummary,
} from '../src/seed/seed-runner.js';

const execute = promisify(execFile);
const names = ['people', 'sites', 'visits'] as const;

describe('Seed persistence with real MongoDB', () => {
  const databaseName =
    'small_web_browser_seed_test_' + randomUUID().replaceAll('-', '');
  let connection: Connection;
  let uri: string;
  let models: SeedModels;

  async function command(): Promise<SeedSummary> {
    const result = await execute(process.execPath, ['dist/seed/seed.js'], {
      env: { ...process.env, MONGODB_URI: uri },
      timeout: 15000,
    });
    const line = result.stdout
      .split('\n')
      .find((line) => line.startsWith('Seed complete: '));
    if (!line) throw new Error('Seed command returned no summary');
    return JSON.parse(line.slice('Seed complete: '.length)) as SeedSummary;
  }

  async function snapshot() {
    return JSON.stringify(
      await Promise.all(
        names.map((name) =>
          connection.collection(name).find().sort({ _id: 1 }).toArray(),
        ),
      ),
    );
  }

  async function counts() {
    return Promise.all(
      names.map((name) => connection.collection(name).countDocuments()),
    );
  }

  beforeAll(async () => {
    const baseUri = process.env.TEST_MONGODB_URI ?? process.env.MONGODB_URI;
    const parts = /^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?(\?.*)?$/.exec(
      baseUri ?? '',
    );
    if (!parts)
      throw new Error(
        'Set TEST_MONGODB_URI or use Docker Compose for seed integration tests',
      );
    uri = parts[1] + '/' + databaseName + (parts[2] ?? '');
    connection = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 5000 })
      .asPromise();
    models = {
      people: connection.model(Person.name, PersonSchema),
      sites: connection.model(Site.name, SiteSchema),
      visits: connection.model(Visit.name, VisitSchema),
    };
    await Promise.all([
      models.people.init(),
      models.sites.init(),
      models.visits.init(),
    ]);
  });

  beforeEach(async () => {
    await Promise.all(
      names.map((name) => connection.collection(name).deleteMany({})),
    );
  });

  afterAll(async () => {
    if (connection) {
      if (
        connection.name !== databaseName ||
        !/^small_web_browser_seed_test_[a-f0-9]{32}$/.test(connection.name)
      ) {
        await connection.close();
        throw new Error('Refusing to clean an unexpected seed-test database');
      }
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('runs the native CLI twice without changing any persisted content or timestamps', async () => {
    expect(await command()).toEqual({
      people: { inserted: 5, updated: 0, existing: 0 },
      sites: { inserted: 10, updated: 0, existing: 0 },
      visits: { inserted: 60, updated: 0, existing: 0 },
    });
    expect(await counts()).toEqual([5, 10, 60]);
    const first = await snapshot();
    expect(await command()).toEqual({
      people: { inserted: 0, updated: 0, existing: 5 },
      sites: { inserted: 0, updated: 0, existing: 10 },
      visits: { inserted: 0, updated: 0, existing: 60 },
    });
    expect(await snapshot()).toBe(first);
    const site = await models.sites
      .findOne({ address: SEED_SITES[0].address })
      .lean();
    expect(site?.html).toBe(SEED_SITES[0].html);
    expect(site?.authorId.toHexString()).toBe(SEED_SITES[0].authorId);
    const visit = await models.visits.findById(SEED_VISITS[0]._id).lean();
    expect(visit?.visitedAt.toISOString()).toBe(SEED_VISITS[0].visitedAt);
  });

  it('preserves unrelated user records, even when a person shares a seed name', async () => {
    const person = await models.people.create({ name: SEED_PEOPLE[0].name });
    const site = await models.sites.create({
      address: 'my-notes.zz',
      title: 'User notes',
      html: '  <p>Keep my writing.</p>\n',
      authorId: person._id,
    });
    const visit = await models.visits.create({
      personId: person._id,
      address: 'user-missing.zz',
      method: 'typed',
    });
    const before = JSON.stringify(
      await Promise.all([
        models.people.findById(person._id).lean(),
        models.sites.findById(site._id).lean(),
        models.visits.findById(visit._id).lean(),
      ]),
    );
    await seedDatabase(models);
    await seedDatabase(models);
    const after = JSON.stringify(
      await Promise.all([
        models.people.findById(person._id).lean(),
        models.sites.findById(site._id).lean(),
        models.visits.findById(visit._id).lean(),
      ]),
    );
    expect(after).toBe(before);
    expect(await counts()).toEqual([6, 11, 61]);
  });

  it('recovers a partially inserted visit phase without changing the completed records', async () => {
    await models.people.create(
      SEED_PEOPLE.map((person) => ({
        ...person,
        _id: new mongoose.Types.ObjectId(person._id),
        createdAt: new Date(person.createdAt),
      })),
    );
    await models.sites.create(
      SEED_SITES.map((site) => ({
        ...site,
        _id: new mongoose.Types.ObjectId(site._id),
        authorId: new mongoose.Types.ObjectId(site.authorId),
        createdAt: new Date(site.createdAt),
        updatedAt: new Date(site.updatedAt),
      })),
    );
    await models.visits.create(
      SEED_VISITS.slice(0, 13).map((visit) => ({
        ...visit,
        _id: new mongoose.Types.ObjectId(visit._id),
        personId: new mongoose.Types.ObjectId(visit.personId),
        visitedAt: new Date(visit.visitedAt),
      })),
    );
    const summary = await seedDatabase(models);
    expect(summary.people.existing).toBe(5);
    expect(summary.sites.existing).toBe(10);
    expect(summary.visits).toEqual({ inserted: 47, updated: 0, existing: 13 });
    const recovered = await snapshot();
    await seedDatabase(models);
    expect(await snapshot()).toBe(recovered);
    expect(await counts()).toEqual([5, 10, 60]);
  });
});
