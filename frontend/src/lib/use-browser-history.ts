'use client';
import { useEffect } from 'react';
import { MAX_PERSON_SESSIONS, MAX_SESSION_ENTRIES, type NavigationEngine } from './navigation-engine';

type Marker = { owner: string; personId: string; entryId: string; position: number };
function marker(value: unknown): value is Marker {
  return typeof value === 'object' && value !== null && 'owner' in value && typeof value.owner === 'string' && 'personId' in value && typeof value.personId === 'string' && 'entryId' in value && typeof value.entryId === 'string' && 'position' in value && typeof value.position === 'number';
}

export function useBrowserHistory(engine: NavigationEngine) {
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const owner = crypto.randomUUID();
    let position = 0;
    let initialized = false;
    let applyingPop = false;
    const markers = new Map<number, Marker>();
    const unsubscribe = engine.observe((transition) => {
      if (applyingPop) return;
      const target = markers.get(position + transition.delta);
      if (transition.type === 'traverse' && target?.personId === transition.personId && target.entryId === transition.entryId) {
        window.history.go(transition.delta); return;
      }
      const replace = !initialized;
      if (!replace) position++;
      for (const key of markers.keys()) if (key > position) markers.delete(key);
      const next = { owner, position, personId: transition.personId, entryId: transition.entryId };
      markers.set(position, next);
      if (markers.size > MAX_PERSON_SESSIONS * MAX_SESSION_ENTRIES) markers.delete(markers.keys().next().value!);
      const state = { ...window.history.state, smallBrowser: next };
      if (replace) window.history.replaceState(state, ''); else window.history.pushState(state, '');
      initialized = true;
    });
    const pop = (event: PopStateEvent) => {
      const next: unknown = event.state?.smallBrowser;
      if (!marker(next) || next.owner !== owner || !engine.hasEntry(next.personId, next.entryId)) return;
      const method = next.position < position ? 'back' : 'forward';
      const changedPerson = engine.getSnapshot().personId !== next.personId;
      applyingPop = true;
      try { engine.selectPerson(next.personId); engine.restore(next.entryId, method, changedPerson); position = next.position; }
      finally { applyingPop = false; }
    };
    window.addEventListener('popstate', pop);
    return () => { unsubscribe(); window.removeEventListener('popstate', pop); window.history.scrollRestoration = previousRestoration; };
  }, [engine]);
}
