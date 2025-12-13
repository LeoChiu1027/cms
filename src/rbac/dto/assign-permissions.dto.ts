import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}
