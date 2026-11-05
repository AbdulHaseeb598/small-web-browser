import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PersonIdDto } from '../common/person-id.dto.js';
import { CreateVisitDto } from './create-visit.dto.js';
import { HistoryQueryDto } from './history-query.dto.js';
import { VisitsService } from './visits.service.js';

@Controller()
export class VisitsController {
  constructor(@Inject(VisitsService) private readonly visits: VisitsService) {}

  @Post('visits')
  create(@Body() dto: CreateVisitDto) {
    return this.visits.create(dto);
  }

  @Get('people/:personId/visits')
  history(@Param() params: PersonIdDto, @Query() query: HistoryQueryDto) {
    return this.visits.history(params.personId, query);
  }
}
