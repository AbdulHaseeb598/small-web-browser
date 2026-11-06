export interface Person { _id: string; name: string; createdAt: string }
export interface SiteMetadata { _id: string; address: string; title: string; authorId: string; createdAt: string; updatedAt: string }
export interface Site extends SiteMetadata { html: string }
export interface Publication { address: string; title: string; html: string; authorId: string }
export type NavigationMethod = 'typed' | 'link' | 'back' | 'forward' | 'history' | 'search';
export interface Visit { _id: string; personId: string; address: string; visitedAt: string; method: NavigationMethod; exists: boolean }
export interface HistoryPage { items: Visit[]; total: number; page: number; limit: number }
export interface SearchResult { address: string; title: string; excerpt: string; score: number }
export interface SearchResponse { query: string; items: SearchResult[]; total: number; limit: number }
export type NavigationEntry = { id: string; scrollY: number } & (
  | { kind: 'home' }
  | { kind: 'website'; site: Site }
  | { kind: 'missing'; address: string }
  | { kind: 'search'; result: SearchResponse }
);
export interface BrowserApi {
  people(signal?: AbortSignal): Promise<Person[]>;
  sites(signal?: AbortSignal): Promise<SiteMetadata[]>;
  site(address: string, signal?: AbortSignal): Promise<Site | null>;
  search(query: string, signal?: AbortSignal): Promise<SearchResponse>;
  history(personId: string, page: number, signal?: AbortSignal): Promise<HistoryPage>;
  record(personId: string, address: string, method: NavigationMethod): Promise<void>;
}
