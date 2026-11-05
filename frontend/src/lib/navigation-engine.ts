import { normalizeAddress } from './address';
import type { BrowserApi, NavigationEntry, NavigationMethod } from './browser-types';

export interface Session { entries: NavigationEntry[]; index: number; historyVersion: number }
export interface BrowserSnapshot { personId: string | null; session: Session | null; pending: boolean; error: string | null; recordingError: string | null }
export type Transition = { type: 'push' | 'traverse' | 'select'; personId: string; entryId: string; delta: number };

// Pure application state: no React, DOM, persistent storage, or network effects on hydration.
export class NavigationEngine {
  private sessions = new Map<string, Session>();
  private listeners = new Set<() => void>();
  private transitions = new Set<(transition: Transition) => void>();
  private snapshot: BrowserSnapshot = { personId: null, session: null, pending: false, error: null, recordingError: null };
  private requestId = 0;
  private abort?: AbortController;
  private nextId = 0;

  constructor(private api: BrowserApi) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  observe = (listener: (transition: Transition) => void) => { this.transitions.add(listener); return () => { this.transitions.delete(listener); }; };
  hasEntry(personId: string, entryId: string) { return this.sessions.get(personId)?.entries.some((entry) => entry.id === entryId) ?? false; }

  private publish(changes: Partial<BrowserSnapshot>) {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.listeners) listener();
  }

  private cancel() { this.requestId++; this.abort?.abort(); }
  private transition(type: Transition['type'], delta = 0) {
    const { personId, session } = this.snapshot;
    if (!personId || !session) return;
    const transition = { type, personId, entryId: session.entries[session.index].id, delta };
    for (const listener of this.transitions) listener(transition);
  }

  selectPerson(personId: string) {
    if (this.snapshot.personId === personId) return;
    this.cancel();
    let session = this.sessions.get(personId);
    if (!session) {
      session = { entries: [{ id: 'home-' + personId, kind: 'home', scrollY: 0 }], index: 0, historyVersion: 0 };
      this.sessions.set(personId, session);
    }
    this.publish({ personId, session, pending: false, error: null, recordingError: null });
    this.transition('select');
  }

  private save(session: Session) {
    const personId = this.snapshot.personId;
    if (!personId) return;
    this.sessions.set(personId, session);
    this.publish({ session });
  }

  setScroll(entryId: string, scrollY: number) {
    const session = this.snapshot.session;
    if (!session || session.entries[session.index].id !== entryId || !Number.isFinite(scrollY)) return;
    const entries = [...session.entries];
    entries[session.index] = { ...entries[session.index], scrollY: Math.max(0, scrollY) };
    this.save({ ...session, entries });
  }

  private append(entry: NavigationEntry) {
    const session = this.snapshot.session;
    if (!session) return;
    const entries = [...session.entries.slice(0, session.index + 1), entry];
    this.save({ ...session, entries, index: entries.length - 1 });
    this.publish({ pending: false, error: null });
    this.transition('push');
  }

  private async record(personId: string, entry: NavigationEntry, method: NavigationMethod) {
    const address = entry.kind === 'website' ? entry.site.address : entry.kind === 'missing' ? entry.address : null;
    if (!address) return;
    try {
      await this.api.record(personId, address, method);
      const session = this.sessions.get(personId);
      if (session) {
        const updated = { ...session, historyVersion: session.historyVersion + 1 };
        this.sessions.set(personId, updated);
        if (this.snapshot.personId === personId) this.publish({ session: updated });
      }
    } catch {
      if (this.snapshot.personId === personId) this.publish({ recordingError: 'This page is open, but the visit could not be saved. History may be incomplete.' });
    }
  }

  async navigate(input: string, method: NavigationMethod = 'typed') {
    const personId = this.snapshot.personId;
    const address = normalizeAddress(input);
    if (!personId || !address) {
      this.cancel();
      this.publish({ pending: false, error: personId ? 'Enter a fictional address such as tidepool.zz, without a URL scheme or path.' : 'Choose a person before browsing.' });
      return;
    }
    this.cancel();
    const requestId = this.requestId;
    this.abort = new AbortController();
    this.publish({ pending: true, error: null, recordingError: null });
    try {
      const site = await this.api.site(address, this.abort.signal);
      if (requestId !== this.requestId || this.snapshot.personId !== personId) return;
      const base = { id: 'entry-' + ++this.nextId, scrollY: 0 };
      const entry: NavigationEntry = site ? { ...base, kind: 'website', site: { ...site } } : { ...base, kind: 'missing', address };
      this.append(entry);
      await this.record(personId, entry, method);
    } catch {
      if (requestId === this.requestId && this.snapshot.personId === personId) {
        this.publish({ pending: false, error: 'The page could not be loaded. Your previous view is unchanged; try again.' });
      }
    }
  }

  async search(input: string) {
    const personId = this.snapshot.personId;
    const query = input.trim().replace(/\s+/g, ' ');
    if (!personId || !query || query.length > 100) {
      this.cancel(); this.publish({ pending: false, error: 'Enter a search query between 1 and 100 characters.' }); return;
    }
    this.cancel();
    const requestId = this.requestId;
    this.abort = new AbortController();
    this.publish({ pending: true, error: null });
    try {
      const result = await this.api.search(query, this.abort.signal);
      if (requestId !== this.requestId || this.snapshot.personId !== personId) return;
      this.append({ id: 'entry-' + ++this.nextId, kind: 'search', result: { ...result, items: result.items.map((item) => ({ ...item })) }, scrollY: 0 });
    } catch {
      if (requestId === this.requestId && this.snapshot.personId === personId) this.publish({ pending: false, error: 'Search could not be completed. Use up to 100 characters and balanced quotes for phrases, then try again.' });
    }
  }

  go(delta: -1 | 1) {
    const session = this.snapshot.session;
    if (!session) return;
    const index = session.index + delta;
    if (index < 0 || index >= session.entries.length) return;
    this.restore(session.entries[index].id, delta < 0 ? 'back' : 'forward');
  }

  restore(entryId: string, method: 'back' | 'forward', forceRecord = false) {
    const { personId, session } = this.snapshot;
    if (!personId || !session) return;
    const index = session.entries.findIndex((entry) => entry.id === entryId);
    if (index < 0 || (index === session.index && !forceRecord)) return;
    this.cancel();
    const delta = index - session.index;
    this.save({ ...session, index });
    this.publish({ pending: false, error: null, recordingError: null });
    this.transition('traverse', delta);
    void this.record(personId, session.entries[index], method);
  }

  dispose() { this.cancel(); this.listeners.clear(); this.transitions.clear(); }
}
