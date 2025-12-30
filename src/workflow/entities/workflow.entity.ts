import {
    Entity,
    PrimaryKey,
    Property,
    Enum,
    ManyToOne,
    OneToMany,
    Collection,
    OptionalProps,
    Index,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from '../../auth/entities/user.entity';
import { EntityType, WorkflowStatus, WorkflowOperation } from '../enums/workflow.enum';
import { Approval } from './approval.entity';

@Entity({ tableName: 'workflows' })
@Index({ properties: ['entityType', 'entityId'] })
@Index({ properties: ['entityType'] })
@Index({ properties: ['currentStatus'] })
@Index({ properties: ['currentStatus', 'assignedTo'] })
@Index({ properties: ['entityType', 'currentStatus'] })
@Index({ properties: ['createdBy'] })
export class Workflow {
    [OptionalProps]?:
        | 'id'
        | 'currentStatus'
        | 'priority'
        | 'createdAt'
        | 'updatedAt'
        | 'approvals';

    @PrimaryKey({ type: 'uuid' })
    id: string = randomUUID();

    @Enum(() => EntityType)
    entityType!: EntityType;

    @Property({ type: 'uuid', nullable: true })
    entityId?: string;

    @Enum(() => WorkflowOperation)
    operation!: WorkflowOperation;

    @Property({ type: 'jsonb' })
    payload!: Record<string, unknown>;

    @Enum(() => WorkflowStatus)
    currentStatus: WorkflowStatus = WorkflowStatus.DRAFT;

    @Enum({ items: () => WorkflowStatus, nullable: true })
    previousStatus?: WorkflowStatus;

    @ManyToOne(() => User, { nullable: true })
    assignedTo?: User;

    @Property({ default: 0 })
    priority: number = 0;

    @Property({ type: 'timestamp', nullable: true })
    @Index()
    dueDate?: Date;

    @Property({ type: 'timestamp', nullable: true })
    submittedAt?: Date;

    @Property({ type: 'timestamp', nullable: true })
    startedAt?: Date;

    @Property({ type: 'timestamp', nullable: true })
    completedAt?: Date;

    @Property({ onCreate: () => new Date() })
    createdAt: Date = new Date();

    @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
    updatedAt: Date = new Date();

    @ManyToOne(() => User)
    createdBy!: User;

    // Relations
    @OneToMany(() => Approval, (approval) => approval.workflow)
    approvals = new Collection<Approval>(this);
}
