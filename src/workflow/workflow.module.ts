import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Workflow } from './entities/workflow.entity';
import { Approval } from './entities/approval.entity';
import { WorkflowAssignment } from './entities/workflow-assignment.entity';
import { WorkflowConfig } from './entities/workflow-config.entity';
import { WorkflowService } from './workflow.service';
import { WorkflowConfigService } from './workflow-config.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowConfigController } from './workflow-config.controller';

@Module({
    imports: [
        MikroOrmModule.forFeature([Workflow, Approval, WorkflowAssignment, WorkflowConfig]),
    ],
    controllers: [WorkflowController, WorkflowConfigController],
    providers: [WorkflowService, WorkflowConfigService],
    exports: [WorkflowService, WorkflowConfigService],
})
export class WorkflowModule { }
