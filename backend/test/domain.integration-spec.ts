import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose, { type Connection } from 'mongoose';

type PersonResult = { _id: string; name: string; createdAt: string };
type VisitResult = {
  _id: string;
  personId: string;
  address: string;
  visitedAt: string;
  method: string;
};
type HistoryResult = {
  items: VisitResult[];
  total: number;
  page: number;
  limit: number;
};
type SiteResult = {
  _id: string;
  address: string;
  title: string;
  html: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
};

describe('Domain APIs with real MongoDB and compiled NestJS', () => {
  const databaseName =
    'small_web_browser_test_' + randomUUID().replaceAll('-', '');
  let connection: Connection;
  let server: ChildProcess;
  let apiUrl: string;

  async function api<T = Record<string, unknown>>(
    path: string,
    body?: Record<string, unknown>,
  ) {
    const response = await fetch(
      apiUrl + path,
      body === undefined
        ? undefined
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
    );
    return { status: response.status, body: (await response.json()) as T };
  }

  async function createPerson(name = 'Ada') {
    const result = await api<PersonResult>('/people', { name });
    expect(result.status).toBe(201);
    return result.body;
  }

  beforeAll(async () => {
    const baseUri = process.env.TEST_MONGODB_URI ?? process.env.MONGODB_URI;
    if (!baseUri)
      throw new Error(
        'Set TEST_MONGODB_URI or run integration tests through Docker Compose',
      );
    const parts = /^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?(\?.*)?$/.exec(
      baseUri,
    );
    if (!parts) throw new Error('Invalid test MongoDB URI');
    const uri = parts[1] + '/' + databaseName + (parts[2] ?? '');
    connection = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 5000 })
      .asPromise();
    server = spawn(process.execPath, ['test/integration-server.mjs'], {
      env: {
        ...process.env,
        MONGODB_URI: uri,
        FRONTEND_ORIGIN: 'http://localhost:3000',
        PORT: '4000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    apiUrl = await new Promise<string>((resolve, reject) => {
      let logs = '';
      const timeout = setTimeout(
        () => reject(new Error('Test API failed to start: ' + logs)),
        20000,
      );
      server.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error('Test API exited: ' + code + '\n' + logs));
      });
      server.stderr?.on('data', (chunk: Buffer) => {
        logs = (logs + chunk.toString()).slice(-10000);
      });
      server.stdout?.on('data', (chunk: Buffer) => {
        logs = (logs + chunk.toString()).slice(-10000);
        const match = /TEST_SERVER_PORT=(\d+)/.exec(logs);
        if (match) {
          clearTimeout(timeout);
          resolve('http://127.0.0.1:' + match[1] + '/api');
        }
      });
    });
  });

  beforeEach(async () => {
    await Promise.all(
      ['people', 'sites', 'visits'].map((name) =>
        connection.collection(name).deleteMany({}),
      ),
    );
  });

  afterAll(async () => {
    if (server && server.exitCode === null) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => server.kill('SIGKILL'), 5000);
        server.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
        server.kill('SIGTERM');
      });
    }
    if (connection) {
      // Only this run's randomly generated database may ever be removed.
      if (
        connection.name !== databaseName ||
        !/^small_web_browser_test_[a-f0-9]{32}$/.test(connection.name)
      ) {
        await connection.close();
        throw new Error('Refusing to clean an unexpected database');
      }
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('creates and lists trimmed people with generated IDs and timestamps', async () => {
    expect((await api<PersonResult[]>('/people')).body).toEqual([]);
    const person = await createPerson('  Ada Lovelace  ');
    expect(person.name).toBe('Ada Lovelace');
    expect(person._id).toMatch(/^[a-f\d]{24}$/);
    expect(Number.isNaN(Date.parse(person.createdAt))).toBe(false);
    expect((await api<PersonResult[]>('/people')).body).toEqual([person]);
    expect(await connection.collection('people').countDocuments()).toBe(1);
  });

  it('publishes and retrieves normalized sites, preserving authored HTML exactly', async () => {
    const person = await createPerson();
    const html =
      '  <!doctype html>\n<h1>Hello</h1><script>window.example = true;</script>\n ';
    const site = await api<SiteResult>('/sites', {
      address: ' TidePool.ZZ ',
      title: '  Tidepool  ',
      html,
      authorId: person._id,
    });
    expect(site.status).toBe(201);
    expect(site.body).toMatchObject({
      address: 'tidepool.zz',
      title: 'Tidepool',
      html,
      authorId: person._id,
    });
    const retrieved = await api<SiteResult>('/sites/TIDEPOOL.ZZ');
    expect(retrieved.status).toBe(200);
    expect(retrieved.body).toEqual(site.body);
    const listing = await api<Omit<SiteResult, 'html'>[]>('/sites');
    expect(listing.body).toHaveLength(1);
    expect(listing.body[0]).not.toHaveProperty('html');
    expect((await connection.collection('sites').findOne())?.html).toBe(html);
  });

  it('returns 409 when simultaneous publications collide at the unique index', async () => {
    const person = await createPerson();
    const payload = {
      address: 'race.zz',
      title: 'Race',
      html: '<p>Race</p>',
      authorId: person._id,
    };
    const responses = await Promise.all([
      api('/sites', payload),
      api('/sites', { ...payload, address: ' RACE.ZZ ' }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await connection.collection('sites').countDocuments()).toBe(1);
  });

  it('rejects malformed addresses and nonexistent authors with HTTP errors', async () => {
    const person = await createPerson();
    const payload = {
      address: 'https://example.com',
      title: 'Invalid',
      html: '<p>x</p>',
      authorId: person._id,
    };
    expect((await api('/sites', payload)).status).toBe(400);
    expect(
      (
        await api('/sites', {
          ...payload,
          address: 'valid.zz',
          authorId: new mongoose.Types.ObjectId().toHexString(),
        })
      ).status,
    ).toBe(404);
    expect((await api('/sites/missing.zz')).status).toBe(404);
  });

  it('records broken-link attempts as separate immutable navigation events', async () => {
    const person = await createPerson();
    const payload = {
      personId: person._id,
      address: ' Missing.ZZ ',
      method: 'link',
    };
    const first = await api<VisitResult>('/visits', payload);
    const second = await api<VisitResult>('/visits', payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body).toMatchObject({
      personId: person._id,
      address: 'missing.zz',
      method: 'link',
    });
    expect(first.body._id).not.toBe(second.body._id);
    expect(Number.isNaN(Date.parse(first.body.visitedAt))).toBe(false);
    expect((await api('/sites/missing.zz')).status).toBe(404);
    const history = await api<HistoryResult>(
      '/people/' + person._id + '/visits',
    );
    expect(history.status).toBe(200);
    expect(history.body.total).toBe(2);
    expect(history.body.items.map((visit) => visit._id)).toEqual([
      second.body._id,
      first.body._id,
    ]);
    const update = await fetch(apiUrl + '/visits/' + first.body._id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'changed.zz' }),
    });
    expect(update.status).toBe(404);
    expect(
      (
        await connection
          .collection('visits')
          .findOne({ _id: new mongoose.Types.ObjectId(first.body._id) })
      )?.address,
    ).toBe('missing.zz');
  });

  it('paginates newest-first history with an ObjectId tie-breaker and person isolation', async () => {
    const person = await createPerson();
    const other = await createPerson('Other');
    const ids: string[] = [];
    for (const address of ['first.zz', 'second.zz', 'third.zz']) {
      const visit = await api<VisitResult>('/visits', {
        personId: person._id,
        address,
        method: 'typed',
      });
      expect(visit.status).toBe(201);
      ids.push(visit.body._id);
    }
    await api('/visits', {
      personId: other._id,
      address: 'private.zz',
      method: 'typed',
    });
    // Raw-driver fixture forces timestamp ties; production exposes no history mutation.
    await connection
      .collection('visits')
      .updateMany(
        {},
        { $set: { visitedAt: new Date('2026-01-01T00:00:00Z') } },
      );
    const expected = ids.sort().reverse();
    const firstPage = (
      await api<HistoryResult>('/people/' + person._id + '/visits?limit=2')
    ).body;
    const secondPage = (
      await api<HistoryResult>(
        '/people/' + person._id + '/visits?page=2&limit=2',
      )
    ).body;
    expect(firstPage).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(firstPage.items.map((v) => v._id)).toEqual(expected.slice(0, 2));
    expect(secondPage.items.map((v) => v._id)).toEqual(expected.slice(2));
    expect(
      (
        await api<HistoryResult>(
          '/people/' + person._id + '/visits?page=3&limit=2',
        )
      ).body.items,
    ).toEqual([]);
  });
});
