import { validateEnvironment } from './environment.js';

describe('Environment validation', () => {
  const valid = { MONGODB_URI: 'mongodb://mongodb:27017/small_web_browser' };

  it('applies development defaults and converts the port', () => {
    expect(validateEnvironment(valid)).toMatchObject({
      PORT: 4000,
      FRONTEND_ORIGIN: 'http://localhost:3000',
    });
    expect(validateEnvironment({ ...valid, PORT: '4500' }).PORT).toBe(4500);
  });

  it.each(['0', '65536', 'abc', '4000.5', ''])(
    'rejects invalid port %s',
    (PORT) => {
      expect(() => validateEnvironment({ ...valid, PORT })).toThrow('PORT');
    },
  );

  it.each([undefined, '', 'https://example.com', 'mongodb://'])(
    'rejects missing or invalid database configuration',
    (MONGODB_URI) => {
      expect(() => validateEnvironment({ MONGODB_URI })).toThrow('MONGODB_URI');
    },
  );

  it.each(['*', 'file://localhost', 'https://example.com/path'])(
    'rejects invalid CORS origin %s',
    (FRONTEND_ORIGIN) => {
      expect(() => validateEnvironment({ ...valid, FRONTEND_ORIGIN })).toThrow(
        'FRONTEND_ORIGIN',
      );
    },
  );
});
