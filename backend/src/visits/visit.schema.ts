import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Person } from '../people/person.schema.js';
import {
  ADDRESS_MAX_LENGTH,
  FICTIONAL_ADDRESS,
  normalizeAddress,
} from '../common/address.js';
import {
  NAVIGATION_METHODS,
  type NavigationMethod,
} from './navigation-method.js';

@Schema({ versionKey: false })
export class Visit {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Person.name,
    required: true,
    immutable: true,
  })
  personId!: Types.ObjectId;

  // An attempted address is an event attribute, not a foreign key to Site.
  @Prop({
    type: String,
    required: true,
    set: normalizeAddress,
    match: FICTIONAL_ADDRESS,
    maxlength: ADDRESS_MAX_LENGTH,
    immutable: true,
  })
  address!: string;

  @Prop({ type: Date, default: Date.now, required: true, immutable: true })
  visitedAt!: Date;

  @Prop({
    type: String,
    enum: NAVIGATION_METHODS,
    required: true,
    immutable: true,
  })
  method!: NavigationMethod;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
VisitSchema.index({ personId: 1, visitedAt: -1, _id: -1 });
