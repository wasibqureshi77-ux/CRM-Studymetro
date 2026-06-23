import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto, UpdateApplicationStatusDto } from './dto/application.dto';
import { ApplicationStatus, OfferStatus, VisaStatus, LeadStatus, CommunicationChannel } from '@prisma/client';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService
  ) {}

  async create(dto: CreateApplicationDto, tenantId: string, actorId: string) {
    // 1. Verify Lead exists under Tenant and category is STUDY_ABROAD
    const lead = await this.prisma.lead.findFirst({
      where: { id: dto.leadId, tenantId, deletedAt: null }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found under tenant');
    }

    if (lead.leadCategory !== 'STUDY_ABROAD') {
      throw new BadRequestException('University applications can only be created for Study Abroad leads');
    }

    // 2. Create Application
    const application = await this.prisma.application.create({
      data: {
        leadId: dto.leadId,
        universityName: dto.universityName,
        country: dto.country,
        courseName: dto.courseName,
        intake: dto.intake,
        notes: dto.notes,
        applicationStatus: ApplicationStatus.SHORTLISTED,
        offerStatus: OfferStatus.NONE,
        visaStatus: VisaStatus.NOT_STARTED
      }
    });

    // 3. Log to Activity Timeline
    await this.prisma.activity.create({
      data: {
        leadId: dto.leadId,
        actorId,
        type: 'UNIVERSITY_ADDED',
        description: `University shortlisted: ${dto.universityName} (${dto.country}) for course ${dto.courseName}`,
        meta: { applicationId: application.id, universityName: dto.universityName }
      }
    });

    return application;
  }

  async update(id: string, dto: UpdateApplicationStatusDto, tenantId: string, actorId: string) {
    const application = await this.prisma.application.findFirst({
      where: {
        id,
        lead: { tenantId, deletedAt: null }
      },
      include: { lead: true }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // 1. Validate Application Status progression (cannot skip stages)
    if (dto.applicationStatus && dto.applicationStatus !== application.applicationStatus) {
      const appOrder = [
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.APPLICATION_STARTED,
        ApplicationStatus.APPLICATION_SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.DECISION_RECEIVED
      ];
      const currentIdx = appOrder.indexOf(application.applicationStatus);
      const newIdx = appOrder.indexOf(dto.applicationStatus);
      if (newIdx !== currentIdx + 1) {
        throw new BadRequestException(`Cannot skip application stages. Next stage must be ${appOrder[currentIdx + 1]}`);
      }
    }

    // 2. Validate Offer Status progression
    if (dto.offerStatus && dto.offerStatus !== application.offerStatus) {
      const from = application.offerStatus as any;
      const to = dto.offerStatus as any;
      if (from === OfferStatus.NONE && ![OfferStatus.CONDITIONAL_OFFER, OfferStatus.UNCONDITIONAL_OFFER, OfferStatus.OFFER_REJECTED].includes(to)) {
        throw new BadRequestException(`Invalid offer status transition from NONE to ${to}`);
      }
      if (from === OfferStatus.CONDITIONAL_OFFER && ![OfferStatus.UNCONDITIONAL_OFFER, OfferStatus.OFFER_ACCEPTED, OfferStatus.OFFER_REJECTED].includes(to)) {
        throw new BadRequestException(`Invalid offer status transition from CONDITIONAL_OFFER to ${to}`);
      }
      if (from === OfferStatus.UNCONDITIONAL_OFFER && ![OfferStatus.OFFER_ACCEPTED, OfferStatus.OFFER_REJECTED].includes(to)) {
        throw new BadRequestException(`Invalid offer status transition from UNCONDITIONAL_OFFER to ${to}`);
      }
      if ([OfferStatus.OFFER_ACCEPTED, OfferStatus.OFFER_REJECTED].includes(from)) {
        throw new BadRequestException(`Offer status is already in terminal state: ${from}`);
      }
    }

    // 3. Validate Visa Status progression
    if (dto.visaStatus && dto.visaStatus !== application.visaStatus) {
      const from = application.visaStatus as any;
      const to = dto.visaStatus as any;
      if (from === VisaStatus.NOT_STARTED && to !== VisaStatus.VISA_APPLIED) {
        throw new BadRequestException(`Visa status must go from NOT_STARTED to VISA_APPLIED`);
      }
      if (from === VisaStatus.VISA_APPLIED && to !== VisaStatus.VISA_BIOMETRICS) {
        throw new BadRequestException(`Visa status must go from VISA_APPLIED to VISA_BIOMETRICS`);
      }
      if (from === VisaStatus.VISA_BIOMETRICS && ![VisaStatus.VISA_APPROVED, VisaStatus.VISA_REJECTED].includes(to)) {
        throw new BadRequestException(`Visa status must go from VISA_BIOMETRICS to VISA_APPROVED or VISA_REJECTED`);
      }
      if ([VisaStatus.VISA_APPROVED, VisaStatus.VISA_REJECTED].includes(from)) {
        throw new BadRequestException(`Visa status is already in terminal state: ${from}`);
      }
    }

    // 4. Update dates automatically
    const appDate = dto.applicationStatus === ApplicationStatus.APPLICATION_SUBMITTED ? new Date() : undefined;
    const offerDate = (dto.offerStatus === OfferStatus.CONDITIONAL_OFFER || dto.offerStatus === OfferStatus.UNCONDITIONAL_OFFER) ? new Date() : undefined;
    const visaDate = dto.visaStatus === VisaStatus.VISA_APPLIED ? new Date() : undefined;

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        applicationStatus: dto.applicationStatus,
        offerStatus: dto.offerStatus,
        visaStatus: dto.visaStatus,
        tuitionFee: dto.tuitionFee,
        scholarshipAmount: dto.scholarshipAmount,
        notes: dto.notes,
        applicationDate: appDate || undefined,
        offerDate: offerDate || undefined,
        visaDate: visaDate || undefined
      }
    });

    // 5. Generate timeline integration events based on transitions
    if (dto.applicationStatus && dto.applicationStatus !== application.applicationStatus) {
      if (dto.applicationStatus === ApplicationStatus.APPLICATION_STARTED) {
        await this.prisma.activity.create({
          data: {
            leadId: application.leadId,
            actorId,
            type: 'APPLICATION_STARTED',
            description: `Application process started for ${application.universityName}`,
            meta: { applicationId: id }
          }
        });
      } else if (dto.applicationStatus === ApplicationStatus.APPLICATION_SUBMITTED) {
        await this.prisma.activity.create({
          data: {
            leadId: application.leadId,
            actorId,
            type: 'APPLICATION_SUBMITTED',
            description: `Application submitted to ${application.universityName}`,
            meta: { applicationId: id }
          }
        });

        // Enqueue Application Submitted communication
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.EMAIL, 'APPLICATION_SUBMITTED', {});
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.WHATSAPP, 'APPLICATION_SUBMITTED', {});
      }
    }

    if (dto.offerStatus && dto.offerStatus !== application.offerStatus) {
      if ([OfferStatus.CONDITIONAL_OFFER, OfferStatus.UNCONDITIONAL_OFFER].includes(dto.offerStatus as any)) {
        await this.prisma.activity.create({
          data: {
            leadId: application.leadId,
            actorId,
            type: 'OFFER_RECEIVED',
            description: `Offer received (${dto.offerStatus}) from ${application.universityName}`,
            meta: { applicationId: id, offerType: dto.offerStatus }
          }
        });

        // Enqueue Offer Received communication
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.EMAIL, 'OFFER_RECEIVED', {});
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.WHATSAPP, 'OFFER_RECEIVED', {});
      } else if (dto.offerStatus === OfferStatus.OFFER_ACCEPTED) {
        await this.prisma.activity.create({
          data: {
            leadId: application.leadId,
            actorId,
            type: 'OFFER_ACCEPTED',
            description: `Offer ACCEPTED from ${application.universityName}`,
            meta: { applicationId: id }
          }
        });

        // Enqueue Offer Accepted communication
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.EMAIL, 'OFFER_ACCEPTED', {});
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.WHATSAPP, 'OFFER_ACCEPTED', {});
      }
    }

    if (dto.visaStatus && dto.visaStatus !== application.visaStatus) {
      if (dto.visaStatus === VisaStatus.VISA_APPLIED) {
        await this.prisma.activity.create({
          data: {
            leadId: application.leadId,
            actorId,
            type: 'VISA_APPLIED',
            description: `Visa application applied for study at ${application.universityName}`,
            meta: { applicationId: id }
          }
        });

        // Enqueue Visa Applied communication
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.EMAIL, 'VISA_APPLIED', {});
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.WHATSAPP, 'VISA_APPLIED', {});
      } else if (dto.visaStatus === VisaStatus.VISA_APPROVED) {
        await this.prisma.activity.create({
          data: {
            leadId: application.leadId,
            actorId,
            type: 'VISA_APPROVED',
            description: `Visa APPROVED for ${application.universityName}`,
            meta: { applicationId: id }
          }
        });

        // Auto transition Lead status to ADMISSION_CLOSED (or ENROLLED for other categories) and log enrollment completion
        const targetStatus = application.lead.leadCategory === 'STUDY_ABROAD' ? LeadStatus.ADMISSION_CLOSED : LeadStatus.ENROLLED;
        await this.prisma.lead.update({
          where: { id: application.leadId },
          data: { status: targetStatus }
        });

        await this.prisma.activity.create({
          data: {
            leadId: application.leadId,
            actorId,
            type: 'ENROLLMENT_COMPLETED',
            description: `Enrollment completed at ${application.universityName}!`,
            meta: { applicationId: id, universityName: application.universityName }
          }
        });

        // Enqueue Visa Approved & Enrollment Complete communications
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.EMAIL, 'VISA_APPROVED', {});
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.WHATSAPP, 'VISA_APPROVED', {});
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.EMAIL, 'ENROLLMENT_COMPLETE', {});
        await this.communicationService.enqueue(application.leadId, CommunicationChannel.WHATSAPP, 'ENROLLMENT_COMPLETE', {});
      }
    }

    return updated;
  }

  async findByLead(leadId: string, tenantId: string) {
    return this.prisma.application.findMany({
      where: {
        leadId,
        lead: { tenantId, deletedAt: null }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getDashboardWidgets(tenantId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, leadCategory: 'STUDY_ABROAD', deletedAt: null },
      include: { applications: true }
    });

    let applicationsInProgress = 0;
    let offersReceived = 0;
    let offerAccepted = 0;
    let visaApplied = 0;
    let visaApproved = 0;
    let studentsEnrolled = 0;

    for (const lead of leads) {
      if (lead.applications.length > 0) {
        // Use application-based status
        for (const app of lead.applications) {
          // Applications In Progress
          if (app.applicationStatus !== ApplicationStatus.SHORTLISTED && app.applicationStatus !== ApplicationStatus.DECISION_RECEIVED) {
            applicationsInProgress++;
          }
          // Offers Received
          if (app.offerStatus === OfferStatus.CONDITIONAL_OFFER || app.offerStatus === OfferStatus.UNCONDITIONAL_OFFER) {
            offersReceived++;
          }
          // Offers Accepted
          if (app.offerStatus === OfferStatus.OFFER_ACCEPTED && app.visaStatus === VisaStatus.NOT_STARTED) {
            offerAccepted++;
          }
          // Visa Applied
          if (app.visaStatus === VisaStatus.VISA_APPLIED || app.visaStatus === VisaStatus.VISA_BIOMETRICS) {
            visaApplied++;
          }
          // Visa Approved
          if (app.visaStatus === VisaStatus.VISA_APPROVED && lead.status !== LeadStatus.ENROLLED && lead.status !== LeadStatus.ADMISSION_CLOSED) {
            visaApproved++;
          }
        }
      } else {
        // Fall back to Lead status
        if (lead.status === LeadStatus.UNIVERSITY_APPLIED) {
          applicationsInProgress++;
        } else if (lead.status === LeadStatus.OFFER_LETTER) {
          offersReceived++;
        } else if (lead.status === LeadStatus.VISA_PROCESS) {
          visaApplied++;
        }
      }

      // Count Enrolled
      if (lead.status === LeadStatus.ENROLLED || lead.status === LeadStatus.ADMISSION_CLOSED) {
        studentsEnrolled++;
      }
    }

    return {
      applicationsInProgress,
      offersReceived,
      offerAccepted,
      visaApplied,
      visaApproved,
      studentsEnrolled
    };
  }

  async getReports(tenantId: string) {
    const apps = await this.prisma.application.findMany({
      where: { lead: { tenantId, deletedAt: null } }
    });

    // 1. Applications by Country
    const countryMap: Record<string, number> = {};
    apps.forEach(a => {
      countryMap[a.country] = (countryMap[a.country] || 0) + 1;
    });
    const byCountry = Object.entries(countryMap).map(([name, count]) => ({ name, count }));

    // 2. Applications by Intake
    const intakeMap: Record<string, number> = {};
    apps.forEach(a => {
      intakeMap[a.intake] = (intakeMap[a.intake] || 0) + 1;
    });
    const byIntake = Object.entries(intakeMap).map(([name, count]) => ({ name, count }));

    // 3. Offer Conversion Rate (accepted offers / total offers received)
    const totalOffers = apps.filter(a => ([OfferStatus.CONDITIONAL_OFFER, OfferStatus.UNCONDITIONAL_OFFER, OfferStatus.OFFER_ACCEPTED, OfferStatus.OFFER_REJECTED] as any[]).includes(a.offerStatus) && a.offerStatus !== OfferStatus.NONE).length;
    const acceptedOffers = apps.filter(a => a.offerStatus === OfferStatus.OFFER_ACCEPTED).length;
    const offerConversionRate = totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;

    // 4. Visa Approval Rate (approved visas / total visa decisions)
    const visaDecisions = apps.filter(a => ([VisaStatus.VISA_APPROVED, VisaStatus.VISA_REJECTED] as any[]).includes(a.visaStatus)).length;
    const approvedVisas = apps.filter(a => a.visaStatus === VisaStatus.VISA_APPROVED).length;
    const visaApprovalRate = visaDecisions > 0 ? Math.round((approvedVisas / visaDecisions) * 100) : 0;

    // 5. Top Universities
    const uniMap: Record<string, number> = {};
    apps.forEach(a => {
      uniMap[a.universityName] = (uniMap[a.universityName] || 0) + 1;
    });
    const topUniversities = Object.entries(uniMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      byCountry,
      byIntake,
      offerConversionRate,
      visaApprovalRate,
      topUniversities
    };
  }
}
