import { Controller, Get, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentJwtAuthGuard } from './guards/student-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(StudentJwtAuthGuard)
@Roles('STUDENT')
@Controller('api/v1/student-portal/dashboard')
export class StudentDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getDashboardData(@Req() req: any) {
    const studentId = req.user.id;

    // Fetch the lead details with student profile and documents
    const student = await this.prisma.lead.findUnique({
      where: { id: studentId },
      include: {
        studentProfile: true,
        documents: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // 1. Upcoming Followup
    const upcomingFollowup = await this.prisma.followup.findFirst({
      where: {
        leadId: studentId,
        status: 'SCHEDULED',
        followupDate: { gte: new Date() },
      },
      orderBy: { followupDate: 'asc' },
    });

    // 2. Pending Documents (missing or rejected)
    const pendingDocuments = student.documents.filter(
      (doc) => doc.status === 'PENDING' || doc.status === 'REJECTED'
    );

    // 3. Latest Timeline / Activities
    const timeline = await this.prisma.activity.findMany({
      where: { leadId: studentId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 4. Resolve notifications dynamically from activities and followups
    // Map events like document status changes, brochure shares, offer/visa status changes to alerts
    const notifications = [];

    // Let's check student profile country/course
    const country = student.studentProfile?.targetCountry || student.preferredCountry || 'TBD';
    const course = student.studentProfile?.targetCourse || student.preferredCourse || 'TBD';

    // Add alerts based on status & timeline
    for (const act of timeline) {
      if (act.type.includes('DOCUMENT') && act.description.includes('REJECTED')) {
        notifications.push({
          id: `notif-doc-${act.id}`,
          title: 'Document Rejected',
          message: act.description,
          createdAt: act.createdAt,
          type: 'error',
        });
      }
      if (act.type.includes('OFFER') || act.description.toLowerCase().includes('offer')) {
        notifications.push({
          id: `notif-offer-${act.id}`,
          title: 'Offer Letter Update',
          message: act.description,
          createdAt: act.createdAt,
          type: 'info',
        });
      }
      if (act.type.includes('VISA') || act.description.toLowerCase().includes('visa')) {
        notifications.push({
          id: `notif-visa-${act.id}`,
          title: 'Visa Application Update',
          message: act.description,
          createdAt: act.createdAt,
          type: 'success',
        });
      }
      if (act.type.includes('BROCHURE') || act.description.toLowerCase().includes('brochure')) {
        notifications.push({
          id: `notif-brochure-${act.id}`,
          title: 'Brochure Shared',
          message: act.description,
          createdAt: act.createdAt,
          type: 'info',
        });
      }
    }

    if (upcomingFollowup) {
      notifications.push({
        id: `notif-followup-${upcomingFollowup.id}`,
        title: 'Meeting / Followup Scheduled',
        message: `You have an upcoming discussion on ${new Date(upcomingFollowup.followupDate).toLocaleDateString()} at ${new Date(upcomingFollowup.followupDate).toLocaleTimeString()}: ${upcomingFollowup.notes || ''}`,
        createdAt: upcomingFollowup.createdAt,
        type: 'warning',
      });
    }

    return {
      student: {
        id: student.id,
        portalId: student.studentPortalId,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        email: student.email,
        phone: student.phone,
        address: student.address,
        country,
        course,
        currentStage: student.status,
      },
      upcomingFollowup: upcomingFollowup ? {
        id: upcomingFollowup.id,
        date: upcomingFollowup.followupDate,
        notes: upcomingFollowup.notes,
        status: upcomingFollowup.status,
      } : null,
      pendingDocuments: pendingDocuments.map(d => ({
        id: d.id,
        documentType: d.documentType,
        status: d.status,
        isRequired: d.isRequired,
        verificationNote: d.verificationNote,
      })),
      notifications: notifications.slice(0, 5), // return top 5
      timeline: timeline.map(t => ({
        id: t.id,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }
}
