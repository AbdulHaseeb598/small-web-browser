export function validateEnvironment(environment: Record<string, unknown>) {
  const port = Number(environment.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const uri = environment.MONGODB_URI;
  if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\/\S+$/.test(uri)) {
    throw new Error('MONGODB_URI must be a MongoDB connection URI');
  }

  const origin = environment.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  try {
    const url = new URL(String(origin));
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error();
    }
  } catch {
    throw new Error('FRONTEND_ORIGIN must be an HTTP(S) origin without a path');
  }

  return {
    ...environment,
    PORT: port,
    MONGODB_URI: uri,
    FRONTEND_ORIGIN: origin,
  };
}
