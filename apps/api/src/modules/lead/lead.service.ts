import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto, AssignLeadDto, CreateNoteDto } from './dto/lead.dto';
import { LeadStatus, LeadSource, LeadCategory, CommunicationChannel } from '@prisma/client';
import * as crypto from 'crypto';

import { LeadDocumentService } from '../document/lead-document.service';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class LeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: LeadDocumentService,
    private readonly communicationService: CommunicationService
  ) { }

  private normalizeEmail(email?: string): string | null {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@')) return clean;
    const parts = clean.split('@');
    const local = parts[0].split('+')[0];
    return `${local}@${parts[1]}`;
  }

  private normalizePhone(phone?: string): string | null {
    if (!phone) return null;
    const clean = phone.replace(/[\s\-\(\)\[\]\{\}\+]/g, '');
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    return digits || null;
  }

  private mapCategoryToEnum(cat?: string): LeadCategory {
    if (!cat) return 'STUDY_ABROAD';
    const clean = cat.trim().toUpperCase().replace(/\s+/g, '_');
    switch (clean) {
      case 'STUDY_ABROAD': return 'STUDY_ABROAD';
      case 'IELTS': return 'IELTS';
      case 'PTE': return 'PTE';
      case 'ENGLISH_SPEAKING': return 'ENGLISH_SPEAKING';
      case 'COMPUTER_COURSE': return 'COMPUTER_COURSE';
      case 'DIGITAL_MARKETING': return 'DIGITAL_MARKETING';
      default: return 'OTHER';
    }
  }

  private async generateNextLeadNumber() {
    const lastLead = await this.prisma.lead.findFirst({
      where: {
        leadNumber: {
          startsWith: 'SM1'
        }
      },
      orderBy: {
        leadNumber: 'desc'
      }
    });

    if (lastLead && lastLead.leadNumber) {
      const lastNum = parseInt(lastLead.leadNumber.replace('SM', ''), 10);
      return `SM${lastNum + 1}`;
    }

    const totalCount = await this.prisma.lead.count();
    const nextNum = Math.max(1001, totalCount + 1);
    return `SM${nextNum}`;
  }

  private async generateNextStudentPortalId() {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const prefix = `STD${currentYear}`;

    const lastLead = await this.prisma.lead.findFirst({
      where: {
        studentPortalId: {
          startsWith: prefix,
        },
      },
      orderBy: {
        studentPortalId: 'desc',
      },
    });

    if (lastLead && lastLead.studentPortalId) {
      const lastNumStr = lastLead.studentPortalId.replace(prefix, '');
      const lastNum = parseInt(lastNumStr, 10);
      const nextNum = lastNum + 1;
      return `${prefix}${nextNum.toString().padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async create(dto: CreateLeadDto, tenantId: string, actorId: string) {
    const leadNumber = await this.generateNextLeadNumber();
    const normEmail = this.normalizeEmail(dto.email);
    const normPhone = this.normalizePhone(dto.phone);
    const category = this.mapCategoryToEnum(dto.leadCategory);

    let match = null;
    if (normEmail && normPhone && dto.firstName && category) {
      const candidates = await this.prisma.lead.findMany({
        where: {
          tenantId,
          deletedAt: null,
          normalizedEmail: normEmail,
          normalizedPhone: normPhone,
          leadCategory: category,
        }
      });

      const inputFirst = (dto.firstName || '').trim().toLowerCase();
      const inputLast = (dto.lastName || '').trim().toLowerCase();
      
      match = candidates.find(c => {
        const cFirst = (c.firstName || '').trim().toLowerCase();
        const cLast = (c.lastName || '').trim().toLowerCase();
        return cFirst === inputFirst && cLast === inputLast;
      }) || null;
    }

    const prefCountry = dto.preferredCountry || dto.studentProfile?.targetCountry;
    const intIntake = dto.intendedIntake || dto.studentProfile?.intake;
    const targetCourse = dto.leadCategory || dto.studentProfile?.targetCourse;

    if (match) {
      const updated = await this.prisma.lead.update({
        where: { id: match.id },
        data: {
          submissionCount: { increment: 1 },
          firstName: dto.firstName !== undefined ? dto.firstName : undefined,
          lastName: dto.lastName !== undefined ? dto.lastName : undefined,
          email: dto.email !== undefined ? dto.email : undefined,
          normalizedEmail: normEmail || undefined,
          phone: dto.phone !== undefined ? dto.phone : undefined,
          normalizedPhone: normPhone || undefined,
          leadCategory: category,
          preferredCountry: prefCountry !== undefined ? prefCountry : undefined,
          planningTimeline: dto.planningTimeline !== undefined ? dto.planningTimeline : undefined,
          intendedIntake: intIntake !== undefined ? intIntake : undefined,
          englishLevel: dto.englishLevel !== undefined ? dto.englishLevel : undefined,
          targetScore: dto.targetScore !== undefined ? dto.targetScore : undefined,
          purpose: dto.purpose !== undefined ? dto.purpose : undefined,
          courseInterest: dto.courseInterest !== undefined ? dto.courseInterest : undefined,
          studentProfile: {
            upsert: {
              create: {
                targetCountry: prefCountry || null,
                targetCourse: targetCourse || null,
                intake: intIntake || null,
                ieltsStatus: dto.studentProfile?.ieltsStatus || 'NOT_TAKEN',
                passportStatus: dto.studentProfile?.passportStatus || 'NO_PASSPORT',
                educationLevel: dto.studentProfile?.educationLevel || null,
                percentageGpa: dto.studentProfile?.percentageGpa || null,
                budget: dto.studentProfile?.budget || null,
                currentQualification: dto.studentProfile?.currentQualification || null
              },
              update: {
                targetCountry: prefCountry !== undefined ? prefCountry : undefined,
                targetCourse: targetCourse !== undefined ? targetCourse : undefined,
                intake: intIntake !== undefined ? intIntake : undefined,
                ieltsStatus: dto.studentProfile?.ieltsStatus,
                passportStatus: dto.studentProfile?.passportStatus,
                educationLevel: dto.studentProfile?.educationLevel,
                percentageGpa: dto.studentProfile?.percentageGpa,
                budget: dto.studentProfile?.budget,
                currentQualification: dto.studentProfile?.currentQualification
              }
            }
          }
        },
        include: { studentProfile: true }
      });

      await this.prisma.leadSubmission.create({
        data: {
          leadId: match.id,
          country: prefCountry || null,
          course: targetCourse || null,
          intake: intIntake || null,
          source: dto.source || match.source,
          preferredCountry: prefCountry || null,
          preferredCourse: targetCourse || null,
          intendedIntake: intIntake || null,
          planningTimeline: dto.planningTimeline || null,
          englishLevel: dto.englishLevel || null,
          targetScore: dto.targetScore || null,
          purpose: dto.purpose || null,
          courseInterest: dto.courseInterest || null
        }
      });

      await this.prisma.activity.create({
        data: {
          leadId: match.id,
          actorId,
          type: 'INGRESS_MATCH',
          description: 'Duplicate enquiry received',
          meta: { attemptedSource: dto.source },
        }
      });

      return updated;
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId }
      });
      if (!branch) {
        throw new BadRequestException('Branch not found under tenant');
      }
    }

    const status = (dto as any).status || LeadStatus.NEW_LEAD;
    const studentPortalId = await this.generateNextStudentPortalId();

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        normalizedEmail: normEmail,
        phone: dto.phone,
        normalizedPhone: normPhone,
        address: dto.address,
        leadNumber,
        studentPortalId,
        source: dto.source,
        status,
        submissionCount: 1,
        leadCategory: category,
        preferredCountry: prefCountry || null,
        planningTimeline: dto.planningTimeline || null,
        intendedIntake: intIntake || null,
        englishLevel: dto.englishLevel || null,
        targetScore: dto.targetScore || null,
        purpose: dto.purpose || null,
        courseInterest: dto.courseInterest || null,
        studentProfile: {
          create: {
            targetCountry: prefCountry || null,
            targetCourse: targetCourse || null,
            intake: intIntake || null,
            ieltsStatus: dto.studentProfile?.ieltsStatus || 'NOT_TAKEN',
            passportStatus: dto.studentProfile?.passportStatus || 'NO_PASSPORT',
            educationLevel: dto.studentProfile?.educationLevel || null,
            percentageGpa: dto.studentProfile?.percentageGpa || null,
            budget: dto.studentProfile?.budget || null,
            currentQualification: dto.studentProfile?.currentQualification || null
          }
        },
        submissions: {
          create: {
            country: prefCountry || null,
            course: targetCourse || null,
            intake: intIntake || null,
            source: dto.source,
            preferredCountry: prefCountry || null,
            preferredCourse: targetCourse || null,
            intendedIntake: intIntake || null,
            planningTimeline: dto.planningTimeline || null,
            englishLevel: dto.englishLevel || null,
            targetScore: dto.targetScore || null,
            purpose: dto.purpose || null,
            courseInterest: dto.courseInterest || null
          }
        }
      },
      include: { studentProfile: true }
    });

    // Generate dynamic documents checklist automatically based on leadCategory
    await this.documentService.generateChecklist(lead.id, lead.leadCategory);

    await this.prisma.activity.create({
      data: {
        leadId: lead.id,
        actorId,
        type: 'LEAD_CREATED',
        description: `Lead created via ${lead.source}`,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_CREATE',
        targetEntity: 'Lead',
        targetId: lead.id,
        afterState: lead as any,
      }
    });

    // Find and assign active brochure if matches category
    const brochure = await this.prisma.brochure.findFirst({
      where: { category: lead.leadCategory, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    let brochureLinkToken = '';
    if (brochure) {
      const token = crypto.randomBytes(24).toString('hex');
      await this.prisma.brochureAssignment.create({
        data: {
          leadId: lead.id,
          brochureId: brochure.id,
          token,
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
      });

      await this.prisma.activity.create({
        data: {
          leadId: lead.id,
          type: 'BROCHURE_SENT',
          description: `Brochure "${brochure.title}" was sent to the lead.`,
          meta: { brochureId: brochure.id, brochureTitle: brochure.title, token },
        },
      });
      const appUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://crm.studymetrojaipur.com';
      console.log(`[BROCHURE GENERATION] Assigned brochure "${brochure.title}" to lead ${lead.id}. Unique link: ${appUrl}/brochure/view/${token}`);
      brochureLinkToken = token;
    }

    // Enqueue welcome_brochure communication
    await this.communicationService.enqueue(
      lead.id,
      CommunicationChannel.EMAIL,
      'WELCOME_BROCHURE',
      { brochureLink: brochureLinkToken || '' },
      'LeadService'
    );

    // Auto-trigger WhatsApp automation if any exists for LEAD_CREATED
    try {
      const automation = await this.prisma.whatsappAutomation.findFirst({
        where: { tenantId, trigger: 'LEAD_CREATED', enabled: true },
        include: { template: true },
      });
      if (automation && automation.template) {
        const instance = await this.prisma.whatsappInstance.findFirst({
          where: { tenantId, status: 'CONNECTED' },
        });
        if (instance) {
          let body = automation.template.message;
          const variablesMap = {
            name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
            leadNumber: lead.leadNumber || '',
          };
          for (const key of Object.keys(variablesMap)) {
            body = body.replace(new RegExp(`{{${key}}}`, 'g'), variablesMap[key as keyof typeof variablesMap]);
          }
          const messageId = `msg-auto-${Date.now()}`;
          const dbMsg = await this.prisma.whatsappMessage.create({
            data: {
              leadId: lead.id,
              instanceId: instance.id,
              direction: 'OUTBOUND',
              messageType: 'TEXT',
              messageId,
              body,
              status: 'PENDING',
            },
          });

          // Dispatch job using standard WhatsappQueueService singleton instance to support Redis offline fallback
          const { WhatsappQueueService } = require('../whatsapp/queue/whatsapp.queue');
          if (WhatsappQueueService.instance) {
            await WhatsappQueueService.instance.enqueueMessage(instance.id, lead.phone, { text: body }, dbMsg.id);
            console.log(`[Whatsapp] Auto Lead Message Enqueued successfully for Msg ID: ${dbMsg.id}`);
          } else {
            console.error('[Whatsapp] Queue Service instance not registered. Cannot enqueue auto message.');
          }
        } else {
          console.warn(`[Whatsapp] No active connected instance found under tenant ${tenantId} for auto dispatch.`);
        }
      } else {
        console.log(`[Whatsapp] No active automation template found for LEAD_CREATED trigger under tenant ${tenantId}.`);
      }
    } catch (err) {
      console.error('Failed to trigger WhatsApp Lead Created automation:', err);
    }

    return lead;
  }

  async findAll(
    tenantId: string,
    filters: {
      status?: LeadStatus;
      branchId?: string;
      source?: LeadSource;
      targetCountry?: string;
      intake?: string;
      leadCategory?: LeadCategory;
      targetScore?: string;
      planningTimeline?: string;
      purpose?: string;
      courseInterest?: string;
      q?: string;
      appCountry?: string;
      appUniversity?: string;
      appCourse?: string;
      appIntake?: string;
      applicationStatus?: string;
      offerStatus?: string;
      visaStatus?: string;
      assigneeId?: string;
    }
  ) {
    const searchConditions: any[] = [];

    // 1. Text Search matching on Name, Email, Phone, or Lead Number
    if (filters.q) {
      const cleanQuery = filters.q.trim();
      searchConditions.push({
        OR: [
          { firstName: { contains: cleanQuery, mode: 'insensitive' } },
          { lastName: { contains: cleanQuery, mode: 'insensitive' } },
          { email: { contains: cleanQuery, mode: 'insensitive' } },
          { phone: { contains: cleanQuery } },
          { leadNumber: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      });
    }

    const appConditions: any = {};
    if (filters.appCountry) appConditions.country = { contains: filters.appCountry, mode: 'insensitive' };
    if (filters.appUniversity) appConditions.universityName = { contains: filters.appUniversity, mode: 'insensitive' };
    if (filters.appCourse) appConditions.courseName = { contains: filters.appCourse, mode: 'insensitive' };
    if (filters.appIntake) appConditions.intake = { contains: filters.appIntake, mode: 'insensitive' };
    if (filters.applicationStatus) appConditions.applicationStatus = filters.applicationStatus;
    if (filters.offerStatus) appConditions.offerStatus = filters.offerStatus;
    if (filters.visaStatus) appConditions.visaStatus = filters.visaStatus;

    const hasAppFilters = Object.keys(appConditions).length > 0;

    return this.prisma.lead.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        branchId: filters.branchId,
        source: filters.source,
        leadCategory: filters.leadCategory,
        assigneeId: filters.assigneeId,
        preferredCountry: filters.targetCountry ? { contains: filters.targetCountry, mode: 'insensitive' } : undefined,
        intendedIntake: filters.intake ? { contains: filters.intake, mode: 'insensitive' } : undefined,
        targetScore: filters.targetScore ? { contains: filters.targetScore, mode: 'insensitive' } : undefined,
        planningTimeline: filters.planningTimeline ? { contains: filters.planningTimeline, mode: 'insensitive' } : undefined,
        purpose: filters.purpose ? { contains: filters.purpose, mode: 'insensitive' } : undefined,
        courseInterest: filters.courseInterest ? { contains: filters.courseInterest, mode: 'insensitive' } : undefined,
        applications: hasAppFilters ? { some: appConditions } : undefined,
        AND: searchConditions.length > 0 ? searchConditions : undefined
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        studentProfile: true,
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        followups: {
          where: { status: 'SCHEDULED' },
          orderBy: { followupDate: 'asc' },
          take: 1
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  async findOne(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        studentProfile: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        activities: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        submissions: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, tenantId: string, actorId: string) {
    const lead = await this.findOne(id, tenantId);
    const beforeState = { ...lead };
    const normEmail = dto.email ? this.normalizeEmail(dto.email) : lead.normalizedEmail;
    const normPhone = dto.phone ? this.normalizePhone(dto.phone) : lead.normalizedPhone;

    const RESTRICTED_STAGES = [
      'DOCUMENTS_RECEIVED',
      'UNIVERSITY_APPLIED',
      'OFFER_LETTER',
      'VISA_PROCESS',
      'ADMISSION_CLOSED'
    ];
    if (dto.status && RESTRICTED_STAGES.includes(dto.status)) {
      if (lead.readinessScore === null || lead.readinessScore < 100) {
        throw new BadRequestException('Cannot move lead to Documents Received or later stages until all required documents are 100% verified (Readiness Score is 100%).');
      }
    }

    if (dto.status && dto.status !== lead.status) {
      this.validateStatusTransition(lead.status, dto.status, lead.studentProfile);
    }

    const category = dto.leadCategory ? this.mapCategoryToEnum(dto.leadCategory) : undefined;
    const prefCountry = dto.preferredCountry || dto.studentProfile?.targetCountry;
    const intIntake = dto.intendedIntake || dto.studentProfile?.intake;
    const targetCourse = dto.leadCategory || dto.studentProfile?.targetCourse;

    let studentPortalId = undefined;
    if (!lead.studentPortalId) {
      studentPortalId = await this.generateNextStudentPortalId();
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        normalizedEmail: normEmail,
        phone: dto.phone,
        normalizedPhone: normPhone,
        address: dto.address,
        status: dto.status,
        studentPortalId,
        source: dto.source,
        leadCategory: category,
        preferredCountry: dto.preferredCountry,
        planningTimeline: dto.planningTimeline,
        intendedIntake: dto.intendedIntake,
        englishLevel: dto.englishLevel,
        targetScore: dto.targetScore,
        purpose: dto.purpose,
        courseInterest: dto.courseInterest,
        studentProfile: (dto.studentProfile || dto.preferredCountry || dto.intendedIntake || dto.leadCategory) ? {
          upsert: {
            create: {
              targetCountry: prefCountry || null,
              targetCourse: targetCourse || null,
              intake: intIntake || null,
              ieltsStatus: dto.studentProfile?.ieltsStatus || 'NOT_TAKEN',
              passportStatus: dto.studentProfile?.passportStatus || 'NO_PASSPORT',
              educationLevel: dto.studentProfile?.educationLevel || null,
              percentageGpa: dto.studentProfile?.percentageGpa || null,
              budget: dto.studentProfile?.budget || null,
              currentQualification: dto.studentProfile?.currentQualification || null
            },
            update: {
              targetCountry: prefCountry !== undefined ? prefCountry : undefined,
              targetCourse: targetCourse !== undefined ? targetCourse : undefined,
              intake: intIntake !== undefined ? intIntake : undefined,
              ieltsStatus: dto.studentProfile?.ieltsStatus,
              passportStatus: dto.studentProfile?.passportStatus,
              educationLevel: dto.studentProfile?.educationLevel,
              percentageGpa: dto.studentProfile?.percentageGpa,
              budget: dto.studentProfile?.budget,
              currentQualification: dto.studentProfile?.currentQualification
            }
          }
        } : undefined
      },
      include: { studentProfile: true }
    });

    if (dto.status && dto.status !== lead.status) {
      await this.prisma.activity.create({
        data: {
          leadId: id,
          actorId,
          type: 'STATUS_CHANGE',
          description: `Status transitioned from ${lead.status} to ${dto.status}`,
          meta: { from: lead.status, to: dto.status }
        }
      });

      if (dto.status === 'DOCUMENTS_PENDING') {
        const pendingDocs = await this.prisma.leadDocument.findMany({
          where: { leadId: id, status: 'PENDING', isCurrent: true }
        });
        const docTypeList = pendingDocs.map(d => d.documentType).join(', ') || 'Passport, Marksheets, SOP, LOR';
        await this.communicationService.enqueue(id, CommunicationChannel.EMAIL, 'DOCUMENT_REQUEST', { documentList: docTypeList }, 'LeadService');
        await this.communicationService.enqueue(id, CommunicationChannel.WHATSAPP, 'DOCUMENT_REQUEST', { documentList: docTypeList }, 'LeadService');
      }

      // Synchronize latest university application status for Study Abroad category leads
      if (lead.leadCategory === 'STUDY_ABROAD') {
        const latestApp = await this.prisma.application.findFirst({
          where: { leadId: id },
          orderBy: { createdAt: 'desc' }
        });

        if (latestApp) {
          if (dto.status === 'OFFER_LETTER') {
            await this.prisma.application.update({
              where: { id: latestApp.id },
              data: {
                applicationStatus: 'DECISION_RECEIVED',
                offerStatus: 'CONDITIONAL_OFFER',
                offerDate: latestApp.offerDate || new Date()
              }
            });
          } else if (dto.status === 'VISA_PROCESS') {
            await this.prisma.application.update({
              where: { id: latestApp.id },
              data: {
                offerStatus: 'OFFER_ACCEPTED',
                visaStatus: 'VISA_APPLIED',
                visaDate: latestApp.visaDate || new Date()
              }
            });
          } else if (dto.status === 'ADMISSION_CLOSED') {
            await this.prisma.application.update({
              where: { id: latestApp.id },
              data: {
                visaStatus: 'VISA_APPROVED'
              }
            });
          }
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_UPDATE',
        targetEntity: 'Lead',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any,
      }
    });

    return updated;
  }

  async assign(id: string, dto: AssignLeadDto, tenantId: string, actorId: string) {
    const lead = await this.findOne(id, tenantId);
    const beforeState = { ...lead };

    if (dto.assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assigneeId, tenantId, isActive: true }
      });
      if (!user) {
        throw new BadRequestException('Assignee user not found or inactive');
      }
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId }
      });
      if (!branch) {
        throw new BadRequestException('Branch not found under tenant');
      }
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        assigneeId: dto.assigneeId,
        branchId: dto.branchId
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId: id,
        actorId,
        type: 'LEAD_ASSIGNED',
        description: `Lead allocated to user ${dto.assigneeId || 'Unassigned'} under branch ${dto.branchId || 'Unassigned'}`,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_ASSIGN',
        targetEntity: 'Lead',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any,
      }
    });

    return updated;
  }

  async addNote(id: string, dto: CreateNoteDto, tenantId: string, authorId: string) {
    await this.findOne(id, tenantId);

    const note = await this.prisma.note.create({
      data: {
        leadId: id,
        authorId,
        content: dto.content
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId: id,
        actorId: authorId,
        type: 'NOTE_ADDED',
        description: 'New counselor note appended to timeline',
        meta: { noteId: note.id }
      }
    });

    return note;
  }

  async findActivities(
    tenantId: string,
    filters: { leadId?: string; activityType?: string; date?: string; assigneeId?: string }
  ) {
    const whereClause: any = {
      lead: {
        tenantId,
        deletedAt: null,
        assigneeId: filters.assigneeId
      }
    };

    if (filters.leadId) {
      whereClause.leadId = filters.leadId;
    }

    if (filters.activityType) {
      whereClause.type = filters.activityType;
    }

    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt = {
        gte: start,
        lte: end
      };
    }

    return this.prisma.activity.findMany({
      where: whereClause,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getTimeline(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        activities: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        followups: { orderBy: { followupDate: 'desc' } },
        submissions: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Stitch together all items chronologically
    const timeline = [
      ...lead.activities.map(a => ({ type: 'activity', date: a.createdAt, data: a })),
      ...lead.notes.map(n => ({ type: 'note', date: n.createdAt, data: n })),
      ...lead.documents.filter(d => d.uploadedAt).map(d => ({ type: 'document', date: d.uploadedAt!, data: d })),
      ...lead.followups.map(f => ({ type: 'followup', date: f.createdAt, data: f })),
      ...lead.submissions.map((s, index) => ({
        type: 'submission',
        date: s.createdAt,
        data: {
          ...s,
          requestNumber: lead.submissions.length - index
        }
      }))
    ];

    return timeline.sort((a, b) => {
      const aTime = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const bTime = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return bTime - aTime;
    });
  }

  async bulkAssign(leadIds: string[], assigneeId: string, branchId: string, tenantId: string, actorId: string) {
    // 1. Verify User and Branch are valid
    const user = await this.prisma.user.findFirst({
      where: { id: assigneeId, tenantId, isActive: true }
    });
    if (!user) {
      throw new BadRequestException('Target assignee not found or inactive');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId }
    });
    if (!branch) {
      throw new BadRequestException('Target branch not found under tenant');
    }

    // 2. Perform bulk update
    const result = await this.prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        tenantId,
        deletedAt: null
      },
      data: {
        assigneeId,
        branchId
      }
    });

    // 3. Log timeline activity for each modified lead
    for (const leadId of leadIds) {
      await this.prisma.activity.create({
        data: {
          leadId,
          actorId,
          type: 'LEAD_BULK_ASSIGNED',
          description: `Allocated to user ${user.firstName} ${user.lastName} under branch ${branch.name} via bulk action.`,
        }
      });
    }

    // 4. Audit Log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_BULK_ASSIGN',
        targetEntity: 'Lead',
        targetId: 'BULK_ACTION',
        afterState: { leadIds, assigneeId, branchId } as any
      }
    });

    return result;
  }

  async bulkStatusUpdate(leadIds: string[], status: LeadStatus, tenantId: string, actorId: string) {
    const RESTRICTED_STAGES = [
      'DOCUMENTS_RECEIVED',
      'UNIVERSITY_APPLIED',
      'OFFER_LETTER',
      'VISA_PROCESS',
      'ADMISSION_CLOSED'
    ];
    if (RESTRICTED_STAGES.includes(status)) {
      const unreadyLeads = await this.prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          tenantId,
          deletedAt: null,
          OR: [
            { readinessScore: null },
            { readinessScore: { lt: 100 } }
          ]
        },
        select: { firstName: true, lastName: true }
      });
      if (unreadyLeads.length > 0) {
        const names = unreadyLeads.map(l => `${l.firstName} ${l.lastName || ''}`.trim()).join(', ');
        throw new BadRequestException(`Cannot update status. The following leads do not have 100% verified documents: ${names}`);
      }
    }

    // Perform bulk update
    const result = await this.prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        tenantId,
        deletedAt: null
      },
      data: { status }
    });

    for (const leadId of leadIds) {
      await this.prisma.activity.create({
        data: {
          leadId,
          actorId,
          type: 'LEAD_BULK_STATUS_UPDATE',
          description: `Status updated to ${status} via bulk action.`,
        }
      });

      if (status === 'DOCUMENTS_PENDING') {
        const pendingDocs = await this.prisma.leadDocument.findMany({
          where: { leadId, status: 'PENDING', isCurrent: true }
        });
        const docTypeList = pendingDocs.map(d => d.documentType).join(', ') || 'Passport, Marksheets, SOP, LOR';
        await this.communicationService.enqueue(leadId, CommunicationChannel.EMAIL, 'DOCUMENT_REQUEST', { documentList: docTypeList }, 'LeadService');
        await this.communicationService.enqueue(leadId, CommunicationChannel.WHATSAPP, 'DOCUMENT_REQUEST', { documentList: docTypeList }, 'LeadService');
      }
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_BULK_STATUS',
        targetEntity: 'Lead',
        targetId: 'BULK_ACTION',
        afterState: { leadIds, status } as any
      }
    });

    return result;
  }

  async merge(primaryId: string, duplicateId: string, tenantId: string, actorId: string) {
    const primary = await this.findOne(primaryId, tenantId);
    const duplicate = await this.findOne(duplicateId, tenantId);

    const beforeState = { primary, duplicate };

    // 1. Relocate child entities
    await this.prisma.leadDocument.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    await this.prisma.activity.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    await this.prisma.note.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    await this.prisma.followup.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    // 2. Merge details if empty on primary
    const updateData: any = {};
    if (!primary.phone && duplicate.phone) {
      updateData.phone = duplicate.phone;
      updateData.normalizedPhone = duplicate.normalizedPhone;
    }
    if (!primary.email && duplicate.email) {
      updateData.email = duplicate.email;
      updateData.normalizedEmail = duplicate.normalizedEmail;
    }

    await this.prisma.lead.update({
      where: { id: primaryId },
      data: updateData
    });

    // 3. Soft delete duplicate record
    await this.prisma.lead.update({
      where: { id: duplicateId },
      data: { deletedAt: new Date() }
    });

    // 4. Log merge event on timeline
    await this.prisma.activity.create({
      data: {
        leadId: primaryId,
        actorId,
        type: 'LEAD_MERGED',
        description: `Lead ${duplicate.firstName || ''} ${duplicate.lastName || ''} (ID: ${duplicateId}) was merged into this record.`,
      }
    });

    // 5. Audit Log Entry
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_MERGE',
        targetEntity: 'Lead',
        targetId: primaryId,
        beforeState: beforeState as any,
        afterState: { primaryId, duplicateId } as any
      }
    });

    return { success: true };
  }

  async getUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, branchId: true }
    });
  }

  async getBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true }
    });
  }

  private validateStatusTransition(from: LeadStatus, to: LeadStatus, profile: any) {
    // Pipeline board drag-and-drop allows all transitions
  }
}
