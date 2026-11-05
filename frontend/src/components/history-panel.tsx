'use client';
import { useEffect, useRef, useState } from 'react';
import type { BrowserApi, Visit } from '../lib/browser-types';
import { mergeHistory } from '../lib/history';

export function HistoryPanel({ personId, version, api, onNavigate, open }: {
  personId: string; version: number; api: BrowserApi; onNavigate: (address: string) => void; open: boolean;
}) {
  const [refresh, setRefresh] = useState(0);
  return <aside id="history-panel" className={'history-panel ' + (open ? 'is-open' : '')} aria-label="Browsing history">
    <div className="panel-heading"><div><span className="eyebrow">YOUR FOOTSTEPS</span><h2>History</h2></div><button className="text-button" onClick={() => setRefresh((value) => value + 1)}>Refresh</button></div>
    <HistoryList key={personId + ':' + version + ':' + refresh} personId={personId} api={api} onNavigate={onNavigate} />
  </aside>;
}

function HistoryList({ personId, api, onNavigate }: { personId: string; api: BrowserApi; onNavigate: (address: string) => void }) {
  const [items, setItems] = useState<Visit[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController(); controller.current = abort;
    api.history(personId, 1, abort.signal).then((data) => {
      if (abort.signal.aborted) return;
      setItems(mergeHistory([], data.items)); setTotal(data.total); setPage(1); setLoading(false);
    }).catch(() => { if (!abort.signal.aborted) { setError(true); setLoading(false); } });
    return () => { alive.current = false; controller.current?.abort(); };
  }, [api, personId]);

  async function more() {
    if (loading) return;
    setLoading(true); setError(false);
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    try {
      const data = await api.history(personId, page + 1, abort.signal);
      if (!alive.current || abort.signal.aborted) return;
      setItems((previous) => mergeHistory(previous, data.items)); setTotal(data.total); setPage(data.page);
    } catch { if (alive.current && !abort.signal.aborted) setError(true); }
    finally { if (alive.current && !abort.signal.aborted) setLoading(false); }
  }
  return <>
    <p className="history-count">{total} saved {total === 1 ? 'visit' : 'visits'} · newest first</p>
    <div className="history-scroll">
      {!loading && !error && items.length === 0 && <p className="quiet-state">No visits yet. Your next destination starts the trail.</p>}
      <ol className="history-list">{items.map((visit) => <li key={visit._id}>
        <button className="history-item" onClick={() => onNavigate(visit.address)}>
          <span className="history-address">{visit.address}</span>
          <span className="history-detail"><time dateTime={visit.visitedAt} title={visit.visitedAt}>{new Date(visit.visitedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><span className="method-tag">{visit.method}</span></span>
          {!visit.exists && <span className="missing-tag">Missing page</span>}
        </button>
      </li>)}</ol>
      {error && <p role="alert" className="inline-error">History could not be loaded. <button className="text-button" onClick={() => void more()}>Try again</button></p>}
      {loading && <p role="status" className="quiet-state">Loading history…</p>}
      {!loading && !error && page * 20 < total && <button className="load-more" onClick={() => void more()}>Load more history</button>}
    </div>
  </>;
}
