import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { PeopleService } from '../people/people.service.js';
import { normalizeAddress } from '../common/address.js';
import { Visit } from './visit.schema.js';
import type { CreateVisitDto } from './create-visit.dto.js';
import type { HistoryQueryDto } from './history-query.dto.js';
import { Site } from '../sites/site.schema.js';

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private readonly visits: Model<Visit>,
    @Inject(PeopleService) private readonly people: PeopleService,
    @InjectModel(Site.name) private readonly sites: Model<Site>,
  ) {}

  async create(dto: CreateVisitDto) {
    await this.people.ensureExists(dto.personId);
    return (
      await this.visits.create({
        personId: dto.personId,
        address: normalizeAddress(dto.address),
        method: dto.method,
      })
    ).toObject();
  }

  async history(personId: string, { page, limit }: HistoryQueryDto) {
    await this.people.ensureExists(personId);
    // Older API records could contain string references because the original
    // schema treated this path as Mixed. Keep those records readable without a
    // migration. The collection query preserves both BSON types instead of
    // casting the string branch back to ObjectId. Cursor results are plain data.
    const filter = {
      personId: { $in: [new Types.ObjectId(personId), personId] },
    };
    const [items, total] = await Promise.all([
      this.visits.collection
        .find(filter)
        .sort({ visitedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.visits.collection.countDocuments(filter),
    ]);
    const addresses = [...new Set(items.map((item) => String(item.address)))];
    const existing = new Set(
      (
        await this.sites
          .find({ address: { $in: addresses } })
          .select('address')
          .lean()
          .exec()
      ).map((site) => site.address),
    );
    return {
      items: items.map((item) => ({
        ...item,
        exists: existing.has(String(item.address)),
      })),
      total,
      page,
      limit,
    };
  }
}
