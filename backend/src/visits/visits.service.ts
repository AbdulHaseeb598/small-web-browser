import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { PeopleService } from '../people/people.service.js';
import { normalizeAddress } from '../common/address.js';
import { Visit } from './visit.schema.js';
import type { CreateVisitDto } from './create-visit.dto.js';
import type { HistoryQueryDto } from './history-query.dto.js';

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private readonly visits: Model<Visit>,
    @Inject(PeopleService) private readonly people: PeopleService,
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
    const filter = { personId };
    const [items, total] = await Promise.all([
      this.visits
        .find(filter)
        .sort({ visitedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.visits.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }
}
