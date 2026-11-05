// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { frameDocument, readFrameMessage } from './frame-document';

describe('Isolated page document', () => {
  it('removes executable content, resources, forms, metadata, and clobbering attributes', () => {
    const malicious = '<base href="https://evil.example"><meta http-equiv="refresh" content="0;url=https://evil.example"><style>body{background:url(https://evil.example)}</style><script>parent.compromised=true</script><img src="https://evil.example" onerror="alert(1)"><iframe src="https://evil.example"></iframe><form action="/api/people"><input name="parent"></form><svg onload="alert(1)"></svg><p id="parent" style="color:red" onclick="alert(1)">Safe paragraph</p><a href="javascript:alert(1)">Bad</a>';
    const source = frameDocument(malicious, 'token', 'nonce', 50);
    const doc = new DOMParser().parseFromString(source, 'text/html');
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(doc.querySelector('script')?.textContent).not.toContain('compromised');
    expect(doc.querySelector('script')?.getAttribute('nonce')).toBe('nonce');
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("default-src 'none'");
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("script-src 'nonce-nonce'");
    expect(doc.querySelectorAll('img,iframe,object,embed,form,input,svg,base')).toHaveLength(0);
    expect(doc.querySelector('p')?.attributes).toHaveLength(0);
    expect(doc.body.textContent).toContain('Safe paragraph');
    expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
  });
  it('rewrites only normalized fictional links and prevents external or relative navigation', () => {
    const doc = new DOMParser().parseFromString(frameDocument('<a href=" TidePool.ZZ " target="_top">Open</a><a href="https://example.com">External</a><a href="/api/people">API</a><a href="//evil.example">Protocol relative</a>', 'token', 'nonce', 0), 'text/html');
    const anchors = doc.querySelectorAll('a');
    expect(anchors[0].getAttribute('data-address')).toBe('tidepool.zz');
    expect(anchors[0].getAttribute('href')).toBe('#'); expect(anchors[0].hasAttribute('target')).toBe(false);
    for (const anchor of Array.from(anchors).slice(1)) { expect(anchor.hasAttribute('href')).toBe(false); expect(anchor.hasAttribute('data-address')).toBe(false); }
  });
  it('accepts only typed messages with the private token and valid destinations', () => {
    expect(readFrameMessage({ token: 'wrong', type: 'link', value: 'a.zz' }, 'token')).toBeNull();
    expect(readFrameMessage({ token: 'token', type: 'link', value: 'https://evil.example' }, 'token')).toBeNull();
    expect(readFrameMessage({ token: 'token', type: 'scroll', value: Infinity }, 'token')).toBeNull();
    expect(readFrameMessage({ token: 'token', type: 'link', value: ' A.ZZ ' }, 'token')).toEqual({ type: 'link', value: 'a.zz' });
  });
});
