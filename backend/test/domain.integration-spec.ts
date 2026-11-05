import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose, { type Connection } from 'mongoose';
import { Visit, VisitSchema } from '../src/visits/visit.schema.js';

type PersonResult = { _id: string; name: string; createdAt: string };
type VisitResult = {
  _id: string;
  personId: string;
  address: string;
  visitedAt: string;
  method: string;
};
type HistoryResult = {
  items: (VisitResult & { exists: boolean })[];
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
    expect(
      (await connection.collection('sites').findOne())?.authorId,
    ).toBeInstanceOf(mongoose.Types.ObjectId);
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

  it.each([
    {},
    { name: '' },
    { name: '   ' },
    { name: 123 },
    { name: null },
    { name: 'Ada', role: 'admin' },
  ])(
    'rejects invalid person payload %j with a consistent validation envelope',
    async (payload) => {
      const result = await api('/people', payload);
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.any(Array),
      });
      expect(await connection.collection('people').countDocuments()).toBe(0);
    },
  );

  it('rejects missing, mistyped, and unexpected publication fields without persisting a site', async () => {
    const person = await createPerson();
    const valid: Record<string, unknown> = {
      address: 'valid.zz',
      title: 'Valid',
      html: '<p>ok</p>',
      authorId: person._id,
    };
    for (const field of ['address', 'title', 'html', 'authorId']) {
      const invalid = { ...valid };
      delete invalid[field];
      expect((await api('/sites', invalid)).status).toBe(400);
    }
    for (const invalid of [
      { ...valid, title: '   ' },
      { ...valid, html: '' },
      { ...valid, html: 12 },
      { ...valid, authorId: 'bad-id' },
      { ...valid, createdAt: new Date().toISOString() },
      { ...valid, address: { $ne: null } },
      { ...valid, title: 'x'.repeat(201) },
    ])
      expect((await api('/sites', invalid)).status).toBe(400);
    expect(await connection.collection('sites').countDocuments()).toBe(0);
  });

  it('returns consistent 404s for well-formed IDs/addresses that do not exist', async () => {
    const missing = new mongoose.Types.ObjectId().toHexString();
    for (const [path, payload] of [
      ['/sites/missing.zz', undefined],
      ['/people/' + missing + '/visits', undefined],
      [
        '/sites',
        {
          address: 'valid.zz',
          title: 'Valid',
          html: '<p>x</p>',
          authorId: missing,
        },
      ],
      ['/visits', { address: 'missing.zz', personId: missing, method: 'link' }],
    ] as const) {
      const response = await api(path, payload);
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: expect.any(String),
      });
    }
    expect((await api('/people/not-an-id/visits')).status).toBe(400);
    expect((await api('/sites/https%3A%2F%2Fexample.com')).status).toBe(400);
    expect(await connection.collection('visits').countDocuments()).toBe(0);
  });

  it('accepts every supported navigation method and keeps events distinct', async () => {
    const person = await createPerson();
    const methods = ['typed', 'link', 'back', 'forward', 'history', 'search'];
    for (const method of methods) {
      const response = await api<VisitResult>('/visits', {
        personId: person._id,
        address: 'attempt.zz',
        method,
      });
      expect(response.status).toBe(201);
      expect(response.body.method).toBe(method);
    }
    const history = (
      await api<HistoryResult>('/people/' + person._id + '/visits')
    ).body;
    expect(history.total).toBe(6);
    expect(new Set(history.items.map((v) => v._id)).size).toBe(6);
  });

  it('rejects invalid visit payloads and client-controlled timestamps', async () => {
    const person = await createPerson();
    const valid: Record<string, unknown> = {
      personId: person._id,
      address: 'valid.zz',
      method: 'typed',
    };
    for (const field of ['personId', 'address', 'method']) {
      const invalid = { ...valid };
      delete invalid[field];
      expect((await api('/visits', invalid)).status).toBe(400);
    }
    for (const invalid of [
      { ...valid, personId: 'bad-id' },
      { ...valid, method: 'reload' },
      { ...valid, method: 'LINK' },
      { ...valid, address: 'https://example.com' },
      { ...valid, visitedAt: '2020-01-01T00:00:00Z' },
      { ...valid, _id: new mongoose.Types.ObjectId().toHexString() },
    ])
      expect((await api('/visits', invalid)).status).toBe(400);
    expect(await connection.collection('visits').countDocuments()).toBe(0);
  });

  it('validates pagination bounds, unknown query fields, and empty history defaults', async () => {
    const person = await createPerson();
    const path = '/people/' + person._id + '/visits';
    expect((await api<HistoryResult>(path)).body).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    for (const query of [
      'page=0',
      'page=-1',
      'page=1.5',
      'page=abc',
      'page=1000001',
      'limit=0',
      'limit=101',
      'limit=2.5',
      'limit=abc',
      'limit=',
      'page=1&page=2',
      'sort=oldest',
    ]) {
      const response = await api(path + '?' + query);
      expect(response.status, query).toBe(400);
      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.any(Array),
      });
    }
  });

  it('keeps all visit fields immutable through the actual Mongoose schema', async () => {
    const person = await createPerson();
    const other = await createPerson('Other');
    const original = (
      await api<VisitResult>('/visits', {
        personId: person._id,
        address: 'original.zz',
        method: 'typed',
      })
    ).body;
    const model = connection.model(Visit.name, VisitSchema);
    await model.updateOne(
      { _id: original._id },
      {
        $set: {
          address: 'changed.zz',
          personId: other._id,
          method: 'search',
          visitedAt: new Date(0),
        },
      },
    );
    const persisted = await connection
      .collection('visits')
      .findOne({ _id: new mongoose.Types.ObjectId(original._id) });
    expect(persisted?.address).toBe('original.zz');
    expect(persisted?.personId.toString()).toBe(person._id);
    expect(persisted?.method).toBe('typed');
    expect(persisted?.visitedAt.toISOString()).toBe(original.visitedAt);
  });

  it('creates the real MongoDB indexes and retains database-backed health', async () => {
    const siteIndexes = await connection.collection('sites').indexes();
    expect(siteIndexes).toContainEqual(
      expect.objectContaining({ key: { address: 1 }, unique: true }),
    );
    const visitIndexes = await connection.collection('visits').indexes();
    expect(visitIndexes).toContainEqual(
      expect.objectContaining({ key: { personId: 1, visitedAt: -1, _id: -1 } }),
    );
    expect((await api('/health')).body).toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('reads canonical ObjectId and legacy string person references without rewriting either', async () => {
    const person = await createPerson();
    const current = await api<VisitResult>('/visits', {
      personId: person._id,
      address: 'current.zz',
      method: 'typed',
    });
    expect(current.status).toBe(201);
    const saved = await connection
      .collection('visits')
      .findOne({ _id: new mongoose.Types.ObjectId(current.body._id) });
    expect(saved?.personId).toBeInstanceOf(mongoose.Types.ObjectId);
    const legacy = {
      _id: new mongoose.Types.ObjectId(),
      personId: person._id,
      address: 'legacy.zz',
      method: 'history',
      visitedAt: new Date('2025-01-01T00:00:00Z'),
    };
    await connection.collection('visits').insertOne(legacy);
    const response = await api<HistoryResult>(
      '/people/' + person._id + '/visits',
    );
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.items.map((visit) => visit._id)).toEqual([
      current.body._id,
      legacy._id.toHexString(),
    ]);
    expect(
      await connection.collection('visits').findOne({ _id: legacy._id }),
    ).toEqual(legacy);
  });

  it('searches visible HTML body text and phrases without matching hidden markup', async () => {
    const person = await createPerson();
    await api('/sites', {
      address: 'workshop.zz',
      title: 'Workshop notebook',
      authorId: person._id,
      html: '<head><title>headneedle</title></head><body><p>Photodiodes measure light pollution &amp; coastal brightness.</p><script>scriptneedle</script><style>styl eneedle</style><p hidden>hiddenneedle</p><div data-topic="attrneedle">Calibrate carefully.</div></body>',
    });
    type Results = {
      items: {
        address: string;
        title: string;
        excerpt: string;
        score: number;
      }[];
      total: number;
      query: string;
      limit: number;
    };
    const body = await api<Results>('/search?q=photodiodes');
    expect(body.status).toBe(200);
    expect(body.body.items[0].address).toBe('workshop.zz');
    expect(body.body.items[0].excerpt).toContain('Photodiodes');
    expect(body.body.items[0]).not.toHaveProperty('html');
    expect(
      (
        await api<Results>(
          '/search?q=' + encodeURIComponent('"light pollution"'),
        )
      ).body.total,
    ).toBe(1);
    expect(
      (await api<Results>('/search?q=coastal%20calibrate')).body.total,
    ).toBe(1);
    for (const query of [
      'scriptneedle',
      'hiddenneedle',
      'attrneedle',
      'headneedle',
      'notfoundanywhere',
    ])
      expect((await api<Results>('/search?q=' + query)).body.items).toEqual([]);
    await connection
      .collection('sites')
      .updateOne(
        { address: 'workshop.zz' },
        { $set: { html: '<p>Replacement content</p>' } },
      );
    expect((await api<Results>('/search?q=photodiodes')).body.items).toEqual(
      [],
    );
    expect((await api<Results>('/search?q=replacement')).body.total).toBe(1);
  });

  it('ranks title and address above body-only matches and bounds deterministic results', async () => {
    const person = await createPerson();
    for (const [address, title, html] of [
      ['body.zz', 'Field notes', '<p>Aurora over the ridge</p>'],
      ['title.zz', 'Aurora notes', '<p>Ordinary notes</p>'],
      ['aurora.zz', 'Ridge notes', '<p>Ordinary notes</p>'],
      ['exact.zz', 'Aurora', '<p>Ordinary notes</p>'],
    ]) {
      expect(
        (await api('/sites', { address, title, html, authorId: person._id }))
          .status,
      ).toBe(201);
    }
    type Results = {
      items: { address: string; excerpt: string }[];
      total: number;
      limit: number;
    };
    expect(
      (await api<Results>('/search?q=aurora')).body.items.map(
        (item) => item.address,
      ),
    ).toEqual(['exact.zz', 'title.zz', 'aurora.zz', 'body.zz']);
    for (let index = 0; index < 22; index++)
      await api('/sites', {
        address: 'match' + String(index).padStart(2, '0') + '.zz',
        title: 'Equal match',
        html: '<p>A distant galaxy</p>',
        authorId: person._id,
      });
    const first = (await api<Results>('/search?q=galaxy')).body;
    expect(first).toMatchObject({ total: 22, limit: 20 });
    expect(first.items).toHaveLength(20);
    expect(first.items[0].address).toBe('match00.zz');
    expect(first.items[19].address).toBe('match19.zz');
    expect((await api<Results>('/search?q=galaxy')).body).toEqual(first);
  });

  it('validates search input and reports consistent bad requests', async () => {
    for (const path of [
      '/search',
      '/search?q=',
      '/search?q=%20%20',
      '/search?q=' + 'x'.repeat(101),
      '/search?q=a&q=b',
      '/search?q=valid&limit=5',
      '/search?q=' + encodeURIComponent('"unclosed'),
      '/search?q=' + encodeURIComponent('""'),
      '/search?q=' + encodeURIComponent('a b c d e f g h i j k'),
    ]) {
      const result = await api(path);
      expect(result.status, path).toBe(400);
      expect(result.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
    }
  });

  it('computes history page-existence labels without requiring sites for visits', async () => {
    const person = await createPerson();
    await api('/visits', {
      personId: person._id,
      address: 'published.zz',
      method: 'typed',
    });
    await api('/visits', {
      personId: person._id,
      address: 'missing.zz',
      method: 'link',
    });
    await api('/sites', {
      address: 'published.zz',
      title: 'Published later',
      html: '<p>Now available</p>',
      authorId: person._id,
    });
    const history = (
      await api<HistoryResult>('/people/' + person._id + '/visits')
    ).body;
    expect(
      history.items.find((item) => item.address === 'published.zz')?.exists,
    ).toBe(true);
    expect(
      history.items.find((item) => item.address === 'missing.zz')?.exists,
    ).toBe(false);
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
    // Timestamp order takes precedence over the ObjectId tie-breaker.
    const oldestId = expected[expected.length - 1];
    await connection
      .collection('visits')
      .updateOne(
        { _id: new mongoose.Types.ObjectId(oldestId) },
        { $set: { visitedAt: new Date('2030-01-01T00:00:00Z') } },
      );
    const newest = (
      await api<HistoryResult>('/people/' + person._id + '/visits?limit=1')
    ).body;
    expect(newest.items[0]._id).toBe(oldestId);
  });
});
