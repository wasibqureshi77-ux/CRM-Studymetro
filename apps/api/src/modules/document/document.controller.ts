import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentDto, ApproveDocumentDto } from './dto/document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Permissions('docs:read')
  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.documentService.findAll(tenantId);
  }

  @Permissions('docs:write')
  @Post('upload')
  async upload(@Req() req: AuthenticatedRequest, @Body() dto: CreateDocumentDto) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.documentService.uploadRequest(dto, tenantId, actorId);
  }

  @Permissions('docs:verify')
  @Patch(':id/approve')
  async approve(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ApproveDocumentDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.documentService.approve(id, dto, tenantId, actorId);
  }
}
