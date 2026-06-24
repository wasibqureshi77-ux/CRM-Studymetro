import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { BrochureService } from './brochure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { LeadCategory } from '@prisma/client';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

@Controller('api/v1/brochures')
export class BrochureController {
  constructor(private readonly brochureService: BrochureService) {}

  // ================= ADMIN ENDPOINTS =================

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('leads:write')
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('category') category: string
  ) {
    if (!title || !category) {
      throw new BadRequestException('Title and category are required');
    }
    const cat = category as LeadCategory;
    return this.brochureService.createBrochure(title, cat, file);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('leads:read')
  @Get()
  async findAll() {
    return this.brochureService.findAll();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('leads:write')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { title?: string; category?: LeadCategory; isActive?: boolean }
  ) {
    return this.brochureService.update(id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('leads:write')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.brochureService.delete(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('leads:write')
  @Post('assign')
  async assign(
    @Req() req: AuthenticatedRequest,
    @Body() body: { leadId: string; brochureId: string }
  ) {
    if (!body.leadId || !body.brochureId) {
      throw new BadRequestException('leadId and brochureId are required');
    }
    const actorId = req.user?.id;
    return this.brochureService.assignBrochure(body.leadId, body.brochureId, actorId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('leads:read')
  @Get('assignments/lead/:leadId')
  async getLeadAssignments(@Param('leadId') leadId: string) {
    return this.brochureService.getLeadAssignments(leadId);
  }

  // ================= PUBLIC ENDPOINTS =================

  @Get('public/view/:token')
  async publicGetAssignment(@Param('token') token: string) {
    const assignment = await this.brochureService.getAssignmentByToken(token);
    // return only public-safe fields (exclude lead personal details if necessary, but we can return assignment meta)
    return {
      id: assignment.id,
      token: assignment.token,
      brochure: {
        title: assignment.brochure.title,
        category: assignment.brochure.category,
        totalPages: assignment.brochure.totalPages,
      },
      tracking: assignment.tracking ? {
        opened: assignment.tracking.opened,
        readingTime: assignment.tracking.readingTime,
        pageViews: assignment.tracking.pageViews,
        completionPercentage: assignment.tracking.completionPercentage,
        lastPageViewed: assignment.tracking.lastPageViewed,
        downloadCount: assignment.tracking.downloadCount,
        viewedPages: assignment.tracking.viewedPages,
      } : null,
    };
  }

  @Get('public/pdf/:token')
  async publicGetPdf(@Param('token') token: string, @Res() res: Response) {
    const assignment = await this.brochureService.getAssignmentByToken(token);
    
    const resolvedPath = path.resolve(UPLOAD_ROOT, assignment.brochure.filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Physical PDF brochure file not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(assignment.brochure.title)}.pdf"`);
    
    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  }

  @Post('public/track/:token/event')
  async publicTrackEvent(
    @Param('token') token: string,
    @Body() body: { eventType: 'OPEN' | 'PAGE_VIEW' | 'HEARTBEAT' | 'DOWNLOAD'; payload?: any }
  ) {
    if (!body.eventType) {
      throw new BadRequestException('eventType is required');
    }
    return this.brochureService.trackEvent(token, body.eventType, body.payload);
  }
}

@Controller('api/v1/brochure')
export class PublicBrochureController {
  constructor(private readonly brochureService: BrochureService) {}

  @Get('view/:trackingId')
  async publicGetAssignment(@Param('trackingId') trackingId: string) {
    const assignment = await this.brochureService.getAssignmentByToken(trackingId);
    return {
      id: assignment.id,
      token: assignment.token,
      brochure: {
        title: assignment.brochure.title,
        category: assignment.brochure.category,
        totalPages: assignment.brochure.totalPages,
      },
      tracking: assignment.tracking ? {
        opened: assignment.tracking.opened,
        readingTime: assignment.tracking.readingTime,
        pageViews: assignment.tracking.pageViews,
        completionPercentage: assignment.tracking.completionPercentage,
        lastPageViewed: assignment.tracking.lastPageViewed,
        downloadCount: assignment.tracking.downloadCount,
        viewedPages: assignment.tracking.viewedPages,
      } : null,
    };
  }

  @Get('pdf/:trackingId')
  async publicGetPdf(@Param('trackingId') trackingId: string, @Res() res: Response) {
    const assignment = await this.brochureService.getAssignmentByToken(trackingId);
    
    const resolvedPath = path.resolve(UPLOAD_ROOT, assignment.brochure.filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Physical PDF brochure file not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(assignment.brochure.title)}.pdf"`);
    
    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  }

  @Post('event/:trackingId')
  async publicTrackEvent(
    @Param('trackingId') trackingId: string,
    @Body() body: { eventType: 'OPEN' | 'PAGE_VIEW' | 'HEARTBEAT' | 'DOWNLOAD'; payload?: any }
  ) {
    if (!body.eventType) {
      throw new BadRequestException('eventType is required');
    }
    try {
      return await this.brochureService.trackEvent(trackingId, body.eventType, body.payload);
    } catch (err: any) {
      console.error(`[BROCHURE TRACKING ERROR] Failed to track public event ${body.eventType} for token ${trackingId}:`, err);
      return {
        success: false,
        message: 'Tracking temporarily offline, reading is permitted.',
        error: err.message
      };
    }
  }
}
