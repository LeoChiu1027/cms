import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds!: string[];
}
