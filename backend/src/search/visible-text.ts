import { parse, type DefaultTreeAdapterMap } from 'parse5';

const excluded = new Set([
  'head',
  'script',
  'style',
  'template',
  'noscript',
  'svg',
  'math',
  'iframe',
  'object',
]);
const boundaries = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
  'table', 'td', 'th', 'tr', 'ul',
]);
export function visibleText(html: string): string {
  const chunks: string[] = [];
  // An explicit work stack avoids call-stack overflow for deeply nested but
  // size-valid authored HTML. String markers preserve block boundaries.
  const pending: (DefaultTreeAdapterMap['node'] | string)[] = [parse(html)];
  while (pending.length) {
    const node = pending.pop()!;
    if (typeof node === 'string') { chunks.push(node); continue; }
    if ('tagName' in node) {
      if (
        excluded.has(node.tagName) ||
        node.attrs.some(
          (attr) =>
            attr.name === 'hidden' ||
            (attr.name === 'aria-hidden' && attr.value === 'true') ||
            (attr.name === 'style' &&
              /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr.value)),
        )
      )
        continue;
    }
    const boundary = 'tagName' in node && boundaries.has(node.tagName);
    if (boundary) chunks.push(' ');
    if ('value' in node && node.nodeName === '#text') chunks.push(node.value);
    if (boundary) pending.push(' ');
    if ('childNodes' in node) {
      for (let index = node.childNodes.length - 1; index >= 0; index--) pending.push(node.childNodes[index]);
    }
  }
  return chunks.join('').replace(/\s+/g, ' ').trim();
}
