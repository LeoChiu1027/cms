import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9:-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, colons, and hyphens',
  })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  resource!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  action!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
