import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Person } from './person.schema.js';
import type { CreatePersonDto } from './create-person.dto.js';

@Injectable()
export class PeopleService {
  constructor(
    @InjectModel(Person.name) private readonly people: Model<Person>,
  ) {}

  list() {
    return this.people.find().sort({ createdAt: 1, _id: 1 }).lean().exec();
  }

  async create(dto: CreatePersonDto) {
    return (await this.people.create({ name: dto.name })).toObject();
  }

  async ensureExists(personId: string) {
    if (!/^[a-f\d]{24}$/i.test(personId)) {
      throw new BadRequestException('personId must be a MongoDB ObjectId');
    }
    if (!(await this.people.exists({ _id: personId }))) {
      throw new NotFoundException('Person not found');
    }
  }
}
