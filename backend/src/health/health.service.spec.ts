import { ServiceUnavailableException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const ping = vi.fn();
  const connection = {
    readyState: 1,
    db: { admin: () => ({ ping }) },
  };
  const service = new HealthService(connection as unknown as Connection);

  beforeEach(() => {
    connection.readyState = 1;
    ping.mockReset().mockResolvedValue({ ok: 1 });
  });

  it('pings MongoDB and returns a timestamped response', async () => {
    const response = await service.check();
    expect(ping).toHaveBeenCalledWith({ timeoutMS: 2000 });
    expect(response).toMatchObject({ status: 'ok', database: 'up' });
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('returns 503 when disconnected', async () => {
    connection.readyState = 0;
    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(ping).not.toHaveBeenCalled();
  });

  it('does not expose database errors in the response', async () => {
    ping.mockRejectedValue(new Error('sensitive connection details'));
    try {
      await service.check();
      throw new Error('Expected service to be unavailable');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const response = (error as ServiceUnavailableException).getResponse();
      expect(response).toMatchObject({ status: 'error', database: 'down' });
      expect(JSON.stringify(response)).not.toContain('sensitive');
    }
  });
});
