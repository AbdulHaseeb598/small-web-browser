import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { validateEnvironment } from './config/environment.js';
import { HealthModule } from './health/health.module.js';
import { PeopleModule } from './people/people.module.js';
import { SitesModule } from './sites/sites.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        retryAttempts: 5,
        retryDelay: 2000,
        verboseRetryLog: false,
      }),
    }),
    HealthModule,
    PeopleModule,
    SitesModule,
  ],
})
export class AppModule {}
