import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackEventDto, TrackFormDto, IdentifyVisitorDto } from './dto/tracker.dto';
import { LeadSource } from '@prisma/client';

@Injectable()
export class TrackerService {
  constructor(private readonly prisma: PrismaService) {}

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
      } else if (ref && ref.indexOf('studymetro.com') === -1 && ref.indexOf('localhost') === -1) {
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
    return this.prisma.visitorEvent.create({
      data: {
        sessionId: dto.sessionId,
        type: dto.type,
        meta: dto.meta || {}
      }
    });
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
          landingPage: dto.url
        }
      });
    }

    // 3. Log Event
    await this.prisma.visitorEvent.create({
      data: {
        sessionId: dto.sessionId,
        type: 'FORM_SUBMIT',
        meta: {
          url: dto.url,
          formFields: dto.formFields
        }
      }
    });

    // 4. Extract fields & check duplicate
    const email = dto.formFields.email;
    const phone = dto.formFields.phone;
    
    let normEmail = null;
    if (email) {
      normEmail = email.trim().toLowerCase().split('+')[0] + (email.includes('@') ? '@' + email.split('@')[1] : '');
    }
    
    let normPhone = null;
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      normPhone = digits ? `+${digits}` : null;
    }

    let existingLead = null;
    if (normEmail || normPhone) {
      existingLead = await this.prisma.lead.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            normEmail ? { normalizedEmail: normEmail } : undefined,
            normPhone ? { normalizedPhone: normPhone } : undefined
          ].filter(Boolean) as any
        }
      });
    }

    if (existingLead) {
      // Prevent duplicates: link current visitor, and create match activity log
      if (!existingLead.visitorId) {
        await this.prisma.lead.update({
          where: { id: existingLead.id },
          data: { visitorId: dto.visitorId }
        });
      }

      await this.prisma.activity.create({
        data: {
          leadId: existingLead.id,
          type: 'INGRESS_MATCH',
          description: `Form submitted on page ${dto.url}. Lead duplicate matched.`,
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

    // Split name
    const fullName = dto.formFields.name || 'Anonymous Visitor';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const newLead = await this.prisma.lead.create({
      data: {
        tenantId,
        firstName,
        lastName,
        email: email || null,
        normalizedEmail: normEmail,
        phone: phone || null,
        normalizedPhone: normPhone,
        visitorId: dto.visitorId,
        source: sourceVal,
        status: 'NEW',
        studentProfile: {
          create: {}
        }
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId: newLead.id,
        type: 'LEAD_CREATED',
        description: `Lead auto-captured from website form on ${dto.url}. Source Attribution: ${trackingSource?.source || 'Direct'}.`,
        meta: { sessionId: dto.sessionId }
      }
    });

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
    }

    return { success: true };
  }
}
