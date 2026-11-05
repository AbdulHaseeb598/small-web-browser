import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Site } from './site.schema.js';
import type { CreateSiteDto } from './create-site.dto.js';
import { PeopleService } from '../people/people.service.js';
import { normalizeAddress } from '../common/address.js';

@Injectable()
export class SitesService implements OnModuleInit {
  constructor(
    @InjectModel(Site.name) private readonly sites: Model<Site>,
    @Inject(PeopleService) private readonly people: PeopleService,
  ) {}

  async onModuleInit() {
    // Do not accept publications until MongoDB has established the unique index.
    await this.sites.init();
  }

  list() {
    return this.sites
      .find()
      .select('_id address title authorId createdAt updatedAt')
      .sort({ createdAt: -1, _id: -1 })
      .lean()
      .exec();
  }

  async findByAddress(address: string) {
    const site = await this.sites
      .findOne({ address: normalizeAddress(address) })
      .lean()
      .exec();
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  async create(dto: CreateSiteDto) {
    await this.people.ensureExists(dto.authorId);
    try {
      return (
        await this.sites.create({
          address: normalizeAddress(dto.address),
          title: dto.title,
          html: dto.html,
          authorId: dto.authorId,
        })
      ).toObject();
    } catch (error: unknown) {
      // Catch the database race too; a pre-insert lookup alone cannot ensure uniqueness.
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('Site address already exists');
      }
      throw error;
    }
  }
}
