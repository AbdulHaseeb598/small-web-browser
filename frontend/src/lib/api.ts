// Browser requests must use the host-published URL, never Docker DNS.
export const publicApiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Server-side requests can use the backend service on the Compose network.
export const serverApiUrl = process.env.API_URL ?? publicApiUrl;

import type { BrowserApi, HistoryPage, Person, Publication, SearchResponse, SearchResult, Site, SiteMetadata, Visit } from './browser-types';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const person = (v: unknown): v is Person => object(v) && typeof v._id === 'string' && typeof v.name === 'string' && typeof v.createdAt === 'string';
const metadata = (v: unknown): v is SiteMetadata => object(v) && ['_id','address','title','authorId','createdAt','updatedAt'].every((key) => typeof v[key] === 'string');
const site = (v: unknown): v is Site => metadata(v) && object(v) && typeof v.html === 'string';
const visit = (v: unknown): v is Visit => object(v) && ['_id','personId','address','visitedAt','method'].every((key) => typeof v[key] === 'string') && typeof v.exists === 'boolean';
const result = (v: unknown): v is SearchResult => object(v) && typeof v.address === 'string' && typeof v.title === 'string' && typeof v.excerpt === 'string' && typeof v.score === 'number';
const history = (v: unknown): v is HistoryPage => object(v) && Array.isArray(v.items) && v.items.every(visit) && ['total','page','limit'].every((key) => typeof v[key] === 'number');
const search = (v: unknown): v is SearchResponse => object(v) && Array.isArray(v.items) && v.items.every(result) && typeof v.query === 'string' && typeof v.total === 'number' && typeof v.limit === 'number';

async function request(path: string, signal?: AbortSignal, body?: unknown): Promise<unknown> {
  const response = await fetch(publicApiUrl.replace(/\/$/, '') + path, {
    signal, method: body === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new ApiError(response.status, 'API request failed');
  return response.json();
}
function decode<T>(data: unknown, guard: (value: unknown) => value is T): T {
  if (!guard(data)) throw new Error('Unexpected API response');
  return data;
}
export async function publishSite(input: Publication, signal?: AbortSignal): Promise<Site> {
  return decode(await request('/sites', signal, input), site);
}
export const browserApi: BrowserApi = {
  people: async (signal) => decode(await request('/people', signal), (v): v is Person[] => Array.isArray(v) && v.every(person)),
  sites: async (signal) => decode(await request('/sites', signal), (v): v is SiteMetadata[] => Array.isArray(v) && v.every(metadata)),
  site: async (address, signal) => {
    try { return decode(await request('/sites/' + encodeURIComponent(address), signal), site); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  },
  search: async (query, signal) => decode(await request('/search?q=' + encodeURIComponent(query), signal), search),
  history: async (personId, page, signal) => decode(await request('/people/' + encodeURIComponent(personId) + '/visits?page=' + page + '&limit=20', signal), history),
  record: async (personId, address, method) => { await request('/visits', undefined, { personId, address, method }); },
};
