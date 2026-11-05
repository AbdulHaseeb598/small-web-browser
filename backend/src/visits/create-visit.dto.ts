import { IsIn } from 'class-validator';
import { AddressDto } from '../common/address.dto.js';
import { IsMongoId } from 'class-validator';
import {
  NAVIGATION_METHODS,
  type NavigationMethod,
} from './navigation-method.js';

export class CreateVisitDto extends AddressDto {
  @IsMongoId()
  personId!: string;

  @IsIn(NAVIGATION_METHODS)
  method!: NavigationMethod;
}
