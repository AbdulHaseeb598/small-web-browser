// Fictional DNS-style labels ending in .zz, never a URL, port, or path.
// Each ASCII label is 1–63 characters; hyphens may only occur inside labels.
export const FICTIONAL_ADDRESS =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+zz$/;
export const ADDRESS_MAX_LENGTH = 253;

export function normalizeAddress(value: string): string;
export function normalizeAddress(value: unknown): unknown;
export function normalizeAddress(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
