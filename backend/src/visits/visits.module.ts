import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PeopleModule } from '../people/people.module.js';
import { Visit, VisitSchema } from './visit.schema.js';
import { VisitsService } from './visits.service.js';
import { VisitsController } from './visits.controller.js';

@Module({
  imports: [
    PeopleModule,
    MongooseModule.forFeature([{ name: Visit.name, schema: VisitSchema }]),
  ],
  providers: [VisitsService],
  controllers: [VisitsController],
})
export class VisitsModule {}
