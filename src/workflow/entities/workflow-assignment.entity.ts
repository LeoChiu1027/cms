import {
    Entity,
    PrimaryKey,
    Property,
    ManyToOne,
    OptionalProps,
    Index,
    Unique,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from '../../auth/entities/user.entity';
import { Workflow } from './workflow.entity';

@Entity({ tableName: 'workflow_assignments' })
@Unique({ properties: ['workflow', 'user'] })
@Index({ properties: ['workflow'] })
@Index({ properties: ['user'] })
@Index({ properties: ['user', 'completedAt'] })
export class WorkflowAssignment {
    [OptionalProps]?: 'id' | 'assignedAt';

    @PrimaryKey({ type: 'uuid' })
    id: string = randomUUID();

    @ManyToOne(() => Workflow)
    workflow!: Workflow;

    @ManyToOne(() => User)
    user!: User;

    @Property({ length: 50 })
    role!: string; // 'reviewer', 'approver', 'observer'

    @ManyToOne(() => User, { nullable: true })
    assignedBy?: User;

    @Property({ onCreate: () => new Date() })
    assignedAt: Date = new Date();

    @Property({ type: 'timestamp', nullable: true })
    completedAt?: Date;
}
