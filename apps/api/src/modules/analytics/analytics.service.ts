import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadCategory, LeadStatus, FollowupStatus, DocumentStatus, QueueStatus, CommunicationChannel } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateFilter(startDate?: string, endDate?: string) {
    const filter: any = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.lte = new Date(endDate);
      }
    }
    return filter;
  }

  async getSummary(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    // Calculate dates for today's followups
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      totalLeads,
      activeLeads,
      convertedLeads,
      applications,
      visaApproved,
      documentsPending,
      followupsDueToday,
      emailsSent,
      brochuresSent,
    ] = await Promise.all([
      this.prisma.lead.count({ where: leadFilter }),
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          NOT: {
            status: { in: [LeadStatus.LOST, LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED] }
          }
        }
      }),
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          status: { in: [LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED, LeadStatus.ENROLLED] }
        }
      }),
      this.prisma.application.count({
        where: {
          lead: leadFilter
        }
      }),
      this.prisma.application.count({
        where: {
          lead: leadFilter,
          visaStatus: 'VISA_APPROVED'
        }
      }),
      this.prisma.leadDocument.count({
        where: {
          lead: leadFilter,
          status: DocumentStatus.PENDING
        }
      }),
      this.prisma.followup.count({
        where: {
          lead: leadFilter,
          status: FollowupStatus.SCHEDULED,
          followupDate: { gte: startOfToday, lte: endOfToday }
        }
      }),
      this.prisma.communicationLog.count({
        where: {
          lead: leadFilter,
          channel: CommunicationChannel.EMAIL,
          status: QueueStatus.SENT
        }
      }),
      this.prisma.brochureAssignment.count({
        where: {
          lead: leadFilter
        }
      })
    ]);

    return {
      totalLeads,
      activeLeads,
      convertedLeads,
      applications,
      visaApproved,
      documentsPending,
      followupsDueToday,
      emailsSent,
      brochuresSent
    };
  }

  async getLeadSources(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    const rawSources = await this.prisma.lead.groupBy({
      by: ['source'],
      where: leadFilter,
      _count: { id: true }
    });

    const convertedLeads = await this.prisma.lead.groupBy({
      by: ['source'],
      where: {
        ...leadFilter,
        status: { in: [LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED, LeadStatus.ENROLLED] }
      },
      _count: { id: true }
    });

    const convertedMap = new Map(convertedLeads.map(item => [item.source, item._count.id]));

    return rawSources.map(item => {
      const count = item._count.id;
      const convCount = convertedMap.get(item.source) || 0;
      return {
        source: item.source,
        count,
        conversionRate: count > 0 ? Math.round((convCount / count) * 100) : 0,
        trend: 'Stable'
      };
    });
  }

  async getCategories(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    const rawCategories = await this.prisma.lead.groupBy({
      by: ['leadCategory'],
      where: leadFilter,
      _count: { id: true }
    });

    const converted = await this.prisma.lead.groupBy({
      by: ['leadCategory'],
      where: {
        ...leadFilter,
        status: { in: [LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED, LeadStatus.ENROLLED] }
      },
      _count: { id: true }
    });

    const readyLeads = await this.prisma.lead.count({
      where: {
        ...leadFilter,
        readinessScore: { gte: 80.0 }
      }
    });

    const convertedMap = new Map(converted.map(item => [item.leadCategory, item._count.id]));

    return rawCategories.map(item => {
      const count = item._count.id;
      const convCount = convertedMap.get(item.leadCategory) || 0;
      return {
        category: item.leadCategory,
        count,
        conversionRate: count > 0 ? Math.round((convCount / count) * 100) : 0,
        revenueReadyLeads: item.leadCategory === LeadCategory.STUDY_ABROAD ? readyLeads : convCount
      };
    });
  }

  async getCountries(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    // Grouping by preferredCountry directly
    const countryData = await this.prisma.lead.groupBy({
      by: ['preferredCountry'],
      where: {
        ...leadFilter,
        leadCategory: LeadCategory.STUDY_ABROAD,
        preferredCountry: { not: null }
      },
      _count: { id: true }
    });

    const results = [];
    for (const c of countryData) {
      const country = c.preferredCountry;
      if (!country) continue;

      const [applications, offers, visas] = await Promise.all([
        this.prisma.application.count({
          where: { country, lead: leadFilter }
        }),
        this.prisma.application.count({
          where: { country, lead: leadFilter, offerStatus: { not: 'NONE' } }
        }),
        this.prisma.application.count({
          where: { country, lead: leadFilter, visaStatus: 'VISA_APPROVED' }
        })
      ]);

      results.push({
        country,
        totalInterested: c._count.id,
        applications,
        offers,
        visas
      });
    }

    return results;
  }

  async getFollowups(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [scheduled, completed, missed, overdue] = await Promise.all([
      this.prisma.followup.count({
        where: { lead: leadFilter, status: FollowupStatus.SCHEDULED }
      }),
      this.prisma.followup.count({
        where: { lead: leadFilter, status: FollowupStatus.COMPLETED }
      }),
      this.prisma.followup.count({
        where: { lead: leadFilter, status: FollowupStatus.CANCELLED }
      }),
      this.prisma.followup.count({
        where: { lead: leadFilter, status: FollowupStatus.SCHEDULED, followupDate: { lt: startOfToday } }
      })
    ]);

    return {
      scheduled,
      completed,
      missed,
      overdue
    };
  }

  async getDocuments(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    const [pending, verified, rejected, avgReadiness] = await Promise.all([
      this.prisma.leadDocument.count({
        where: { lead: leadFilter, status: DocumentStatus.PENDING }
      }),
      this.prisma.leadDocument.count({
        where: { lead: leadFilter, status: DocumentStatus.VERIFIED }
      }),
      this.prisma.leadDocument.count({
        where: { lead: leadFilter, status: DocumentStatus.REJECTED }
      }),
      this.prisma.lead.aggregate({
        where: { ...leadFilter, readinessScore: { not: null } },
        _avg: { readinessScore: true }
      })
    ]);

    return {
      pending,
      verified,
      rejected,
      avgReadinessScore: avgReadiness._avg.readinessScore ? Math.round(avgReadiness._avg.readinessScore) : 0
    };
  }

  async getCommunications(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    const [sent, failed, pending, templates] = await Promise.all([
      this.prisma.communicationLog.count({
        where: { lead: leadFilter, status: QueueStatus.SENT }
      }),
      this.prisma.communicationLog.count({
        where: { lead: leadFilter, status: QueueStatus.FAILED }
      }),
      this.prisma.communicationQueue.count({
        where: { lead: leadFilter, status: QueueStatus.PENDING }
      }),
      this.prisma.communicationLog.groupBy({
        by: ['eventType'],
        where: { lead: leadFilter },
        _count: { id: true }
      })
    ]);

    const templateUsage = templates.map(t => ({
      templateName: t.eventType,
      count: t._count.id
    }));

    return {
      sent,
      failed,
      pending,
      templateUsage
    };
  }

  async getBrochures(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    const [sent, opened, downloads, avgTimeRes, completionRes] = await Promise.all([
      this.prisma.brochureAssignment.count({
        where: { lead: leadFilter }
      }),
      this.prisma.brochureTracking.count({
        where: { assignment: { lead: leadFilter }, opened: true }
      }),
      this.prisma.brochureTracking.aggregate({
        where: { assignment: { lead: leadFilter } },
        _sum: { downloadCount: true }
      }),
      this.prisma.brochureTracking.aggregate({
        where: { assignment: { lead: leadFilter } },
        _avg: { readingTime: true }
      }),
      this.prisma.brochureTracking.aggregate({
        where: { assignment: { lead: leadFilter } },
        _avg: { completionPercentage: true }
      })
    ]);

    const labels = await this.prisma.lead.groupBy({
      by: ['engagementLabel'],
      where: leadFilter,
      _count: { id: true }
    });

    const labelMap = new Map(labels.map(l => [l.engagementLabel, l._count.id]));

    return {
      sent,
      opened,
      downloads: downloads._sum.downloadCount || 0,
      avgReadingTime: avgTimeRes._avg.readingTime ? Math.round(avgTimeRes._avg.readingTime) : 0,
      completionPercentage: completionRes._avg.completionPercentage ? Math.round(completionRes._avg.completionPercentage) : 0,
      hotLeads: labelMap.get('Hot') || 0,
      warmLeads: labelMap.get('Warm') || 0,
      coldLeads: labelMap.get('Cold') || 0,
    };
  }

  async getFunnel(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    const [
      createdCount,
      counsellingCount,
      docsCount,
      appCount,
      offerCount,
      visaCount,
      enrolledCount,
    ] = await Promise.all([
      // Stage 1: Created (All)
      this.prisma.lead.count({ where: leadFilter }),
      // Stage 2: Counselling
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          status: {
            notIn: [LeadStatus.NEW_LEAD, LeadStatus.CONTACTED]
          }
        }
      }),
      // Stage 3: Documents Received
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          status: {
            notIn: [LeadStatus.NEW_LEAD, LeadStatus.CONTACTED, LeadStatus.COUNSELLING, LeadStatus.DOCUMENTS_PENDING]
          }
        }
      }),
      // Stage 4: Application
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          applications: { some: {} }
        }
      }),
      // Stage 5: Offer Letter
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          applications: { some: { offerStatus: { not: 'NONE' } } }
        }
      }),
      // Stage 6: Visa
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          applications: { some: { visaStatus: { in: ['VISA_APPROVED', 'VISA_BIOMETRICS', 'VISA_APPLIED'] } } }
        }
      }),
      // Stage 7: Enrollment
      this.prisma.lead.count({
        where: {
          ...leadFilter,
          status: { in: [LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED, LeadStatus.ENROLLED] }
        }
      })
    ]);

    return [
      { stage: 'Lead Created', count: createdCount, pct: 100 },
      { stage: 'Counselling', count: counsellingCount, pct: createdCount > 0 ? Math.round((counsellingCount / createdCount) * 100) : 0 },
      { stage: 'Documents Complete', count: docsCount, pct: counsellingCount > 0 ? Math.round((docsCount / counsellingCount) * 100) : 0 },
      { stage: 'Application Started', count: appCount, pct: docsCount > 0 ? Math.round((appCount / docsCount) * 100) : 0 },
      { stage: 'Offer Letter Received', count: offerCount, pct: appCount > 0 ? Math.round((offerCount / appCount) * 100) : 0 },
      { stage: 'Visa Approved', count: visaCount, pct: offerCount > 0 ? Math.round((visaCount / offerCount) * 100) : 0 },
      { stage: 'Enrolled / Closed', count: enrolledCount, pct: visaCount > 0 ? Math.round((enrolledCount / visaCount) * 100) : 0 },
    ];
  }

  async getRevenue(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    // Dynamic calculations from applications
    const visaApprovedApps = await this.prisma.application.findMany({
      where: {
        lead: leadFilter,
        visaStatus: 'VISA_APPROVED',
        tuitionFee: { not: null }
      },
      select: {
        tuitionFee: true,
        scholarshipAmount: true
      }
    });

    const studyAbroadRev = visaApprovedApps.reduce((acc, curr) => {
      const fee = curr.tuitionFee || 0;
      const scholarship = curr.scholarshipAmount || 0;
      return acc + (fee - scholarship);
    }, 0);

    // Category Pricing Config (Future-Ready course fee configuration)
    const COURSE_PRICES = {
      [LeadCategory.IELTS]: 12000,
      [LeadCategory.PTE]: 10000,
      [LeadCategory.ENGLISH_SPEAKING]: 6000,
      [LeadCategory.COMPUTER_COURSE]: 15000,
      [LeadCategory.DIGITAL_MARKETING]: 20000,
      [LeadCategory.OTHER]: 8000
    };

    // Calculate enrolled training courses counts
    const enrolledLeads = await this.prisma.lead.groupBy({
      by: ['leadCategory'],
      where: {
        ...leadFilter,
        status: { in: [LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED, LeadStatus.ENROLLED] }
      },
      _count: { id: true }
    });

    let ieltsRev = 0;
    let pteRev = 0;
    let speakingRev = 0;
    let computerRev = 0;
    let marketingRev = 0;
    let otherRev = 0;

    enrolledLeads.forEach(item => {
      const count = item._count.id;
      const price = COURSE_PRICES[item.leadCategory] || 0;
      const revenue = count * price;

      if (item.leadCategory === LeadCategory.IELTS) ieltsRev = revenue;
      else if (item.leadCategory === LeadCategory.PTE) pteRev = revenue;
      else if (item.leadCategory === LeadCategory.ENGLISH_SPEAKING) speakingRev = revenue;
      else if (item.leadCategory === LeadCategory.COMPUTER_COURSE) computerRev = revenue;
      else if (item.leadCategory === LeadCategory.DIGITAL_MARKETING) marketingRev = revenue;
      else if (item.leadCategory === LeadCategory.OTHER) otherRev = revenue;
    });

    const totalRev = studyAbroadRev + ieltsRev + pteRev + speakingRev + computerRev + marketingRev + otherRev;

    return {
      totalRevenue: totalRev,
      studyAbroadRevenue: studyAbroadRev,
      ieltsRevenue: ieltsRev,
      pteRevenue: pteRev,
      computerCourseRevenue: computerRev,
      digitalMarketingRevenue: marketingRev,
      otherRevenue: otherRev,
      revenueTrend: 'Increasing'
    };
  }

  async getCounsellors(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);

    // Fetch agents & managers
    const counsellors = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['AGENT', 'BRANCH_MANAGER', 'TENANT_ADMIN'] }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      }
    });

    const performance = [];

    for (const c of counsellors) {
      const [
        assignedLeads,
        activeLeads,
        convertedLeads,
        appsSubmitted,
        offerLetters,
        visaApproved,
        followupsCompleted,
      ] = await Promise.all([
        this.prisma.lead.count({ where: { ...leadFilter, assigneeId: c.id } }),
        this.prisma.lead.count({
          where: {
            ...leadFilter,
            assigneeId: c.id,
            NOT: { status: { in: [LeadStatus.LOST, LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED] } }
          }
        }),
        this.prisma.lead.count({
          where: {
            ...leadFilter,
            assigneeId: c.id,
            status: { in: [LeadStatus.ADMISSION_CLOSED, LeadStatus.COMPLETED, LeadStatus.ENROLLED] }
          }
        }),
        this.prisma.application.count({ where: { lead: { ...leadFilter, assigneeId: c.id } } }),
        this.prisma.application.count({ where: { lead: { ...leadFilter, assigneeId: c.id }, offerStatus: { not: 'NONE' } } }),
        this.prisma.application.count({ where: { lead: { ...leadFilter, assigneeId: c.id }, visaStatus: 'VISA_APPROVED' } }),
        this.prisma.followup.count({ where: { lead: { ...leadFilter, assigneeId: c.id }, status: FollowupStatus.COMPLETED } })
      ]);

      performance.push({
        counsellorId: c.id,
        name: `${c.firstName} ${c.lastName}`,
        assignedLeads,
        activeLeads,
        convertedLeads,
        applicationsSubmitted: appsSubmitted,
        offerLetters,
        visaApproved,
        followupsCompleted,
        conversionRate: assignedLeads > 0 ? Math.round((convertedLeads / assignedLeads) * 100) : 0
      });
    }

    return performance;
  }

  async getLeadAging(startDate?: string, endDate?: string) {
    const leadFilter = this.getDateFilter(startDate, endDate);
    const leads = await this.prisma.lead.findMany({
      where: leadFilter,
      select: {
        id: true,
        createdAt: true,
        followups: {
          select: {
            status: true,
            followupDate: true
          }
        }
      }
    });

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const buckets = {
      '0-7 Days': { count: 0, pending: 0, overdue: 0 },
      '8-15 Days': { count: 0, pending: 0, overdue: 0 },
      '16-30 Days': { count: 0, pending: 0, overdue: 0 },
      '31-60 Days': { count: 0, pending: 0, overdue: 0 },
      '60+ Days': { count: 0, pending: 0, overdue: 0 }
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    leads.forEach(l => {
      const ageInDays = Math.floor((now - new Date(l.createdAt).getTime()) / oneDay);
      let bucketKey: keyof typeof buckets = '60+ Days';

      if (ageInDays <= 7) bucketKey = '0-7 Days';
      else if (ageInDays <= 15) bucketKey = '8-15 Days';
      else if (ageInDays <= 30) bucketKey = '16-30 Days';
      else if (ageInDays <= 60) bucketKey = '31-60 Days';

      buckets[bucketKey].count += 1;

      l.followups.forEach(f => {
        if (f.status === FollowupStatus.SCHEDULED) {
          buckets[bucketKey].pending += 1;
          if (new Date(f.followupDate).getTime() < startOfToday.getTime()) {
            buckets[bucketKey].overdue += 1;
          }
        }
      });
    });

    return Object.entries(buckets).map(([range, stats]) => ({
      range,
      ...stats
    }));
  }
}
