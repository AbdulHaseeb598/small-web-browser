import { highlightParts } from '../lib/search-highlights';

export function HighlightedText({ text, query }: { text: string; query: string }) {
  return <>{highlightParts(text, query).map((part, index) => part.match ? <mark key={index}>{part.text}</mark> : part.text)}</>;
}
