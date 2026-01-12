import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
    UseGuards,
    Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { ApprovalActionDto, RejectDto, RequestChangesDto, CommentDto } from './dto/approval-action.dto';
import { UpdatePayloadDto } from './dto/update-payload.dto';
import { User } from '../auth/entities/user.entity';

@Controller('workflows')
@UseGuards(AuthGuard('jwt'))
export class WorkflowController {
    constructor(private readonly workflowService: WorkflowService) { }

    @Post()
    async create(
        @Body() createWorkflowDto: CreateWorkflowDto,
        @Req() req: Request & { user: User },
    ) {
        const workflow = await this.workflowService.create(createWorkflowDto, req.user);
        return this.workflowService.serializeWorkflow(workflow);
    }

    @Get()
    async findAll(
        @Req() req: Request & { user: User },
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('entityType') entityType?: string,
        @Query('status') status?: string,
        @Query('assignedTo') assignedTo?: string,
        @Query('createdBy') createdBy?: string,
        @Query('mine') mine?: string,
    ) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

        const { data, total } = await this.workflowService.findAll(
            pageNum,
            limitNum,
            {
                entityType,
                status,
                assignedTo,
                createdBy,
                mine: mine === 'true',
            },
            req.user,
        );

        return {
            data: data.map((w) => this.workflowService.serializeWorkflow(w)),
            meta: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    }

    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        const workflow = await this.workflowService.findOne(id);
        return this.workflowService.serializeWorkflowWithApprovals(workflow);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async cancel(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: Request & { user: User },
    ) {
        await this.workflowService.cancel(id, req.user);
    }

    @Post(':id/submit')
    @HttpCode(HttpStatus.OK)
    async submit(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: Request & { user: User },
    ) {
        const { workflow, autoApproved } = await this.workflowService.submit(id, req.user);
        return {
            ...this.workflowService.serializeWorkflow(workflow),
            autoApproved,
        };
    }

    @Post(':id/claim')
    @HttpCode(HttpStatus.OK)
    async claim(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: Request & { user: User },
    ) {
        const workflow = await this.workflowService.claim(id, req.user);
        return this.workflowService.serializeWorkflow(workflow);
    }

    @Post(':id/approve')
    @HttpCode(HttpStatus.OK)
    async approve(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ApprovalActionDto,
        @Req() req: Request & { user: User },
    ) {
        const result = await this.workflowService.approve(id, dto, req.user);
        return {
            workflow: this.workflowService.serializeWorkflow(result.workflow),
            entity: result.entity ?? null,
            message: 'Workflow approved successfully',
        };
    }

    @Post(':id/reject')
    @HttpCode(HttpStatus.OK)
    async reject(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RejectDto,
        @Req() req: Request & { user: User },
    ) {
        const workflow = await this.workflowService.reject(id, dto, req.user);
        return this.workflowService.serializeWorkflow(workflow);
    }

    @Post(':id/request-changes')
    @HttpCode(HttpStatus.OK)
    async requestChanges(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RequestChangesDto,
        @Req() req: Request & { user: User },
    ) {
        const workflow = await this.workflowService.requestChanges(id, dto, req.user);
        return this.workflowService.serializeWorkflow(workflow);
    }

    @Post(':id/comment')
    @HttpCode(HttpStatus.CREATED)
    async comment(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CommentDto,
        @Req() req: Request & { user: User },
    ) {
        const approval = await this.workflowService.comment(id, dto, req.user);
        return {
            id: approval.id,
            workflowId: approval.workflow.id,
            reviewerId: approval.reviewer.id,
            action: approval.action,
            comment: approval.comment,
            fromStatus: approval.fromStatus,
            toStatus: approval.toStatus,
            createdAt: approval.createdAt.toISOString(),
        };
    }

    @Patch(':id/update-payload')
    async updatePayload(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdatePayloadDto,
        @Req() req: Request & { user: User },
    ) {
        const workflow = await this.workflowService.updatePayload(id, dto, req.user);
        return this.workflowService.serializeWorkflow(workflow);
    }
}
