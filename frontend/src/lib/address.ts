const fictionalAddress = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+zz$/;
export function normalizeAddress(value: string): string | null {
  const address = value.trim().toLowerCase();
  return address.length <= 253 && fictionalAddress.test(address) ? address : null;
}
