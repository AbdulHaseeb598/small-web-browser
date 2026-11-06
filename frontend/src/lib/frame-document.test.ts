// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { frameDocument, readFrameMessage } from './frame-document';

describe('Isolated page document', () => {
  it.each([
    '<script>parent.hacked=true</script>',
    '<p onclick="parent.hacked=true" onmouseover="alert(1)">Text</p>',
    '<a href="javascript:alert(1)">Unsafe</a>',
    '<a href="jav&#x61;script:alert(1)">Unsafe</a>',
    '<a href="data:text/html,<script>alert(1)</script>">Unsafe</a>',
    '<a href="blob:https://example.com/id">Unsafe</a>',
    '<iframe srcdoc="<script>top.location=1</script>"></iframe>',
    '<object data="https://evil.example"></object><embed src="https://evil.example">',
    '<img src="https://evil.example" srcset="https://evil.example 2x">',
    '<link rel="stylesheet" href="https://evil.example"><style>@import "https://evil.example";</style>',
    '<p style="background:url(https://evil.example)">Text</p>',
    '<form action="https://evil.example"><button formaction="https://evil.example">Send</button></form>',
    '<meta http-equiv="refresh" content="0;url=https://evil.example"><base href="https://evil.example">',
    '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
    '<svg><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>',
    '<a id="parent" name="location" target="_top" ping="https://evil.example" download href="https://evil.example">Escape</a>',
  ])('contains an attack vector: %s', (attack) => {
    const { srcDoc, links } = frameDocument('<h2>Safe text</h2><a href="safe.zz">Safe link</a>' + attack, 'token', 'nonce', 0);
    const doc = new DOMParser().parseFromString(srcDoc, 'text/html');
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(doc.querySelectorAll('style')).toHaveLength(1);
    expect(doc.body.querySelectorAll('script,style,link,img,iframe,object,embed,form,input,button,svg,math,base,meta')).toHaveLength(1); // Trusted bridge only.
    for (const element of doc.body.querySelectorAll('*')) for (const attr of element.attributes) {
      expect(attr.name).not.toMatch(/^on|^(?:src|srcset|style|id|name|target|ping|download|action)$/);
    }
    expect(doc.body.textContent).toContain('Safe text');
    expect([...links]).toEqual(['safe.zz']);
  });
  it('fails closed on oversized imported HTML and invalid trusted capabilities', () => {
    const { srcDoc, links } = frameDocument('x'.repeat(100001) + '<a href="a.zz">X</a>', 'token', 'nonce', 0);
    expect(srcDoc).toContain('too large to display safely'); expect(links.size).toBe(0);
    expect(() => frameDocument('<p>X</p>', '</script>', 'nonce', 0)).toThrow('Invalid frame capability');
  });
  it('rejects undeclared addresses, extra fields, inherited properties, and invalid scrolling', () => {
    const links = new Set(['a.zz']);
    for (const payload of [
      { token: 'token', type: 'link', value: 'b.zz' },
      { token: 'token', type: 'link', value: 'a.zz', extra: true },
      Object.create({ token: 'token', type: 'link', value: 'a.zz' }),
      { token: 'token', type: 'scroll', value: -1 },
      { token: 'token', type: 'scroll', value: 10000001 },
      { token: 'token', type: 'scroll', value: NaN },
      { token: 'token', type: 'link', value: {} },
      { token: 'token', type: 'ready', value: true }, null, [],
    ]) expect(readFrameMessage(payload, 'token', links)).toBeNull();
  });
  it('removes executable content, resources, forms, metadata, and clobbering attributes', () => {
    const malicious = '<base href="https://evil.example"><meta http-equiv="refresh" content="0;url=https://evil.example"><style>body{background:url(https://evil.example)}</style><script>parent.compromised=true</script><img src="https://evil.example" onerror="alert(1)"><iframe src="https://evil.example"></iframe><form action="/api/people"><input name="parent"></form><svg onload="alert(1)"></svg><p id="parent" style="color:red" onclick="alert(1)">Safe paragraph</p><a href="javascript:alert(1)">Bad</a>';
    const { srcDoc: source } = frameDocument(malicious, 'token', 'nonce', 50);
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
    const doc = new DOMParser().parseFromString(frameDocument('<a href=" TidePool.ZZ " target="_top">Open</a><a href="https://example.com">External</a><a href="/api/people">API</a><a href="//evil.example">Protocol relative</a>', 'token', 'nonce', 0).srcDoc, 'text/html');
    const anchors = doc.querySelectorAll('a');
    expect(anchors[0].getAttribute('data-address')).toBe('tidepool.zz');
    expect(anchors[0].getAttribute('href')).toBe('#'); expect(anchors[0].hasAttribute('target')).toBe(false);
    for (const anchor of Array.from(anchors).slice(1)) { expect(anchor.hasAttribute('href')).toBe(false); expect(anchor.hasAttribute('data-address')).toBe(false); }
  });
  it('accepts only typed messages with the private token and valid destinations', () => {
    expect(readFrameMessage({ token: 'wrong', type: 'link', value: 'a.zz' }, 'token', new Set(['a.zz']))).toBeNull();
    expect(readFrameMessage({ token: 'token', type: 'link', value: 'https://evil.example' }, 'token', new Set(['a.zz']))).toBeNull();
    expect(readFrameMessage({ token: 'token', type: 'scroll', value: Infinity }, 'token', new Set(['a.zz']))).toBeNull();
    expect(readFrameMessage({ token: 'token', type: 'link', value: ' A.ZZ ' }, 'token', new Set(['a.zz']))).toEqual({ type: 'link', value: 'a.zz' });
  });
});
