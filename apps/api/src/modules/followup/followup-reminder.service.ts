import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { FollowupStatus, Role } from '@prisma/client';

@Injectable()
export class FollowupReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowupReminderService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService
  ) {}

  onModuleInit() {
    this.logger.log('Followup Reminder Service initialized. Starting task check interval (every minute).');
    // Run initial check after 5 seconds, then every 60 seconds
    setTimeout(() => {
      this.checkReminders().catch(err => this.logger.error('Error in initial reminder check', err));
    }, 5000);
    this.timer = setInterval(() => {
      this.checkReminders().catch(err => this.logger.error('Error in cron reminder check', err));
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async checkReminders() {
    const now = new Date();
    
    // Find all scheduled followups where the time has arrived or passed
    const followups = await this.prisma.followup.findMany({
      where: {
        status: FollowupStatus.SCHEDULED,
        followupDate: {
          lte: now
        }
      },
      include: {
        lead: true,
        assignedUser: true
      }
    });

    if (followups.length === 0) {
      return;
    }

    for (const followup of followups) {
      const isOverdueByOneHour = now.getTime() - followup.followupDate.getTime() > 60 * 60 * 1000;

      if (isOverdueByOneHour) {
        // MARK AS MISSED
        await this.prisma.followup.update({
          where: { id: followup.id },
          data: { status: FollowupStatus.MISSED }
        });

        // Log to Activity Timeline
        await this.prisma.activity.create({
          data: {
            leadId: followup.leadId,
            type: 'FOLLOWUP_MISSED',
            description: `Followup scheduled for ${followup.followupDate.toISOString()} was missed.`,
            meta: { followupId: followup.id }
          }
        });

        // Notify Assignee
        await this.notificationService.create(
          followup.assignedUserId,
          'Followup Missed',
          `You missed a scheduled followup for lead ${followup.lead.firstName || ''} ${followup.lead.lastName || ''} (scheduled at ${followup.followupDate.toLocaleString()}).`
        );

        // Notify Branch Managers
        if (followup.lead.branchId) {
          const branchManagers = await this.prisma.user.findMany({
            where: {
              branchId: followup.lead.branchId,
              role: Role.BRANCH_MANAGER,
              isActive: true
            }
          });

          for (const manager of branchManagers) {
            await this.notificationService.create(
              manager.id,
              `Missed Followup - Agent: ${followup.assignedUser.firstName || ''}`,
              `Agent ${followup.assignedUser.firstName || ''} ${followup.assignedUser.lastName || ''} missed a scheduled followup for lead ${followup.lead.firstName || ''} ${followup.lead.lastName || ''} under your branch.`
            );
          }
        }
      } else {
        // SEND DUE ALERTS (if not sent already)
        const activities = await this.prisma.activity.findMany({
          where: {
            leadId: followup.leadId,
            type: 'FOLLOWUP_REMINDER_SENT'
          }
        });

        const alreadyAlerted = activities.some(act => {
          const meta = act.meta as Record<string, any>;
          return meta && meta.followupId === followup.id;
        });

        if (!alreadyAlerted) {
          // Send alert notification
          await this.notificationService.create(
            followup.assignedUserId,
            'Followup Reminder',
            `You have a scheduled followup for lead ${followup.lead.firstName || ''} ${followup.lead.lastName || ''} now.`
          );

          // Log reminder event to timeline so we don't repeat it
          await this.prisma.activity.create({
            data: {
              leadId: followup.leadId,
              type: 'FOLLOWUP_REMINDER_SENT',
              description: `Followup reminder notification dispatched to agent.`,
              meta: { followupId: followup.id }
            }
          });
        }
      }
    }
  }
}
