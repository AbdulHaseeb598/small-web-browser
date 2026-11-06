// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { highlightParts, searchTerms } from './search-highlights';
import { HighlightedText } from '../components/highlighted-text';
import { frameDocument, readFrameMessage } from './frame-document';

afterEach(cleanup);
describe('Literal search highlighting', () => {
  it.each([
    ['Notes from the Night Garden', 'garden', ['Garden']],
    ['Garden soil and GARDEN weather', 'garden soil', ['Garden', 'soil', 'GARDEN']],
    ['Light pollution and night garden', '"light pollution" garden', ['Light pollution', 'garden']],
    ['An a+b (garden) [patch].', 'a+b (garden) [patch].', ['a+b', '(garden)', '[patch].']],
    ['abcd', 'abc bcd', ['abcd']],
    ['Gardening in a garden', 'garden', ['Garden', 'garden']],
    ['İ near Garden', 'garden', ['Garden']],
  ])('preserves text while marking %s for %s', (text, query, matches) => {
    const parts = highlightParts(text, query);
    expect(parts.map((part) => part.text).join('')).toBe(text);
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(matches);
  });
  it('handles no matches, empty queries and the API phrase normalization', () => {
    expect(highlightParts('Original', 'absent')).toEqual([{ text: 'Original', match: false }]);
    expect(highlightParts('Original', '')).toEqual([{ text: 'Original', match: false }]);
    expect(searchTerms('  "LIGHT   pollution" Garden garden ')).toEqual(['light pollution', 'garden']);
  });
  it('renders XSS-like text and queries as text nodes with semantic marks', () => {
    const text = '<img src=x onerror=alert(1)> and <script>unsafe</script>';
    const { container } = render(<HighlightedText text={text} query="<img src=x onerror=alert(1)>" />);
    expect(container.textContent).toBe(text);
    expect(container.querySelectorAll('img,script')).toHaveLength(0);
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
  });
  it('highlights only sanitized visible text, leaving URLs, attributes and the bridge untouched', () => {
    const html = '<h1>Garden</h1><p>A <em>garden</em> plot.</p><a href="garden.zz" title="garden">Garden link</a><p>https://garden.zz and garden.zz are URLs; garden is text.</p><p hidden>garden hidden</p><p aria-hidden="true">garden aria</p><p style="display:none">garden invisible</p><script>garden dangerous</script><pre>garden code</pre>';
    const { srcDoc, links } = frameDocument(html, 'token', 'nonce', 'garden');
    const doc = new DOMParser().parseFromString(srcDoc, 'text/html');
    expect([...doc.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['Garden', 'garden', 'Garden', 'garden', 'garden']);
    expect(doc.body.textContent).not.toMatch(/garden (hidden|aria|invisible|dangerous)/);
    expect(doc.querySelector('a')?.getAttribute('data-address')).toBe('garden.zz');
    expect(doc.querySelector('a')?.getAttribute('title')).toBe('garden');
    expect(doc.querySelector('script')?.textContent).not.toContain('garden');
    expect([...links]).toEqual(['garden.zz']);
    expect(doc.querySelector('pre mark')?.textContent).toBe('garden');
  });
  it('does not interpret a malicious query as markup inside the sanitized iframe', () => {
    const query = '</script><img src=x onerror=alert(1)>';
    const { srcDoc } = frameDocument('<p>&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;</p><a href="safe.zz">Safe</a>', 'token', 'nonce', query);
    const doc = new DOMParser().parseFromString(srcDoc, 'text/html');
    expect(doc.querySelectorAll('img,[onerror]')).toHaveLength(0);
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(doc.querySelector('p')?.textContent).toBe(query);
  });
  it('accepts only bounded integer height reports with the same capability checks', () => {
    const links = new Set(['a.zz']);
    expect(readFrameMessage({ token: 'token', type: 'height', value: 450 }, 'token', links)).toEqual({ type: 'height', value: 450 });
    for (const value of [0, -1, 1.5, NaN, Infinity, 10000001, '450']) expect(readFrameMessage({ token: 'token', type: 'height', value }, 'token', links)).toBeNull();
    expect(readFrameMessage({ token: 'wrong', type: 'height', value: 450 }, 'token', links)).toBeNull();
  });
});
