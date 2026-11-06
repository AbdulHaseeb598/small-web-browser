'use client';
import type { NavigationEntry } from '../lib/browser-types';
import { HighlightedText } from './highlighted-text';

export function SearchResults({ entry, onNavigate }: {
  entry: Extract<NavigationEntry, { kind: 'search' }>;
  onNavigate: (address: string) => void;
}) {
  return <div className="search-results content-scroll">
    <span className="eyebrow">EXPLORE THE SMALL WEB</span><h1>Search results</h1>
    <p className="subtle">{entry.result.total} {entry.result.total === 1 ? 'match' : 'matches'} for <strong>“{entry.result.query}”</strong>{entry.result.total > entry.result.limit ? ' · showing the top ' + entry.result.limit : ''}</p>
    {entry.result.items.length === 0 && <div className="empty-card"><h2>No pages matched.</h2><p>Try another word or a phrase in double quotes.</p></div>}
    <ol className="result-list">{entry.result.items.map((result) => <li key={result.address}>
      <button className="result-card" onClick={() => onNavigate(result.address)}><span className="result-address">{result.address}</span><h2><HighlightedText text={result.title} query={entry.result.query} /></h2><p><HighlightedText text={result.excerpt || 'This page matches its title or address.'} query={entry.result.query} /></p><span className="result-open">Open page <span aria-hidden="true">↗</span></span></button>
    </li>)}</ol>
  </div>;
}
