import { describe, expect, it, vi } from 'vitest';
import { MAX_PERSON_SESSIONS, MAX_SESSION_ENTRIES, NavigationEngine } from './navigation-engine';
import type { BrowserApi, Site, SearchResponse } from './browser-types';

const page = (address: string, html = '<h1>Original snapshot</h1>'): Site => ({ _id: address, address, title: address, html, authorId: 'p1', createdAt: '', updatedAt: '' });
function setup() {
  const api: BrowserApi = {
    people: vi.fn(async () => []), sites: vi.fn(async () => []),
    site: vi.fn(async (address) => page(address)),
    search: vi.fn(async (query) => ({ query, items: [{ address: 'a.zz', title: 'A', excerpt: 'Body', score: 3 }], total: 1, limit: 20 })),
    history: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })), record: vi.fn(async () => {}),
  };
  const engine = new NavigationEngine(api); engine.selectPerson('p1');
  return { engine, api, current: () => { const session = engine.getSnapshot().session!; return session.entries[session.index]; } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Independent browser navigation engine', () => {
  it('captures search highlighting with the website snapshot and restores it without leaking to links', async () => {
    const { engine, current } = setup();
    await engine.search('garden soil'); await engine.navigate('a.zz', 'search');
    expect(current()).toMatchObject({ kind: 'website', searchQuery: 'garden soil' });
    await engine.navigate('b.zz', 'link'); expect(current()).not.toHaveProperty('searchQuery');
    engine.go(-1); expect(current()).toMatchObject({ kind: 'website', searchQuery: 'garden soil' });
    engine.go(-1); expect(current()).toMatchObject({ kind: 'search', result: { query: 'garden soil' } });
  });
  it('bounds retained snapshots while preserving recent entries and traversal', async () => {
    const { engine, current } = setup();
    await engine.navigate('first.zz'); const first = current().id;
    for (let n = 0; n < MAX_SESSION_ENTRIES + 5; n++) await engine.navigate('page' + n + '.zz');
    expect(engine.getSnapshot().session?.entries).toHaveLength(MAX_SESSION_ENTRIES);
    expect(engine.hasEntry('p1', first)).toBe(false);
    engine.go(-1); expect(current()).toMatchObject({ kind: 'website', site: { address: 'page53.zz' } });
    engine.go(1); expect(current()).toMatchObject({ kind: 'website', site: { address: 'page54.zz' } });
  });
  it('evicts the least recently selected person without sharing their session', async () => {
    const { engine, current } = setup(); await engine.navigate('first.zz');
    for (let n = 0; n < MAX_PERSON_SESSIONS; n++) engine.selectPerson('person-' + n);
    engine.selectPerson('p1'); expect(current().kind).toBe('home');
    expect(engine.getSnapshot().session?.entries).toHaveLength(1);
  });
  it('does not rerender for unchanged scroll values or persist on session reload', async () => {
    const { engine, api, current } = setup();
    const listener = vi.fn(); engine.subscribe(listener); engine.setScroll(current().id, 0);
    expect(listener).not.toHaveBeenCalled();
    await engine.navigate('a.zz'); const fresh = new NavigationEngine(api); fresh.selectPerson('p1');
    expect(fresh.getSnapshot().session?.entries[0].kind).toBe('home'); expect(api.record).toHaveBeenCalledTimes(1);
  });
  it('does not persist passive hydration or person selection', () => {
    const { engine, api } = setup(); engine.selectPerson('p2'); engine.selectPerson('p1');
    expect(api.record).not.toHaveBeenCalled(); expect(engine.getSnapshot().session?.entries).toHaveLength(1);
  });
  it('normalizes typed addresses and records each explicit action exactly once', async () => {
    const { engine, api, current } = setup(); await engine.navigate(' A.ZZ ');
    expect(current().kind).toBe('website'); expect(api.record).toHaveBeenCalledExactlyOnceWith('p1', 'a.zz', 'typed');
    await engine.navigate('a.zz', 'link');
    expect(engine.getSnapshot().session?.entries).toHaveLength(3); expect(api.record).toHaveBeenLastCalledWith('p1', 'a.zz', 'link');
  });
  it('restores captured HTML and scroll without refetching during back and forward', async () => {
    const { engine, api, current } = setup(); await engine.navigate('a.zz'); engine.setScroll(current().id, 450);
    await engine.navigate('b.zz'); vi.mocked(api.site).mockResolvedValue(page('a.zz', 'CHANGED'));
    engine.go(-1); expect(current()).toMatchObject({ kind: 'website', site: { html: '<h1>Original snapshot</h1>' }, scrollY: 450 });
    engine.go(1); expect(current()).toMatchObject({ kind: 'website', site: { address: 'b.zz' } });
    expect(api.site).toHaveBeenCalledTimes(2); expect(api.record).toHaveBeenLastCalledWith('p1', 'b.zz', 'forward');
    engine.go(1); expect(api.record).toHaveBeenCalledTimes(4);
  });
  it('discards forward entries only after a new destination successfully loads', async () => {
    const { engine, api, current } = setup(); await engine.navigate('a.zz'); await engine.navigate('b.zz'); engine.go(-1);
    vi.mocked(api.site).mockRejectedValueOnce(new Error('offline')); await engine.navigate('c.zz');
    expect(engine.getSnapshot().session?.entries).toHaveLength(3); expect(current()).toMatchObject({ site: { address: 'a.zz' } });
    await engine.navigate('c.zz'); expect(engine.getSnapshot().session?.entries).toHaveLength(3); engine.go(1);
    expect(current()).toMatchObject({ site: { address: 'c.zz' } });
  });
  it('records broken links and history/result navigation with the correct methods', async () => {
    const { engine, api, current } = setup(); vi.mocked(api.site).mockResolvedValueOnce(null);
    await engine.navigate('missing.zz', 'link'); expect(current()).toMatchObject({ kind: 'missing', address: 'missing.zz' });
    expect(api.record).toHaveBeenLastCalledWith('p1', 'missing.zz', 'link');
    await engine.navigate('a.zz', 'history'); expect(api.record).toHaveBeenLastCalledWith('p1', 'a.zz', 'history');
    await engine.navigate('b.zz', 'search'); expect(api.record).toHaveBeenLastCalledWith('p1', 'b.zz', 'search');
  });
  it('returns to exact search results and query snapshots without another search', async () => {
    const { engine, api, current } = setup(); await engine.search('kelp forest'); engine.setScroll(current().id, 210);
    await engine.navigate('a.zz', 'search'); engine.go(-1);
    expect(current()).toMatchObject({ kind: 'search', result: { query: 'kelp forest', items: [{ address: 'a.zz' }] }, scrollY: 210 });
    expect(api.search).toHaveBeenCalledTimes(1); expect(api.record).toHaveBeenCalledTimes(1);
  });
  it('isolates sessions and cancels unfinished navigation when the person switches', async () => {
    const { engine, api, current } = setup(); await engine.navigate('a.zz'); const pending = deferred<Site | null>();
    vi.mocked(api.site).mockReturnValueOnce(pending.promise); const old = engine.navigate('slow.zz');
    engine.selectPerson('p2'); expect(current().kind).toBe('home'); pending.resolve(page('slow.zz')); await old;
    expect(current().kind).toBe('home'); engine.selectPerson('p1'); expect(current()).toMatchObject({ site: { address: 'a.zz' } });
    expect(api.record).toHaveBeenCalledTimes(1);
  });
  it('ignores stale site responses even if the transport ignores abort signals', async () => {
    const { engine, api, current } = setup(); const old = deferred<Site | null>(); vi.mocked(api.site).mockReturnValueOnce(old.promise);
    const first = engine.navigate('old.zz'); await engine.navigate('new.zz'); old.resolve(page('old.zz')); await first;
    expect(current()).toMatchObject({ site: { address: 'new.zz' } }); expect(api.record).toHaveBeenCalledTimes(1);
  });
  it('ignores stale search responses and recovers from a search API failure', async () => {
    const { engine, api, current } = setup(); const old = deferred<SearchResponse>(); vi.mocked(api.search).mockReturnValueOnce(old.promise);
    const first = engine.search('old'); await engine.search('new'); old.resolve({ query: 'old', items: [], total: 0, limit: 20 }); await first;
    expect(current()).toMatchObject({ kind: 'search', result: { query: 'new' } });
    vi.mocked(api.search).mockRejectedValueOnce(new Error('offline')); await engine.search('failed');
    expect(current()).toMatchObject({ result: { query: 'new' } }); expect(engine.getSnapshot().pending).toBe(false);
  });
  it('keeps successful navigation after visit persistence fails, without retry duplicates', async () => {
    const { engine, api, current } = setup(); vi.mocked(api.record).mockRejectedValueOnce(new Error('offline'));
    await engine.navigate('a.zz'); expect(current()).toMatchObject({ site: { address: 'a.zz' } });
    expect(engine.getSnapshot().recordingError).toContain('could not be saved'); expect(api.record).toHaveBeenCalledTimes(1);
  });
  it('rejects external addresses and oversized/empty queries without API calls', async () => {
    const { engine, api } = setup(); await engine.navigate('https://example.com'); await engine.search('  '); await engine.search('x'.repeat(101));
    expect(api.site).not.toHaveBeenCalled(); expect(api.search).not.toHaveBeenCalled();
  });
});
