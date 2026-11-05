import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { CreatePersonDto } from './create-person.dto.js';
import { PeopleService } from './people.service.js';

@Controller('people')
export class PeopleController {
  constructor(@Inject(PeopleService) private readonly people: PeopleService) {}

  @Get()
  list() {
    return this.people.list();
  }

  @Post()
  create(@Body() dto: CreatePersonDto) {
    return this.people.create(dto);
  }
}
