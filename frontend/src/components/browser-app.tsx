'use client';
import { PageView } from './page-view';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { browserApi } from '../lib/api';
import type { BrowserApi, Person, SiteMetadata } from '../lib/browser-types';
import { NavigationEngine } from '../lib/navigation-engine';
import { useBrowserHistory } from '../lib/use-browser-history';
import { AddressForm, SearchForm } from './browser-forms';
import { HistoryPanel } from './history-panel';
import { SearchResults } from './search-results';
import { PublishDialog } from './publish-dialog';



export default function BrowserApplication() {
  const [retry, setRetry] = useState(0);
  return <BrowserApp key={retry} api={browserApi} onRetry={() => setRetry((value) => value + 1)} />;
}

export function BrowserApp({ api, onRetry }: { api: BrowserApi; onRetry: () => void }) {
  const [engine] = useState(() => new NavigationEngine(api));
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [data, setData] = useState<{ loading: boolean; failed: boolean; people: Person[]; sites: SiteMetadata[] }>({ loading: true, failed: false, people: [], sites: [] });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  useBrowserHistory(engine);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([api.people(abort.signal), api.sites(abort.signal)]).then(([people, sites]) => {
      if (abort.signal.aborted) return;
      setData({ loading: false, failed: false, people, sites });
      if (people[0]) engine.selectPerson(people[0]._id);
    }).catch(() => { if (!abort.signal.aborted) setData({ loading: false, failed: true, people: [], sites: [] }); });
    return () => { abort.abort(); engine.dispose(); };
  }, [api, engine]);
  const session = snapshot.session;
  const entry = session?.entries[session.index];
  const entryId = entry?.id ?? '';
  const address = entry?.kind === 'website' ? entry.site.address : entry?.kind === 'missing' ? entry.address : '';
  const onLink = useCallback((address: string) => { void engine.navigate(address, 'link'); }, [engine]);
  const onScroll = useCallback((position: number) => engine.setScroll(entryId, position), [engine, entryId]);
  const onHistory = useCallback((address: string) => { void engine.navigate(address, 'history'); }, [engine]);
  return <div className="browser-app">
    <header className="app-header"><a className="brand" href="#" onClick={(event) => event.preventDefault()} aria-label="Small Web Browser"><span className="brand-mark" aria-hidden="true">sw</span><span>Small Web Browser<small>A neighborhood of fictional websites</small></span></a>
      <div className="header-actions"><button className="secondary-button" disabled={data.loading || data.people.length === 0} onClick={() => setPublishing(true)}>Publish</button><div className="person-control"><label htmlFor="person-selector">Browsing as</label><select id="person-selector" value={snapshot.personId ?? ''} disabled={data.loading || data.people.length === 0} onChange={(event) => engine.selectPerson(event.target.value)}><option value="" disabled>{data.loading ? 'Loading people…' : 'Choose a person'}</option>{data.people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}</select></div></div>
    </header>
    {data.people.length > 0 && <PublishDialog open={publishing} people={data.people} onClose={() => setPublishing(false)} onPublished={(site) => setData((previous) => ({ ...previous, sites: [site, ...previous.sites.filter((item) => item.address !== site.address)] }))} onOpenSite={(address) => { setPublishing(false); void engine.navigate(address, 'typed'); }} />}
    {data.loading ? <div className="app-empty" role="status">Loading the small web…</div> : data.failed ? <div className="app-empty" role="alert"><h1>The small web is unavailable.</h1><p>People and pages could not be loaded.</p><button className="primary-button" onClick={onRetry}>Try again</button></div> : data.people.length === 0 ? <div className="app-empty"><h1>No people are available yet.</h1><p>Choose a person once one has been added to start browsing.</p></div> : entry && session && snapshot.personId ? <>
      <section className="browser-window" aria-label="Simulated web browser">
        <div className="browser-toolbar"><div className="navigation-buttons"><button aria-label="Back" title="Back" disabled={session.index === 0} onClick={() => engine.go(-1)}>←<span>Back</span></button><button aria-label="Forward" title="Forward" disabled={session.index === session.entries.length - 1} onClick={() => engine.go(1)}>→<span>Forward</span></button></div>
          <AddressForm key={entry.id + '-address'} address={address} onGo={(address) => { void engine.navigate(address); }} />
          <button className="history-toggle secondary-button" aria-controls="history-panel" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)}>History</button>
        </div>
        <div className="search-strip"><span className="network-label"><span aria-hidden="true" />FICTIONAL .ZZ NETWORK</span><SearchForm key={entry.id + '-search'} query={entry.kind === 'search' ? entry.result.query : ''} onSearch={(query) => { void engine.search(query); }} /></div>
        {snapshot.error && <p className="notice error-notice" role="alert">{snapshot.error}</p>}
        {snapshot.recordingError && <p className="notice" role="alert">{snapshot.recordingError}</p>}
        <div className="browser-body"><PageView key={entry.id} entry={entry} pending={snapshot.pending} onLink={onLink} onScroll={onScroll} caption={

          <div className="view-caption"><span>{entry.kind === 'website' ? entry.site.title : entry.kind === 'search' ? 'Search · ' + entry.result.query : entry.kind === 'missing' ? 'Page not found' : 'Start exploring'}</span><span>{entry.kind === 'website' || entry.kind === 'missing' ? address : 'Small Web Browser'}</span></div>}>
          {entry.kind === 'website' ? null : entry.kind === 'search' ? <SearchResults key={entry.id} entry={entry} onNavigate={(address) => { void engine.navigate(address, 'search'); }} /> : entry.kind === 'missing' ? <div className="missing-view content-scroll"><span className="large-code" aria-hidden="true">404</span><span className="eyebrow">A TURN IN THE TRAIL</span><h1>This address has no page.</h1><code>{entry.address}</code><p>The link led somewhere that has not been published yet. Return with Back, search for a related topic, or try another address.</p></div> : <div className="welcome-view content-scroll"><span className="eyebrow">A SMALL WEB, READY TO EXPLORE</span><h1>Follow your curiosity.<br /><em>Leave a trail.</em></h1><p>Type a fictional address, follow a link, or search the words inside a page. Your browsing history belongs to the person selected above.</p><div className="welcome-divider"><h2>Places to begin</h2><span>{data.sites.length} published pages</span></div>{data.sites.length === 0 ? <p className="quiet-state">No sites have been published yet. An unknown address will show a missing-page view.</p> : <div className="discovery-grid">{data.sites.map((site) => <button key={site._id} onClick={() => { void engine.navigate(site.address, 'typed'); }}><span>{site.title}</span><code>{site.address} <span aria-hidden="true">↗</span></code></button>)}</div>}</div>}
        </PageView><HistoryPanel personId={snapshot.personId} version={session.historyVersion} api={api} onNavigate={onHistory} open={historyOpen} /></div>
      </section><footer className="app-footer"><span>Fictional pages. Real paths of discovery.</span><span>Page scripts and external resources are blocked.</span></footer>
    </> : null}
  </div>;
}
