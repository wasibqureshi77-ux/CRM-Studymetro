import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalStorageProvider } from '../../common/storage/local-storage.provider';
import { LeadCategory } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { BROCHURE_SCORING, LEAD_LABEL_THRESHOLDS } from './brochure.config';

@Injectable()
export class BrochureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageProvider: LocalStorageProvider
  ) {}

  async createBrochure(title: string, category: LeadCategory, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    let totalPages = 1;
    try {
      let buffer: Buffer;
      if (file.buffer) {
        buffer = file.buffer;
      } else if (file.path) {
        buffer = fs.readFileSync(file.path);
      } else {
        throw new Error('No file content found');
      }
      const pdfDoc = await PDFDocument.load(buffer);
      totalPages = pdfDoc.getPageCount();
    } catch (err) {
      console.error('Error loading PDF with pdf-lib:', err);
      // fallback if pdf is not loaded correctly, default to 1 page or throw error
      totalPages = 1;
    }

    // Save using LocalStorageProvider
    const timestamp = Math.floor(Date.now() / 1000);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const relativePath = `brochures/${timestamp}-${sanitizedName}`;
    
    await this.storageProvider.upload(file, relativePath);

    return this.prisma.brochure.create({
      data: {
        title,
        category,
        filePath: relativePath,
        totalPages,
        isActive: true,
      },
    });
  }

  async findAll() {
    return this.prisma.brochure.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Partial<{ title: string; category: LeadCategory; isActive: boolean }>) {
    const brochure = await this.prisma.brochure.findUnique({ where: { id } });
    if (!brochure) throw new NotFoundException('Brochure not found');

    return this.prisma.brochure.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const brochure = await this.prisma.brochure.findUnique({ where: { id } });
    if (!brochure) throw new NotFoundException('Brochure not found');

    // delete file
    try {
      await this.storageProvider.delete(brochure.filePath);
    } catch (err) {
      console.error('Failed to delete brochure file:', err);
    }

    return this.prisma.brochure.delete({
      where: { id },
    });
  }

  async assignBrochure(leadId: string, brochureId: string, actorId?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const brochure = await this.prisma.brochure.findUnique({ where: { id: brochureId } });
    if (!brochure) throw new NotFoundException('Brochure not found');

    const token = crypto.randomBytes(24).toString('hex');

    const assignment = await this.prisma.brochureAssignment.create({
      data: {
        leadId,
        brochureId,
        token,
        assignedBy: actorId,
        tracking: {
          create: {
            opened: false,
            readingTime: 0,
            pageViews: 0,
            completionPercentage: 0,
            lastPageViewed: 0,
            downloadCount: 0,
            viewedPages: '',
            engagementScore: 0,
          },
        },
      },
      include: {
        brochure: true,
        tracking: true,
      },
    });

    // Create activity timeline event
    await this.prisma.activity.create({
      data: {
        leadId,
        actorId,
        type: 'BROCHURE_SENT',
        description: `Brochure "${brochure.title}" was sent to the lead.`,
        meta: { brochureId, brochureTitle: brochure.title, token },
      },
    });

    return assignment;
  }

  async getLeadAssignments(leadId: string) {
    return this.prisma.brochureAssignment.findMany({
      where: { leadId },
      include: {
        brochure: true,
        tracking: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getAssignmentByToken(token: string) {
    const assignment = await this.prisma.brochureAssignment.findUnique({
      where: { token },
      include: {
        brochure: true,
        tracking: true,
        lead: true,
      },
    });
    if (!assignment) throw new NotFoundException('Invalid or expired brochure token');
    return assignment;
  }

  async trackEvent(token: string, eventType: 'OPEN' | 'PAGE_VIEW' | 'HEARTBEAT' | 'DOWNLOAD', payload?: any) {
    const assignment = await this.getAssignmentByToken(token);
    const tracking = assignment.tracking;
    if (!tracking) {
      throw new BadRequestException('Tracking record not initialized for assignment');
    }

    let opened = tracking.opened;
    let readingTime = tracking.readingTime;
    let pageViews = tracking.pageViews;
    let lastPageViewed = tracking.lastPageViewed;
    let downloadCount = tracking.downloadCount;
    let viewedPages = tracking.viewedPages;
    let completionPercentage = tracking.completionPercentage;

    let activityCreatedType: string | null = null;
    let activityDesc = '';

    if (eventType === 'OPEN') {
      if (!opened) {
        opened = true;
        activityCreatedType = 'BROCHURE_OPENED';
        activityDesc = `Lead opened the brochure "${assignment.brochure.title}".`;
      }
    } else if (eventType === 'PAGE_VIEW') {
      const pageNum = Number(payload?.pageNumber);
      if (pageNum && pageNum > 0 && pageNum <= assignment.brochure.totalPages) {
        pageViews += 1;
        lastPageViewed = pageNum;
        
        // Update viewed pages
        const pagesSet = new Set(viewedPages ? viewedPages.split(',').filter(Boolean) : []);
        const pageStr = String(pageNum);
        if (!pagesSet.has(pageStr)) {
          pagesSet.add(pageStr);
          viewedPages = Array.from(pagesSet).join(',');
          
          // Recalculate completion
          const totalPages = assignment.brochure.totalPages;
          completionPercentage = Math.min(100, Math.round((pagesSet.size / totalPages) * 100));

          // Log timeline events for milestones
          // check if we already logged them for this assignment
          const activities = await this.prisma.activity.findMany({
            where: { leadId: assignment.leadId },
            select: { type: true, meta: true }
          });
          const loggedTypes = activities
            .filter(item => {
              const metaObj = item.meta as any;
              return metaObj && metaObj.brochureId === assignment.brochureId;
            })
            .map(item => item.type);

          if (completionPercentage >= 25 && !loggedTypes.includes('BROCHURE_VIEWED_25')) {
            await this.prisma.activity.create({
              data: {
                leadId: assignment.leadId,
                type: 'BROCHURE_VIEWED_25',
                description: `Lead viewed 25% of the brochure "${assignment.brochure.title}".`,
                meta: { brochureId: assignment.brochureId, title: assignment.brochure.title },
              },
            });
          }

          if (completionPercentage >= 50 && !loggedTypes.includes('BROCHURE_VIEWED_50')) {
            await this.prisma.activity.create({
              data: {
                leadId: assignment.leadId,
                type: 'BROCHURE_VIEWED_50',
                description: `Lead viewed 50% of the brochure "${assignment.brochure.title}".`,
                meta: { brochureId: assignment.brochureId, title: assignment.brochure.title },
              },
            });
          }

          if (completionPercentage >= 80 && !loggedTypes.includes('BROCHURE_VIEWED_80')) {
            await this.prisma.activity.create({
              data: {
                leadId: assignment.leadId,
                type: 'BROCHURE_VIEWED_80',
                description: `Lead viewed 80% of the brochure "${assignment.brochure.title}".`,
                meta: { brochureId: assignment.brochureId, title: assignment.brochure.title },
              },
            });
          }

          if (completionPercentage >= 100 && !loggedTypes.includes('BROCHURE_COMPLETED')) {
            await this.prisma.activity.create({
              data: {
                leadId: assignment.leadId,
                type: 'BROCHURE_COMPLETED',
                description: `Lead completed reading the brochure "${assignment.brochure.title}".`,
                meta: { brochureId: assignment.brochureId, title: assignment.brochure.title },
              },
            });
          }
        }
      }
    } else if (eventType === 'HEARTBEAT') {
      const seconds = Number(payload?.seconds) || 10;
      readingTime += seconds;
    } else if (eventType === 'DOWNLOAD') {
      downloadCount += 1;
      activityCreatedType = 'BROCHURE_DOWNLOADED';
      activityDesc = `Lead downloaded the brochure "${assignment.brochure.title}".`;
    }

    // Calculate Engagement Score for this assignment
    const openedScore = opened ? BROCHURE_SCORING.OPENED : 0;
    const v50Score = completionPercentage >= 50 ? BROCHURE_SCORING.VIEWED_50 : 0;
    const v80Score = completionPercentage >= 80 ? BROCHURE_SCORING.VIEWED_80 : 0;
    const v100Score = completionPercentage >= 100 ? BROCHURE_SCORING.COMPLETED : 0;
    const downloadScore = downloadCount > 0 ? BROCHURE_SCORING.DOWNLOADED : 0;
    const assignmentScore = openedScore + v50Score + v80Score + v100Score + downloadScore;

    // Update tracking
    const updatedTracking = await this.prisma.brochureTracking.update({
      where: { brochureAssignmentId: assignment.id },
      data: {
        opened,
        readingTime,
        pageViews,
        lastPageViewed,
        downloadCount,
        viewedPages,
        completionPercentage,
        engagementScore: assignmentScore,
      },
    });

    // Write activity if triggered
    if (activityCreatedType) {
      await this.prisma.activity.create({
        data: {
          leadId: assignment.leadId,
          type: activityCreatedType,
          description: activityDesc,
          meta: { brochureId: assignment.brochureId, title: assignment.brochure.title },
        },
      });
    }

    // Recalculate lead total engagement score
    const allAssignments = await this.prisma.brochureAssignment.findMany({
      where: { leadId: assignment.leadId },
      include: { tracking: true },
    });

    const totalLeadScore = allAssignments.reduce((acc, curr) => acc + (curr.tracking?.engagementScore || 0), 0);

    let leadLabel = 'Cold';
    if (totalLeadScore >= LEAD_LABEL_THRESHOLDS.HOT) {
      leadLabel = 'Hot';
    } else if (totalLeadScore >= LEAD_LABEL_THRESHOLDS.WARM) {
      leadLabel = 'Warm';
    }

    await this.prisma.lead.update({
      where: { id: assignment.leadId },
      data: {
        engagementScore: totalLeadScore,
        engagementLabel: leadLabel,
      },
    });

    return {
      tracking: updatedTracking,
      leadEngagementScore: totalLeadScore,
      leadEngagementLabel: leadLabel,
    };
  }
}
