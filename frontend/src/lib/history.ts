import type { Visit } from './browser-types';
export function mergeHistory(current: Visit[], incoming: Visit[]): Visit[] {
  return [...new Map([...current, ...incoming].map((visit) => [visit._id, visit])).values()]
    .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt) || (a._id < b._id ? 1 : a._id > b._id ? -1 : 0));
}
