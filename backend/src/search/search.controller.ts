import { Controller, Get, Inject, Query } from '@nestjs/common';
import { SearchQueryDto } from './search-query.dto.js';
import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(
    @Inject(SearchService) private readonly searchService: SearchService,
  ) {}
  @Get()
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q);
  }
}
