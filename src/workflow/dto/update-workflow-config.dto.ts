import { IsBoolean, IsArray, IsInt, IsOptional, Min, IsString } from 'class-validator';

export class UpdateWorkflowConfigDto {
    @IsBoolean()
    @IsOptional()
    requiresApproval?: boolean;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    autoApproveForRoles?: string[];

    @IsInt()
    @Min(1)
    @IsOptional()
    minApprovers?: number;

    @IsBoolean()
    @IsOptional()
    notifyOnSubmit?: boolean;

    @IsBoolean()
    @IsOptional()
    notifyOnComplete?: boolean;
}
