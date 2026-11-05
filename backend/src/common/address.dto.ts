import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  ADDRESS_MAX_LENGTH,
  FICTIONAL_ADDRESS,
  normalizeAddress,
} from './address.js';

export class AddressDto {
  @Transform(({ value }: { value: unknown }) => normalizeAddress(value))
  @IsString()
  @MaxLength(ADDRESS_MAX_LENGTH)
  @Matches(FICTIONAL_ADDRESS, {
    message:
      'address must be a fictional .zz address, without a URL scheme, port, or path',
  })
  address!: string;
}
