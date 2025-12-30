import {
    Entity,
    PrimaryKey,
    Property,
    Enum,
    OptionalProps,
    Index,
    Unique,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { EntityType } from '../enums/workflow.enum';

@Entity({ tableName: 'workflow_configs' })
@Unique({ properties: ['entityType'] })
@Index({ properties: ['entityType'] })
export class WorkflowConfig {
    [OptionalProps]?:
        | 'id'
        | 'requiresApproval'
        | 'minApprovers'
        | 'notifyOnSubmit'
        | 'notifyOnComplete'
        | 'createdAt'
        | 'updatedAt';

    @PrimaryKey({ type: 'uuid' })
    id: string = randomUUID();

    @Enum(() => EntityType)
    entityType!: EntityType;

    @Property({ default: true })
    requiresApproval: boolean = true;

    @Property({ type: 'jsonb', nullable: true })
    autoApproveForRoles?: string[];

    @Property({ default: 1 })
    minApprovers: number = 1;

    @Property({ default: true })
    notifyOnSubmit: boolean = true;

    @Property({ default: true })
    notifyOnComplete: boolean = true;

    @Property({ onCreate: () => new Date() })
    createdAt: Date = new Date();

    @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
    updatedAt: Date = new Date();
}
