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
    if ('value' in node && node.nodeName === '#text') chunks.push(node.value);
    if ('childNodes' in node) for (const child of node.childNodes) walk(child);
  }
  walk(parse(html));
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}
