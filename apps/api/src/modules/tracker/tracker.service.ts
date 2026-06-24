import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackEventDto, TrackFormDto, IdentifyVisitorDto } from './dto/tracker.dto';
import { LeadSource, LeadCategory, CommunicationChannel } from '@prisma/client';
import * as crypto from 'crypto';

import { LeadDocumentService } from '../document/lead-document.service';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class TrackerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: LeadDocumentService,
    private readonly communicationService: CommunicationService
  ) { }

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

  async trackEvent(dto: TrackEventDto, tenantId: string) {
    // 1. Verify Tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) {
      throw new NotFoundException('Tenant context invalid');
    }

    // 2. Resolve/Create Visitor
    let visitor = await this.prisma.visitor.findUnique({
      where: { id: dto.visitorId }
    });

    if (!visitor) {
      visitor = await this.prisma.visitor.create({
        data: {
          id: dto.visitorId,
          tenantId
        }
      });
    }

    // 3. Resolve/Create Session
    let session = await this.prisma.visitorSession.findUnique({
      where: { sessionId: dto.sessionId }
    });

    if (!session) {
      const meta = dto.meta || {};
      session = await this.prisma.visitorSession.create({
        data: {
          visitorId: dto.visitorId,
          sessionId: dto.sessionId,
          referrer: meta.referrer || null,
          landingPage: meta.landingPage || null,
          deviceType: meta.deviceType || null,
          browser: meta.browser || null,
          utmSource: meta.utmSource || null,
          utmMedium: meta.utmMedium || null,
          utmCampaign: meta.utmCampaign || null,
          utmContent: meta.utmContent || null,
          utmTerm: meta.utmTerm || null
        }
      });

      // Task 5 & Task 8: Source Attribution Logic
      let sourceName = 'Website';
      const utmSrc = (meta.utmSource || '').toLowerCase();
      const ref = (meta.referrer || '').toLowerCase();

      if (utmSrc === 'gmb' || utmSrc === 'google_business_profile' || ref.indexOf('business.google.com') > -1) {
        sourceName = 'Google Business Profile';
      } else if (utmSrc.indexOf('facebook') > -1 || utmSrc.indexOf('fb') > -1 || ref.indexOf('facebook.com') > -1 || ref.indexOf('l.facebook.com') > -1) {
        sourceName = 'Facebook';
      } else if (utmSrc.indexOf('instagram') > -1 || utmSrc.indexOf('ig') > -1 || ref.indexOf('instagram.com') > -1 || ref.indexOf('l.instagram.com') > -1) {
        sourceName = 'Instagram';
      } else if (utmSrc.indexOf('google') > -1 && utmSrc.indexOf('ad') > -1) {
        sourceName = 'Google Ads';
      } else if (ref && ref.indexOf('studymetrojaipur.com') === -1 && ref.indexOf('localhost') === -1) {
        sourceName = 'Referral';
      } else if (!ref && !meta.utmSource) {
        sourceName = 'Direct';
      }

      await this.prisma.trackingSource.create({
        data: {
          sessionId: dto.sessionId,
          source: sourceName,
          landingPage: meta.landingPage || '',
          referrer: meta.referrer || null
        }
      });
    }

    // 4. Log Event
    const event = await this.prisma.visitorEvent.create({
      data: {
        sessionId: dto.sessionId,
        type: dto.type,
        meta: dto.meta || {}
      }
    });

    // If PAGE_VIEW, and visitor is already associated with a lead, log WEBSITE_VISIT activity immediately
    if (dto.type === 'PAGE_VIEW') {
      const matchedLead = await this.prisma.lead.findFirst({
        where: { visitorId: dto.visitorId, tenantId, deletedAt: null }
      });
      if (matchedLead) {
        const pageUrl = dto.meta?.landingPage || 'Landing Page';
        await this.prisma.activity.create({
          data: {
            leadId: matchedLead.id,
            type: 'WEBSITE_VISIT',
            description: `Visitor visited page: ${pageUrl}`,
            meta: {
              sessionId: dto.sessionId,
              referrer: dto.meta?.referrer || null,
              utmSource: dto.meta?.utmSource || null,
              utmMedium: dto.meta?.utmMedium || null,
              utmCampaign: dto.meta?.utmCampaign || null
            }
          }
        });
      }
    }

    return event;
  }

  // Helper to sync past events to activities for a lead
  private async syncPastEventsToActivities(visitorId: string, leadId: string) {
    // Find all visitor sessions for this visitor
    const sessions = await this.prisma.visitorSession.findMany({
      where: { visitorId },
      include: { events: true }
    });

    for (const session of sessions) {
      for (const event of session.events) {
        if (event.type === 'PAGE_VIEW') {
          const meta = (event.meta as any) || {};
          const pageUrl = meta.landingPage || 'Landing Page';

          // Check if activity already exists to prevent duplicate entries
          const existingActivity = await this.prisma.activity.findFirst({
            where: {
              leadId,
              type: 'WEBSITE_VISIT',
              createdAt: event.createdAt
            }
          });

          if (!existingActivity) {
            await this.prisma.activity.create({
              data: {
                leadId,
                type: 'WEBSITE_VISIT',
                description: `Visitor visited page: ${pageUrl}`,
                meta: {
                  sessionId: session.sessionId,
                  referrer: meta.referrer || null,
                  utmSource: meta.utmSource || null,
                  utmMedium: meta.utmMedium || null,
                  utmCampaign: meta.utmCampaign || null,
                },
                createdAt: event.createdAt
              }
            });
          }
        }
      }
    }
  }

  async trackForm(dto: TrackFormDto, tenantId: string) {
    // 1. Resolve/Create Visitor
    let visitor = await this.prisma.visitor.findUnique({
      where: { id: dto.visitorId }
    });

    if (!visitor) {
      visitor = await this.prisma.visitor.create({
        data: {
          id: dto.visitorId,
          tenantId
        }
      });
    }

    // 2. Resolve/Create Session
    let session = await this.prisma.visitorSession.findUnique({
      where: { sessionId: dto.sessionId }
    });

    if (!session) {
      session = await this.prisma.visitorSession.create({
        data: {
          visitorId: dto.visitorId,
          sessionId: dto.sessionId,
          landingPage: dto.url,
          referrer: dto.referrer || null,
          utmSource: dto.utmSource || null,
          utmMedium: dto.utmMedium || null,
          utmCampaign: dto.utmCampaign || null,
          utmContent: dto.utmContent || null,
          utmTerm: dto.utmTerm || null
        }
      });
    } else {
      // Update session with UTMs or referrer if not present
      const sessionUpdate: any = {};
      if (!session.referrer && dto.referrer) sessionUpdate.referrer = dto.referrer;
      if (!session.landingPage && dto.url) sessionUpdate.landingPage = dto.url;
      if (!session.utmSource && dto.utmSource) sessionUpdate.utmSource = dto.utmSource;
      if (!session.utmMedium && dto.utmMedium) sessionUpdate.utmMedium = dto.utmMedium;
      if (!session.utmCampaign && dto.utmCampaign) sessionUpdate.utmCampaign = dto.utmCampaign;
      if (!session.utmContent && dto.utmContent) sessionUpdate.utmContent = dto.utmContent;
      if (!session.utmTerm && dto.utmTerm) sessionUpdate.utmTerm = dto.utmTerm;

      if (Object.keys(sessionUpdate).length > 0) {
        session = await this.prisma.visitorSession.update({
          where: { sessionId: dto.sessionId },
          data: sessionUpdate
        });
      }
    }

    // 3. Log Event
    await this.prisma.visitorEvent.create({
      data: {
        sessionId: dto.sessionId,
        type: 'FORM_SUBMIT',
        meta: {
          url: dto.url,
          formFields: dto.formFields,
          referrer: dto.referrer || null,
          utmSource: dto.utmSource || null,
          utmMedium: dto.utmMedium || null,
          utmCampaign: dto.utmCampaign || null,
          utmContent: dto.utmContent || null,
          utmTerm: dto.utmTerm || null
        }
      }
    });

    // 4. Extract fields & check duplicate
    const email = dto.formFields.email;
    const phone = dto.formFields.phone;

    let normEmail = null;
    if (email) {
      const clean = email.trim().toLowerCase();
      if (clean.includes('@')) {
        const parts = clean.split('@');
        normEmail = `${parts[0].split('+')[0]}@${parts[1]}`;
      } else {
        normEmail = clean;
      }
    }

    let normPhone = null;
    if (phone) {
      const clean = phone.replace(/[\s\-\(\)\[\]\{\}\+]/g, '');
      const digits = clean.replace(/\D/g, '');
      if (digits.length >= 10) {
        normPhone = digits.slice(-10);
      } else {
        normPhone = digits || null;
      }
    }

    const preferredCountry = dto.formFields.preferredCountry || dto.formFields.country || null;
    const preferredCourse = dto.formFields.preferredCourse || null;
    const intendedIntake = dto.formFields.intendedIntake || dto.formFields.intake || null;
    const planningTimeline = dto.formFields.planningTimeline || null;
    const englishLevel = dto.formFields.englishLevel || null;
    const targetScore = dto.formFields.targetScore ? String(dto.formFields.targetScore) : null;
    const purpose = dto.formFields.purpose || null;
    const courseInterest = dto.formFields.courseInterest || null;

    const country = preferredCountry;
    const course = preferredCourse || dto.formFields.course || null;
    const intake = intendedIntake;

    const category = this.mapCategoryToEnum(dto.formFields.leadCategory);

    // Split name
    const fullName = dto.formFields.name || 'Anonymous Visitor';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    let existingLead = null;
    if (normEmail && normPhone && firstName && category) {
      const candidates = await this.prisma.lead.findMany({
        where: {
          tenantId,
          deletedAt: null,
          normalizedEmail: normEmail,
          normalizedPhone: normPhone,
          leadCategory: category,
        },
        include: {
          studentProfile: true
        }
      });

      const inputFirst = firstName.trim().toLowerCase();
      const inputLast = lastName.trim().toLowerCase();

      existingLead = candidates.find(c => {
        const cFirst = (c.firstName || '').trim().toLowerCase();
        const cLast = (c.lastName || '').trim().toLowerCase();
        return cFirst === inputFirst && cLast === inputLast;
      }) || null;
    }

    if (existingLead) {
      // Check for changes and create timeline event activities
      if (category === 'STUDY_ABROAD') {
        const changes: string[] = [];
        if (preferredCountry && preferredCountry !== existingLead.preferredCountry) {
          changes.push(`Preferred Country changed: ${existingLead.preferredCountry || 'None'} → ${preferredCountry}`);
        }
        if (preferredCourse && preferredCourse !== existingLead.preferredCourse) {
          changes.push(`Preferred Course changed: ${existingLead.preferredCourse || 'None'} → ${preferredCourse}`);
        }
        if (intendedIntake && intendedIntake !== existingLead.intendedIntake) {
          changes.push(`Intended Intake changed: ${existingLead.intendedIntake || 'None'} → ${intake}`);
        }
        if (planningTimeline && planningTimeline !== existingLead.planningTimeline) {
          changes.push(`Planning Timeline changed: ${existingLead.planningTimeline || 'None'} → ${planningTimeline}`);
        }
        if (changes.length > 0) {
          await this.prisma.activity.create({
            data: {
              leadId: existingLead.id,
              type: 'STUDY_ABROAD_INTEREST_UPDATED',
              description: `Study Abroad Interest Updated:\n${changes.join('\n')}`
            }
          });
        }
      } else if (category === 'IELTS') {
        if (targetScore && targetScore !== existingLead.targetScore) {
          await this.prisma.activity.create({
            data: {
              leadId: existingLead.id,
              type: 'IELTS_TARGET_SCORE_UPDATED',
              description: `Target Score changed: ${existingLead.targetScore || 'None'} → ${targetScore}`
            }
          });
        }
      } else if (category === 'PTE') {
        if (targetScore && targetScore !== existingLead.targetScore) {
          await this.prisma.activity.create({
            data: {
              leadId: existingLead.id,
              type: 'PTE_TARGET_SCORE_UPDATED',
              description: `Target Score changed: ${existingLead.targetScore || 'None'} → ${targetScore}`
            }
          });
        }
      } else if (category === 'ENGLISH_SPEAKING') {
        if (purpose && purpose !== existingLead.purpose) {
          await this.prisma.activity.create({
            data: {
              leadId: existingLead.id,
              type: 'ENGLISH_SPEAKING_PURPOSE_UPDATED',
              description: `Purpose changed: ${existingLead.purpose || 'None'} → ${purpose}`
            }
          });
        }
      } else if (category === 'COMPUTER_COURSE') {
        if (courseInterest && courseInterest !== existingLead.courseInterest) {
          await this.prisma.activity.create({
            data: {
              leadId: existingLead.id,
              type: 'COMPUTER_COURSE_INTEREST_UPDATED',
              description: `Course Interest changed: ${existingLead.courseInterest || 'None'} → ${courseInterest}`
            }
          });
        }
      }

      // Prevent duplicates: link current visitor, and create match activity log
      const updateData: any = {
        submissionCount: { increment: 1 },
        leadCategory: category,
        preferredCountry: preferredCountry || undefined,
        preferredCourse: preferredCourse || undefined,
        planningTimeline: planningTimeline || undefined,
        intendedIntake: intendedIntake || undefined,
        englishLevel: englishLevel || undefined,
        targetScore: targetScore || undefined,
        purpose: purpose || undefined,
        courseInterest: courseInterest || undefined
      };
      if (!existingLead.visitorId) {
        updateData.visitorId = dto.visitorId;
      }

      // Update studentProfile fields if missing/changed and supplied
      if (country || course || intake) {
        updateData.studentProfile = {
          upsert: {
            create: {
              targetCountry: country,
              targetCourse: course,
              intake: intake
            },
            update: {
              targetCountry: country || undefined,
              targetCourse: course || undefined,
              intake: intake || undefined
            }
          }
        };
      }

      existingLead = await this.prisma.lead.update({
        where: { id: existingLead.id },
        data: updateData,
        include: { studentProfile: true }
      });

      // Create Submission record
      await this.prisma.leadSubmission.create({
        data: {
          leadId: existingLead.id,
          country,
          course,
          intake,
          source: existingLead.source,
          utmSource: dto.utmSource || null,
          utmMedium: dto.utmMedium || null,
          utmCampaign: dto.utmCampaign || null,
          utmContent: dto.utmContent || null,
          utmTerm: dto.utmTerm || null,
          referrer: dto.referrer || null,
          landingPage: dto.url || null,
          preferredCountry,
          preferredCourse,
          intendedIntake,
          planningTimeline,
          englishLevel,
          targetScore,
          purpose,
          courseInterest
        }
      });

      // Sync past events to WEBSITE_VISIT activities
      await this.syncPastEventsToActivities(dto.visitorId, existingLead.id);

      // Log form submission activity
      await this.prisma.activity.create({
        data: {
          leadId: existingLead.id,
          type: 'FORM_SUBMITTED',
          description: `Form submitted on page: ${dto.url}`,
          meta: {
            sessionId: dto.sessionId,
            formFields: dto.formFields,
            referrer: dto.referrer || null,
            utmSource: dto.utmSource || null,
            utmMedium: dto.utmMedium || null,
            utmCampaign: dto.utmCampaign || null
          }
        }
      });

      await this.prisma.activity.create({
        data: {
          leadId: existingLead.id,
          type: 'INGRESS_MATCH',
          description: 'Duplicate enquiry received',
          meta: { sessionId: dto.sessionId }
        }
      });

      return { lead: existingLead, created: false };
    }

    // 5. Query tracking source to map source type
    const trackingSource = await this.prisma.trackingSource.findFirst({
      where: { sessionId: dto.sessionId }
    });

    let sourceVal: LeadSource = LeadSource.WEBSITE_SDK;
    if (trackingSource) {
      if (trackingSource.source === 'Facebook') {
        sourceVal = LeadSource.FACEBOOK_ADS;
      }
    }

    const leadNumber = await this.generateNextLeadNumber();

    const newLead = await this.prisma.lead.create({
      data: {
        tenantId,
        firstName,
        lastName,
        email: email || null,
        normalizedEmail: normEmail,
        phone: phone || null,
        normalizedPhone: normPhone,
        leadNumber,
        visitorId: dto.visitorId,
        source: sourceVal,
        status: 'NEW_LEAD',
        submissionCount: 1,
        leadCategory: category,
        preferredCountry,
        preferredCourse,
        planningTimeline,
        intendedIntake,
        englishLevel,
        targetScore,
        purpose,
        courseInterest,
        studentProfile: {
          create: {
            targetCountry: preferredCountry || country || null,
            targetCourse: preferredCourse || course || null,
            intake: intendedIntake || intake || null
          }
        },
        submissions: {
          create: {
            country,
            course,
            intake,
            source: sourceVal,
            utmSource: dto.utmSource || null,
            utmMedium: dto.utmMedium || null,
            utmCampaign: dto.utmCampaign || null,
            utmContent: dto.utmContent || null,
            utmTerm: dto.utmTerm || null,
            referrer: dto.referrer || null,
            landingPage: dto.url || null,
            preferredCountry,
            preferredCourse,
            intendedIntake,
            planningTimeline,
            englishLevel,
            targetScore,
            purpose,
            courseInterest
          }
        }
      },
      include: {
        studentProfile: true
      }
    });

    // Generate dynamic documents checklist automatically based on leadCategory
    await this.documentService.generateChecklist(newLead.id, newLead.leadCategory);

    // Sync past events to WEBSITE_VISIT activities
    await this.syncPastEventsToActivities(dto.visitorId, newLead.id);

    // Log form submission activity
    await this.prisma.activity.create({
      data: {
        leadId: newLead.id,
        type: 'FORM_SUBMITTED',
        description: `Form submitted on page: ${dto.url}`,
        meta: {
          sessionId: dto.sessionId,
          formFields: dto.formFields,
          referrer: dto.referrer || null,
          utmSource: dto.utmSource || null,
          utmMedium: dto.utmMedium || null,
          utmCampaign: dto.utmCampaign || null
        }
      }
    });

    // Log lead created activity
    await this.prisma.activity.create({
      data: {
        leadId: newLead.id,
        type: 'LEAD_CREATED',
        description: `Lead auto-captured from website form on ${dto.url}. Source Attribution: ${trackingSource?.source || 'Direct'}.`,
        meta: { sessionId: dto.sessionId }
      }
    });

    // Find and assign active brochure if matches category
    const brochure = await this.prisma.brochure.findFirst({
      where: { category: newLead.leadCategory, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    let brochureLinkToken = '';
    if (brochure) {
      const token = crypto.randomBytes(24).toString('hex');
      await this.prisma.brochureAssignment.create({
        data: {
          leadId: newLead.id,
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
          leadId: newLead.id,
          type: 'BROCHURE_SENT',
          description: `Brochure "${brochure.title}" was sent to the lead.`,
          meta: { brochureId: brochure.id, brochureTitle: brochure.title, token },
        },
      });
      const appUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://crm.studymetrojaipur.com';
      console.log(`[BROCHURE GENERATION] Assigned brochure "${brochure.title}" to lead ${newLead.id}. Unique link: ${appUrl}/brochure/view/${token}`);
      brochureLinkToken = token;
    }

    // Enqueue welcome_brochure communication
    await this.communicationService.enqueue(
      newLead.id,
      CommunicationChannel.EMAIL,
      'WELCOME_BROCHURE',
      { brochureLink: brochureLinkToken || '' },
      'TrackerService'
    );

    return { lead: newLead, created: true };
  }

  async identifyVisitor(dto: IdentifyVisitorDto, tenantId: string) {
    const normEmail = dto.email.trim().toLowerCase().split('+')[0] + (dto.email.includes('@') ? '@' + dto.email.split('@')[1] : '');

    // Find matching lead to establish attribution mapping
    const lead = await this.prisma.lead.findFirst({
      where: { tenantId, normalizedEmail: normEmail, deletedAt: null }
    });

    if (lead) {
      if (lead.visitorId !== dto.visitorId) {
        await this.prisma.lead.update({
          where: { id: lead.id },
          data: { visitorId: dto.visitorId }
        });
      }

      await this.prisma.activity.create({
        data: {
          leadId: lead.id,
          type: 'VISITOR_IDENTIFIED',
          description: `Visitor identified as ${dto.email}. Traits: ${JSON.stringify(dto.traits)}`
        }
      });

      // Sync past events to WEBSITE_VISIT activities
      await this.syncPastEventsToActivities(dto.visitorId, lead.id);
    }

    return { success: true };
  }
}
