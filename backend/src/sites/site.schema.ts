import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import {
  ADDRESS_MAX_LENGTH,
  FICTIONAL_ADDRESS,
  normalizeAddress,
} from '../common/address.js';
import { Person } from '../people/person.schema.js';

@Schema({ timestamps: true, versionKey: false })
export class Site {
  _id!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    set: normalizeAddress,
    match: FICTIONAL_ADDRESS,
    maxlength: ADDRESS_MAX_LENGTH,
  })
  address!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  title!: string;

  // Store the authored string exactly; rendering/sanitization belongs to a later step.
  @Prop({ type: String, required: true, maxlength: 100000 })
  html!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Person.name,
    required: true,
  })
  authorId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SiteSchema = SchemaFactory.createForClass(Site);
SiteSchema.index({ address: 1 }, { unique: true });
