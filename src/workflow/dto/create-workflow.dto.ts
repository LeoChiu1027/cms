import {
    IsEnum,
    IsUUID,
    IsObject,
    IsOptional,
    IsInt,
    IsDateString,
    Min,
} from 'class-validator';
import { EntityType, WorkflowOperation } from '../enums/workflow.enum';

export class CreateWorkflowDto {
    @IsEnum(EntityType)
    entityType!: EntityType;

    @IsUUID()
    @IsOptional()
    entityId?: string;

    @IsEnum(WorkflowOperation)
    operation!: WorkflowOperation;

    @IsObject()
    payload!: Record<string, unknown>;

    @IsInt()
    @Min(0)
    @IsOptional()
    priority?: number;

    @IsDateString()
    @IsOptional()
    dueDate?: string;
}
