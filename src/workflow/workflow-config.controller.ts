import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkflowConfigService } from './workflow-config.service';
import { UpdateWorkflowConfigDto } from './dto/update-workflow-config.dto';
import { EntityType } from './enums/workflow.enum';

@Controller('workflows/config')
@UseGuards(AuthGuard('jwt'))
export class WorkflowConfigController {
    constructor(private readonly configService: WorkflowConfigService) { }

    @Get()
    async findAll() {
        const configs = await this.configService.findAll();
        return {
            data: configs.map((c) => this.configService.serializeConfig(c)),
        };
    }

    @Get(':entityType')
    async findOne(@Param('entityType') entityType: EntityType) {
        const config = await this.configService.findByEntityType(entityType);
        return this.configService.serializeConfig(config);
    }

    @Patch(':entityType')
    async update(
        @Param('entityType') entityType: EntityType,
        @Body() dto: UpdateWorkflowConfigDto,
    ) {
        const config = await this.configService.upsert(entityType, dto);
        return this.configService.serializeConfig(config);
    }
}
