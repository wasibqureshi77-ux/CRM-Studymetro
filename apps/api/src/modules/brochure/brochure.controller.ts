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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, LeadCategory } from '@prisma/client';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

@Controller('api/v1/brochures')
export class BrochureController {
  constructor(private readonly brochureService: BrochureService) { }

  // ================= ADMIN ENDPOINTS =================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  async findAll() {
    return this.brochureService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { title?: string; category?: LeadCategory; isActive?: boolean }
  ) {
    return this.brochureService.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.brochureService.delete(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
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
  constructor(private readonly brochureService: BrochureService) { }

  @Get('view/:trackingId')
  async publicGetAssignment(@Param('trackingId') trackingId: string) {
    console.log(`[DEBUG] Token received in view: ${trackingId}`);
    const assignment = await this.brochureService.getAssignmentByToken(trackingId);
    console.log(`[DEBUG] Lead resolved: ${assignment.lead ? assignment.lead.id : 'None'}`);
    console.log(`[DEBUG] Brochure resolved: ${assignment.brochure ? assignment.brochure.id : 'None'}`);
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
    console.log(`[DEBUG] Token received in pdf stream: ${trackingId}`);
    const assignment = await this.brochureService.getAssignmentByToken(trackingId);

    const resolvedPath = path.resolve(UPLOAD_ROOT, assignment.brochure.filePath);
    console.log(`[DEBUG] PDF path resolved: ${resolvedPath}`);
    const exists = fs.existsSync(resolvedPath);
    console.log(`[DEBUG] PDF fetch result - file exists: ${exists}`);
    console.log(`[DEBUG] PDF page count: ${assignment.brochure ? assignment.brochure.totalPages : 0}`);

    if (!exists) {
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

  @Get('debug/:token')
  async publicDebugToken(@Param('token') token: string) {
    try {
      const assignment = await this.brochureService.getAssignmentByToken(token);
      const resolvedPath = path.resolve(UPLOAD_ROOT, assignment.brochure.filePath);
      const fileExists = fs.existsSync(resolvedPath);
      const appUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://crm.studymetro.com';
      return {
        token,
        leadFound: !!assignment.lead,
        brochureFound: !!assignment.brochure,
        brochureId: assignment.brochureId,
        pdfPath: assignment.brochure.filePath,
        publicUrl: `${appUrl}/brochure/view/${token}`,
        fileExists
      };
    } catch (err: any) {
      return {
        token,
        leadFound: false,
        brochureFound: false,
        brochureId: null,
        pdfPath: null,
        publicUrl: null,
        fileExists: false,
        error: err.message
      };
    }
  }
}
