import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AddressDto } from '../common/address.dto.js';
import { trimString } from '../common/address.js';

export class CreateSiteDto extends AddressDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100000)
  html!: string;

  @IsMongoId()
  authorId!: string;
}
