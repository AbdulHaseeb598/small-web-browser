import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class Person {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  name!: string;

  createdAt!: Date;
}

export const PersonSchema = SchemaFactory.createForClass(Person);
