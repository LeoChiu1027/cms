import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Workflow } from './entities/workflow.entity';
import { Approval } from './entities/approval.entity';
import { WorkflowStatus, ApprovalAction } from './enums/workflow.enum';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { ApprovalActionDto, RejectDto, RequestChangesDto, CommentDto } from './dto/approval-action.dto';
import { UpdatePayloadDto } from './dto/update-payload.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class WorkflowService {
    constructor(private readonly em: EntityManager) { }

    async create(dto: CreateWorkflowDto, user: User): Promise<Workflow> {
        const workflow = this.em.create(Workflow, {
            entityType: dto.entityType,
            entityId: dto.entityId,
            operation: dto.operation,
            payload: dto.payload,
            priority: dto.priority ?? 0,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            createdBy: user,
            currentStatus: WorkflowStatus.DRAFT,
        });

        await this.em.persistAndFlush(workflow);
        return workflow;
    }

    async findAll(
        page: number,
        limit: number,
        filters: {
            entityType?: string;
            status?: string;
            assignedTo?: string;
            createdBy?: string;
            mine?: boolean;
        },
        currentUser: User,
    ): Promise<{ data: Workflow[]; total: number }> {
        const offset = (page - 1) * limit;

        const where: Record<string, unknown> = {};

        if (filters.entityType) {
            where.entityType = filters.entityType;
        }
        if (filters.status) {
            where.currentStatus = filters.status;
        }
        if (filters.assignedTo) {
            where.assignedTo = { id: filters.assignedTo };
        }
        if (filters.createdBy) {
            where.createdBy = { id: filters.createdBy };
        }
        if (filters.mine) {
            where.$or = [
                { createdBy: { id: currentUser.id } },
                { assignedTo: { id: currentUser.id } },
            ];
        }

        const [workflows, total] = await this.em.findAndCount(Workflow, where, {
            limit,
            offset,
            orderBy: { createdAt: 'DESC' },
            populate: ['createdBy', 'assignedTo'],
        });

        return { data: workflows, total };
    }

    async findOne(id: string): Promise<Workflow> {
        const workflow = await this.em.findOne(
            Workflow,
            { id },
            { populate: ['createdBy', 'assignedTo', 'approvals', 'approvals.reviewer'] },
        );

        if (!workflow) {
            throw new NotFoundException('Workflow not found');
        }

        return workflow;
    }

    async submit(id: string, user: User): Promise<Workflow> {
        const workflow = await this.findOne(id);

        if (workflow.createdBy.id !== user.id) {
            throw new ForbiddenException('Only the creator can submit this workflow');
        }

        if (
            workflow.currentStatus !== WorkflowStatus.DRAFT &&
            workflow.currentStatus !== WorkflowStatus.CHANGES_REQUESTED
        ) {
            throw new BadRequestException('Workflow must be in draft or changes_requested status to submit');
        }

        workflow.previousStatus = workflow.currentStatus;
        workflow.currentStatus = WorkflowStatus.PENDING_REVIEW;
        workflow.submittedAt = new Date();

        await this.em.flush();
        return workflow;
    }

    async claim(id: string, user: User): Promise<Workflow> {
        const workflow = await this.findOne(id);

        if (workflow.currentStatus !== WorkflowStatus.PENDING_REVIEW) {
            throw new BadRequestException('Workflow must be in pending_review status to claim');
        }

        if (workflow.assignedTo) {
            throw new BadRequestException('Workflow is already assigned to a reviewer');
        }

        workflow.previousStatus = workflow.currentStatus;
        workflow.currentStatus = WorkflowStatus.IN_REVIEW;
        workflow.assignedTo = user;
        workflow.startedAt = new Date();

        await this.em.flush();
        return workflow;
    }

    async approve(id: string, dto: ApprovalActionDto, user: User): Promise<{ workflow: Workflow; entity?: unknown }> {
        const workflow = await this.findOne(id);

        if (workflow.currentStatus !== WorkflowStatus.IN_REVIEW) {
            throw new BadRequestException('Workflow must be in in_review status to approve');
        }

        if (!workflow.assignedTo || workflow.assignedTo.id !== user.id) {
            throw new ForbiddenException('Only the assigned reviewer can approve this workflow');
        }

        // Create approval record
        const approval = this.em.create(Approval, {
            workflow,
            reviewer: user,
            action: ApprovalAction.APPROVE,
            comment: dto.comment,
            fromStatus: workflow.currentStatus,
            toStatus: WorkflowStatus.APPROVED,
        });

        workflow.previousStatus = workflow.currentStatus;
        workflow.currentStatus = WorkflowStatus.APPROVED;
        workflow.completedAt = new Date();

        await this.em.persistAndFlush(approval);

        // TODO: Apply payload based on operation (create/update/delete entity)
        // This will be implemented when integrating with ContentModule

        return { workflow };
    }

    async reject(id: string, dto: RejectDto, user: User): Promise<Workflow> {
        const workflow = await this.findOne(id);

        if (workflow.currentStatus !== WorkflowStatus.IN_REVIEW) {
            throw new BadRequestException('Workflow must be in in_review status to reject');
        }

        if (!workflow.assignedTo || workflow.assignedTo.id !== user.id) {
            throw new ForbiddenException('Only the assigned reviewer can reject this workflow');
        }

        // Create approval record
        const approval = this.em.create(Approval, {
            workflow,
            reviewer: user,
            action: ApprovalAction.REJECT,
            comment: dto.comment,
            fromStatus: workflow.currentStatus,
            toStatus: WorkflowStatus.REJECTED,
        });

        workflow.previousStatus = workflow.currentStatus;
        workflow.currentStatus = WorkflowStatus.REJECTED;
        workflow.completedAt = new Date();

        await this.em.persistAndFlush(approval);

        return workflow;
    }

    async requestChanges(id: string, dto: RequestChangesDto, user: User): Promise<Workflow> {
        const workflow = await this.findOne(id);

        if (workflow.currentStatus !== WorkflowStatus.IN_REVIEW) {
            throw new BadRequestException('Workflow must be in in_review status to request changes');
        }

        if (!workflow.assignedTo || workflow.assignedTo.id !== user.id) {
            throw new ForbiddenException('Only the assigned reviewer can request changes');
        }

        // Create approval record
        const approval = this.em.create(Approval, {
            workflow,
            reviewer: user,
            action: ApprovalAction.REQUEST_CHANGES,
            comment: dto.comment,
            fromStatus: workflow.currentStatus,
            toStatus: WorkflowStatus.CHANGES_REQUESTED,
        });

        workflow.previousStatus = workflow.currentStatus;
        workflow.currentStatus = WorkflowStatus.CHANGES_REQUESTED;
        workflow.assignedTo = undefined; // Release assignment

        await this.em.persistAndFlush(approval);

        return workflow;
    }

    async comment(id: string, dto: CommentDto, user: User): Promise<Approval> {
        const workflow = await this.findOne(id);

        // Create approval record (action=comment, no status change)
        const approval = this.em.create(Approval, {
            workflow,
            reviewer: user,
            action: ApprovalAction.COMMENT,
            comment: dto.comment,
            fromStatus: workflow.currentStatus,
            toStatus: workflow.currentStatus,
        });

        await this.em.persistAndFlush(approval);

        return approval;
    }

    async updatePayload(id: string, dto: UpdatePayloadDto, user: User): Promise<Workflow> {
        const workflow = await this.findOne(id);

        if (workflow.createdBy.id !== user.id) {
            throw new ForbiddenException('Only the creator can update the payload');
        }

        if (
            workflow.currentStatus !== WorkflowStatus.DRAFT &&
            workflow.currentStatus !== WorkflowStatus.CHANGES_REQUESTED
        ) {
            throw new BadRequestException('Workflow must be in draft or changes_requested status to update payload');
        }

        workflow.payload = dto.payload;
        await this.em.flush();

        return workflow;
    }

    async cancel(id: string, user: User): Promise<void> {
        const workflow = await this.findOne(id);

        if (workflow.createdBy.id !== user.id) {
            throw new ForbiddenException('Only the creator can cancel this workflow');
        }

        if (
            workflow.currentStatus !== WorkflowStatus.DRAFT &&
            workflow.currentStatus !== WorkflowStatus.PENDING_REVIEW
        ) {
            throw new BadRequestException('Can only cancel workflows in draft or pending_review status');
        }

        await this.em.removeAndFlush(workflow);
    }

    serializeWorkflow(workflow: Workflow): Record<string, unknown> {
        return {
            id: workflow.id,
            entityType: workflow.entityType,
            entityId: workflow.entityId ?? null,
            operation: workflow.operation,
            payload: workflow.payload,
            currentStatus: workflow.currentStatus,
            previousStatus: workflow.previousStatus ?? null,
            assignedTo: workflow.assignedTo?.id ?? null,
            priority: workflow.priority,
            dueDate: workflow.dueDate?.toISOString() ?? null,
            submittedAt: workflow.submittedAt?.toISOString() ?? null,
            startedAt: workflow.startedAt?.toISOString() ?? null,
            completedAt: workflow.completedAt?.toISOString() ?? null,
            createdBy: workflow.createdBy.id,
            createdAt: workflow.createdAt.toISOString(),
            updatedAt: workflow.updatedAt.toISOString(),
        };
    }

    serializeWorkflowWithApprovals(workflow: Workflow): Record<string, unknown> {
        return {
            ...this.serializeWorkflow(workflow),
            createdByUser: workflow.createdBy
                ? {
                    id: workflow.createdBy.id,
                    email: workflow.createdBy.email,
                    firstName: workflow.createdBy.firstName,
                    lastName: workflow.createdBy.lastName,
                }
                : null,
            assignedToUser: workflow.assignedTo
                ? {
                    id: workflow.assignedTo.id,
                    email: workflow.assignedTo.email,
                    firstName: workflow.assignedTo.firstName,
                    lastName: workflow.assignedTo.lastName,
                }
                : null,
            approvals: workflow.approvals?.getItems().map((a) => ({
                id: a.id,
                workflowId: workflow.id,
                reviewerId: a.reviewer.id,
                action: a.action,
                comment: a.comment ?? null,
                fromStatus: a.fromStatus,
                toStatus: a.toStatus,
                createdAt: a.createdAt.toISOString(),
                reviewer: {
                    id: a.reviewer.id,
                    email: a.reviewer.email,
                    firstName: a.reviewer.firstName,
                    lastName: a.reviewer.lastName,
                },
            })) ?? [],
        };
    }
}
