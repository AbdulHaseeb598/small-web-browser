import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { AddressDto } from '../common/address.dto.js';
import { CreateSiteDto } from './create-site.dto.js';
import { SitesService } from './sites.service.js';

@Controller('sites')
export class SitesController {
  constructor(@Inject(SitesService) private readonly sites: SitesService) {}

  @Get()
  list() {
    return this.sites.list();
  }

  @Get(':address')
  findOne(@Param() params: AddressDto) {
    return this.sites.findByAddress(params.address);
  }

  @Post()
  create(@Body() dto: CreateSiteDto) {
    return this.sites.create(dto);
  }
}
