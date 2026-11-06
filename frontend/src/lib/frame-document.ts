import DOMPurify from 'dompurify';
import { normalizeAddress } from './address';

export function frameDocument(html: string, token: string, nonce: string, scrollY: number): { srcDoc: string; links: ReadonlySet<string> } {
  if (![token, nonce].every((value) => /^[a-zA-Z0-9_-]{1,128}$/.test(value))) throw new Error('Invalid frame capability');
  // Bound work even for legacy/imported data that bypassed the publishing DTO.
  const bounded = html.length <= 100000 ? html : '<p>This page is too large to display safely.</p>';
  // Strict allowlist: no authored scripts, CSS, forms, media, embeds, IDs/names,
  // data attributes, event handlers, or document metadata survive this boundary.
  const clean = DOMPurify.sanitize(bounded, {
    ALLOWED_TAGS: ['main','article','section','header','footer','nav','div','span','p','h1','h2','h3','h4','h5','h6','a','ul','ol','li','strong','b','em','i','blockquote','pre','code','br','hr','table','thead','tbody','tr','th','td','caption','dl','dt','dd'],
    ALLOWED_ATTR: ['href','title'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ['script','style','svg','math','template','form','iframe','object','embed'],
    SANITIZE_DOM: true, SANITIZE_NAMED_PROPS: true,
    RETURN_DOM_FRAGMENT: true,
  });
  const links = new Set<string>();
  for (const anchor of clean.querySelectorAll('a')) {
    const address = normalizeAddress(anchor.getAttribute('href') ?? '');
    anchor.removeAttribute('href');
    if (address) { links.add(address); anchor.setAttribute('href', '#'); anchor.setAttribute('data-address', address); }
    else { anchor.setAttribute('aria-disabled', 'true'); anchor.setAttribute('title', 'Only fictional .zz links can be opened'); }
  }
  const content = document.createElement('div'); content.append(clean);
  const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'none'; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  // Only this application-owned script receives the nonce. Authored data is
  // confined to the sanitized body, never interpolated into executable code.
  const bridge = `(() => {
    const token = ${JSON.stringify(token)};
    const targets = new WeakMap(Array.from(document.querySelectorAll('a[data-address]'), a => [a, a.getAttribute('data-address')]));
    const send = (type, value) => parent.postMessage({ token, type, value }, '*');
    document.addEventListener('click', event => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor) return;
      event.preventDefault();
      const address = targets.get(anchor);
      if (event.isTrusted && address) send('link', address);
    });
    document.addEventListener('auxclick', event => event.preventDefault());
    let queued = false;
    addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; send('scroll', scrollY); });
    }, { passive: true });
    addEventListener('load', () => {
      history.scrollRestoration = 'manual';
      requestAnimationFrame(() => { scrollTo(0,${Math.max(0, Number.isFinite(scrollY) ? scrollY : 0)}); });
    });
  })();`;
  const srcDoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><style nonce="${nonce}">:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:40px 32px 70px;background:#fff;color:#25352f;font:17px/1.8 Georgia,serif;overflow-wrap:anywhere}body>div{max-width:760px;margin:auto}h1,h2,h3{font-family:Arial,sans-serif;line-height:1.2;color:#193c2c}h1{font-size:36px;letter-spacing:-1px;margin:0 0 28px}p{margin:0 0 24px}a{color:#176c50;text-decoration:underline;text-underline-offset:4px}a:focus-visible{outline:3px solid #167451;outline-offset:4px}nav{margin-top:36px;padding-top:20px;border-top:1px solid #dce5df}pre{white-space:pre-wrap;overflow-wrap:anywhere}table{display:block;max-width:100%;overflow:auto}a[aria-disabled]{color:#69766f} @media(max-width:600px){body{padding:28px 22px;font-size:16px}h1{font-size:28px}}</style></head><body><div>${content.innerHTML}</div><script nonce="${nonce}">${bridge}</script></body></html>`;
  return { srcDoc, links };
}

export type FrameMessage = { type: 'link'; value: string } | { type: 'scroll'; value: number };
export function readFrameMessage(data: unknown, token: string, links: ReadonlySet<string>): FrameMessage | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data) || Object.keys(data).length !== 3 || !Object.hasOwn(data, 'token') || !Object.hasOwn(data, 'type') || !Object.hasOwn(data, 'value') || !('token' in data) || data.token !== token || !('type' in data) || !('value' in data)) return null;
  if (data.type === 'link' && typeof data.value === 'string') {
    const address = normalizeAddress(data.value); return address && links.has(address) ? { type: 'link', value: address } : null;
  }
  if (data.type === 'scroll' && typeof data.value === 'number' && Number.isFinite(data.value) && data.value >= 0 && data.value <= 10000000) return { type: 'scroll', value: data.value };
  return null;
}
