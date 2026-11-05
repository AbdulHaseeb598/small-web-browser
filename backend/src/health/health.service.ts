import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async check() {
    try {
      if (this.connection.readyState !== 1 || !this.connection.db) {
        throw new Error('Database unavailable');
      }
      await this.connection.db.admin().ping({ timeoutMS: 2000 });
    } catch {
      throw new ServiceUnavailableException(this.response(false));
    }
    return this.response(true);
  }

  private response(healthy: boolean) {
    return {
      status: healthy ? 'ok' : 'error',
      service: 'small-web-browser-api',
      database: healthy ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
