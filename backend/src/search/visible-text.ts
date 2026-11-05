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
  function walk(node: DefaultTreeAdapterMap['node']) {
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
        return;
    }
    const boundary = 'tagName' in node && boundaries.has(node.tagName);
    if (boundary) chunks.push(' ');
    if ('value' in node && node.nodeName === '#text') chunks.push(node.value);
    if ('childNodes' in node) for (const child of node.childNodes) walk(child);
    if (boundary) chunks.push(' ');
  }
  walk(parse(html));
  return chunks.join('').replace(/\s+/g, ' ').trim();
}
