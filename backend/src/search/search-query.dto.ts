import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SearchQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^(?:[^"]|"[^"]+")*$/, {
    message: 'q must contain balanced, nonempty quoted phrases',
  })
  q!: string;
}
