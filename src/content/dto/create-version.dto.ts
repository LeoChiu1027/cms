import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateVersionDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  changeSummary?: string;
}
