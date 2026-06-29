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

    // Fetch the lead details with student profile, documents, assignee, and application data
    const student = await this.prisma.lead.findUnique({
      where: { id: studentId },
      include: {
        studentProfile: true,
        documents: {
          where: { isCurrent: true },
        },
        assignee: true,
        applications: true,
        brochureAssignments: {
          include: {
            brochure: true,
            tracking: true,
          }
        }
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

    // 4. Notifications
    const dbNotifications = await this.prisma.studentNotification.findMany({
      where: { leadId: studentId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const notifications = dbNotifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      createdAt: n.createdAt,
      type: n.title.includes('Approved') ? 'success' : n.title.includes('Rejected') ? 'error' : 'info',
    }));

    // If notifications are empty, fallback to dynamic warnings as before
    if (notifications.length === 0) {
      if (upcomingFollowup) {
        notifications.push({
          id: `notif-followup-${upcomingFollowup.id}`,
          title: 'Meeting Tomorrow',
          message: `You have an upcoming discussion on ${new Date(upcomingFollowup.followupDate).toLocaleDateString()} at ${new Date(upcomingFollowup.followupDate).toLocaleTimeString()}: ${upcomingFollowup.notes || ''}`,
          createdAt: upcomingFollowup.createdAt,
          type: 'warning',
        });
      }
    }

    const country = student.studentProfile?.targetCountry || student.preferredCountry || 'TBD';
    const course = student.studentProfile?.targetCourse || student.preferredCourse || 'TBD';

    // Calculate progress
    const STAGE_PROGRESS: Record<string, number> = {
      NEW_LEAD: 10,
      CONTACTED: 20,
      COUNSELLING: 30,
      DOCUMENTS_PENDING: 40,
      DOCUMENTS_RECEIVED: 50,
      UNIVERSITY_APPLIED: 70,
      OFFER_LETTER: 85,
      VISA_PROCESS: 95,
      ADMISSION_CLOSED: 100,
      COMPLETED: 100,
    };
    const overallProgress = STAGE_PROGRESS[student.status] || 0;

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
        overallProgress,
      },
      counsellor: student.assignee ? {
        name: student.assignee.fullName || `${student.assignee.firstName || ''} ${student.assignee.lastName || ''}`.trim(),
        email: student.assignee.email,
        phone: student.assignee.phone || 'N/A',
      } : null,
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
      brochures: student.brochureAssignments.map(ba => ({
        id: ba.id,
        title: ba.brochure.title,
        token: ba.token,
        opened: ba.tracking?.opened || false,
        completionPercentage: ba.tracking?.completionPercentage || 0,
        downloadCount: ba.tracking?.downloadCount || 0,
        readingTime: ba.tracking?.readingTime || 0,
      })),
      applications: student.applications.map(app => ({
        id: app.id,
        universityName: app.universityName,
        country: app.country,
        courseName: app.courseName,
        intake: app.intake,
        applicationStatus: app.applicationStatus,
        offerStatus: app.offerStatus,
        visaStatus: app.visaStatus,
        createdAt: app.createdAt,
      })),
      notifications,
      timeline: timeline.map(t => ({
        id: t.id,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }
}
