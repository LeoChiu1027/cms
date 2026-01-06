import {
    Entity,
    PrimaryKey,
    Property,
    Enum,
    ManyToOne,
    OptionalProps,
    Index,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from '../../auth/entities/user.entity';
import type { Workflow } from './workflow.entity';
import { ApprovalAction, WorkflowStatus } from '../enums/workflow.enum';

@Entity({ tableName: 'approvals' })
@Index({ properties: ['workflow'] })
@Index({ properties: ['reviewer'] })
@Index({ properties: ['workflow', 'createdAt'] })
@Index({ properties: ['action'] })
export class Approval {
    [OptionalProps]?: 'id' | 'createdAt';

    @PrimaryKey({ type: 'uuid' })
    id: string = randomUUID();

    @ManyToOne('Workflow')
    workflow!: Workflow;

    @ManyToOne(() => User)
    reviewer!: User;

    @Enum(() => ApprovalAction)
    action!: ApprovalAction;

    @Property({ type: 'text', nullable: true })
    comment?: string;

    @Enum(() => WorkflowStatus)
    fromStatus!: WorkflowStatus;

    @Enum(() => WorkflowStatus)
    toStatus!: WorkflowStatus;

    @Property({ onCreate: () => new Date() })
    createdAt: Date = new Date();
}
