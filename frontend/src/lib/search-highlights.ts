export interface HighlightPart { text: string; match: boolean }

// Same normalization, quoted phrases, and literal substring matching as search.
// Query strings are never compiled into regular expressions or HTML.
export function searchTerms(query: string): string[] {
  const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized || normalized.length > 100) return [];
  return [...new Set(Array.from(normalized.matchAll(/"([^"]+)"|(\S+)/g), (match) => match[1] ?? match[2]))].slice(0, 10);
}

export function highlightParts(text: string, query: string, skipUrls = false): HighlightPart[] {
  const folded = text.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  // Case folding can expand a character, e.g. İ -> i + combining dot. Keep
  // offsets in the original text so highlighting never changes capitalization.
  const offsets: { start: number; end: number }[] = [];
  if (folded.length !== text.length) {
    let offset = 0;
    for (const character of text) {
      for (let n = 0; n < character.toLowerCase().length; n++) offsets.push({ start: offset, end: offset + character.length });
      offset += character.length;
    }
  }
  const urls = skipUrls ? Array.from(text.matchAll(/(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,})[^\s<>]*/gi), (match) => ({ start: match.index, end: match.index + match[0].length })) : [];
  for (const term of searchTerms(query)) {
    let at = folded.indexOf(term);
    while (at !== -1) {
      const start = offsets.length ? offsets[at].start : at;
      const end = offsets.length ? offsets[at + term.length - 1].end : at + term.length;
      if (!urls.some((url) => start < url.end && end > url.start)) ranges.push({ start, end });
      at = folded.indexOf(term, at + 1);
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  const parts: HighlightPart[] = [];
  let offset = 0;
  for (const range of merged) {
    if (range.start > offset) parts.push({ text: text.slice(offset, range.start), match: false });
    parts.push({ text: text.slice(range.start, range.end), match: true }); offset = range.end;
  }
  if (offset < text.length || parts.length === 0) parts.push({ text: text.slice(offset), match: false });
  return parts;
}

export function highlightDocument(root: DocumentFragment, query: string): void {
  if (!searchTerms(query).length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) if (walker.currentNode instanceof Text) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parts = highlightParts(node.data, query, true);
    if (!parts.some((part) => part.match)) continue;
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (part.match) { const mark = document.createElement('mark'); mark.textContent = part.text; fragment.append(mark); }
      else fragment.append(document.createTextNode(part.text));
    }
    node.replaceWith(fragment);
  }
}
