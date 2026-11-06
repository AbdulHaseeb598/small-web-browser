'use client';
import dynamic from 'next/dynamic';
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { NavigationEntry } from '../lib/browser-types';

const PageFrame = dynamic(() => import('./page-frame'), { ssr: false, loading: () => <p role="status" className="quiet-state">Preparing page…</p> });

// One main scroll owner for home, results, missing pages, and expanded iframe
// content. The iframe reports layout size; it never reads or controls the parent.
export function PageView({ entry, pending, caption, onLink, onScroll, children }: {
  entry: NavigationEntry; pending: boolean; caption: ReactNode;
  onLink: (address: string) => void; onScroll: (position: number) => void; children?: ReactNode;
}) {
  const pane = useRef<HTMLElement>(null);
  const initialScroll = useRef(entry.scrollY);
  const restored = useRef(false);
  const [ready, setReady] = useState(entry.kind !== 'website');
  const frameReady = useCallback(() => setReady(true), []);
  useLayoutEffect(() => {
    if (!ready || !pane.current) return;
    pane.current.scrollTop = initialScroll.current;
    restored.current = true;
  }, [ready]);
  return <section ref={pane} className="view-pane" aria-label="Current page" aria-busy={pending} tabIndex={0} onScroll={(event) => { if (restored.current) onScroll(event.currentTarget.scrollTop); }}>
    {pending && <div className="loading-line" role="status">Opening…</div>}
    {caption}
    {entry.kind === 'website' ? <PageFrame html={entry.site.html} title={entry.site.title} searchQuery={entry.searchQuery} onLink={onLink} onReady={frameReady} /> : children}
  </section>;
}
