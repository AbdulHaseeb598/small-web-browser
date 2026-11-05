// Browser requests must use the host-published URL, never Docker DNS.
export const publicApiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Server-side requests can use the backend service on the Compose network.
export const serverApiUrl = process.env.API_URL ?? publicApiUrl;
