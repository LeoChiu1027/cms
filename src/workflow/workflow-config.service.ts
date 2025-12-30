import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { WorkflowConfig } from './entities/workflow-config.entity';
import { EntityType } from './enums/workflow.enum';
import { UpdateWorkflowConfigDto } from './dto/update-workflow-config.dto';

@Injectable()
export class WorkflowConfigService {
    constructor(private readonly em: EntityManager) { }

    async findAll(): Promise<WorkflowConfig[]> {
        return this.em.find(WorkflowConfig, {});
    }

    async findByEntityType(entityType: EntityType): Promise<WorkflowConfig> {
        const config = await this.em.findOne(WorkflowConfig, { entityType });
        if (!config) {
            throw new NotFoundException(`Workflow config for ${entityType} not found`);
        }
        return config;
    }

    async upsert(entityType: EntityType, dto: UpdateWorkflowConfigDto): Promise<WorkflowConfig> {
        let config = await this.em.findOne(WorkflowConfig, { entityType });

        if (!config) {
            config = this.em.create(WorkflowConfig, {
                entityType,
                ...dto,
            });
            this.em.persist(config);
        } else {
            if (dto.requiresApproval !== undefined) config.requiresApproval = dto.requiresApproval;
            if (dto.autoApproveForRoles !== undefined) config.autoApproveForRoles = dto.autoApproveForRoles;
            if (dto.minApprovers !== undefined) config.minApprovers = dto.minApprovers;
            if (dto.notifyOnSubmit !== undefined) config.notifyOnSubmit = dto.notifyOnSubmit;
            if (dto.notifyOnComplete !== undefined) config.notifyOnComplete = dto.notifyOnComplete;
        }

        await this.em.flush();
        return config;
    }

    async shouldAutoApprove(entityType: EntityType, userRoleSlugs: string[]): Promise<boolean> {
        const config = await this.em.findOne(WorkflowConfig, { entityType });
        if (!config || !config.requiresApproval) {
            return true; // No config or approval not required = auto approve
        }

        if (!config.autoApproveForRoles || config.autoApproveForRoles.length === 0) {
            return false;
        }

        // Check if any of user's roles are in auto-approve list
        return userRoleSlugs.some((slug) => config.autoApproveForRoles?.includes(slug));
    }

    serializeConfig(config: WorkflowConfig): Record<string, unknown> {
        return {
            id: config.id,
            entityType: config.entityType,
            requiresApproval: config.requiresApproval,
            autoApproveForRoles: config.autoApproveForRoles ?? [],
            minApprovers: config.minApprovers,
            notifyOnSubmit: config.notifyOnSubmit,
            notifyOnComplete: config.notifyOnComplete,
            createdAt: config.createdAt.toISOString(),
            updatedAt: config.updatedAt.toISOString(),
        };
    }
}
