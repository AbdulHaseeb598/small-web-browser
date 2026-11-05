import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Site, SiteSchema } from '../sites/site.schema.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Site.name, schema: SiteSchema }]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
