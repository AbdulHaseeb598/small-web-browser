// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressForm, SearchForm } from './browser-forms';
import { HistoryPanel } from './history-panel';
import type { BrowserApi, HistoryPage, Visit } from '../lib/browser-types';
import PageFrame from './page-frame';

afterEach(cleanup);
const item = (n: number, personId = 'p1'): Visit => ({ _id: n.toString(16).padStart(24, '0'), personId, address: 'page' + n + '.zz', visitedAt: '2026-01-01T10:00:00Z', method: 'typed', exists: n !== 1 });
const api = (): BrowserApi => ({ people: vi.fn(async () => []), sites: vi.fn(async () => []), site: vi.fn(async () => null), search: vi.fn(async (query) => ({ query, items: [], total: 0, limit: 20 })), record: vi.fn(async () => {}), history: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })) });

describe('Accessible forms and per-person history', () => {
  it('submits addresses and search queries with Enter without passive actions', async () => {
    const go = vi.fn(); const search = vi.fn(); const user = userEvent.setup();
    render(<><AddressForm address="" onGo={go} /><SearchForm query="" onSearch={search} /></>);
    expect(go).not.toHaveBeenCalled(); await user.type(screen.getByLabelText('Fictional website address'), 'tidepool.zz{Enter}');
    expect(go).toHaveBeenCalledExactlyOnceWith('tidepool.zz');
    await user.type(screen.getByLabelText('Search the small web'), 'light pollution{Enter}');
    expect(search).toHaveBeenCalledExactlyOnceWith('light pollution');
  });
  it('loads pages, deduplicates IDs, orders timestamp ties, and navigates from history', async () => {
    const client = api(); const navigate = vi.fn();
    vi.mocked(client.history).mockResolvedValueOnce({ items: Array.from({ length: 20 }, (_, n) => item(n + 1)), total: 21, page: 1, limit: 20 }).mockResolvedValueOnce({ items: [item(20), item(0)], total: 21, page: 2, limit: 20 });
    render(<HistoryPanel personId="p1" version={0} api={client} onNavigate={navigate} open />);
    await screen.findByText('Missing page'); fireEvent.click(screen.getByRole('button', { name: 'Load more history' }));
    await screen.findByText('page0.zz');
    const buttons = screen.getAllByRole('button').filter((button) => button.classList.contains('history-item'));
    expect(buttons).toHaveLength(21); expect(buttons[0].textContent).toContain('page20.zz'); expect(buttons[20].textContent).toContain('page0.zz');
    fireEvent.click(buttons[0]); expect(navigate).toHaveBeenCalledExactlyOnceWith('page20.zz');
  });
  it('does not expose a previous person’s delayed history response', async () => {
    const client = api(); let resolveOld!: (page: HistoryPage) => void;
    vi.mocked(client.history).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce({ items: [item(2, 'p2')], total: 1, page: 1, limit: 20 });
    const { rerender } = render(<HistoryPanel personId="p1" version={0} api={client} onNavigate={vi.fn()} open />);
    rerender(<HistoryPanel personId="p2" version={0} api={client} onNavigate={vi.fn()} open />);
    await screen.findByText('page2.zz'); resolveOld({ items: [item(1)], total: 1, page: 1, limit: 20 });
    await waitFor(() => expect(screen.queryByText('page1.zz')).toBeNull());
  });
  it('provides an empty state and recovers from a history API error', async () => {
    const client = api(); vi.mocked(client.history).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 20 });
    render(<HistoryPanel personId="p1" version={0} api={client} onNavigate={vi.fn()} open />);
    await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(/No visits yet/); expect(client.history).toHaveBeenCalledTimes(2);
  });
  it('renders an opaque sandbox and ignores forged messages from other windows', () => {
    const link = vi.fn(); const scroll = vi.fn();
    render(<PageFrame html="<p>Hello</p>" title="Test page" scrollY={0} onLink={link} onScroll={scroll} />);
    const iframe = screen.getByTitle('Website: Test page');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts'); expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: 'null', data: { token: 'forged', type: 'link', value: 'a.zz' } }));
    expect(link).not.toHaveBeenCalled(); expect(scroll).not.toHaveBeenCalled();
  });
});
