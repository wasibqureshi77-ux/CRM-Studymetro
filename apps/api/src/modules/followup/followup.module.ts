import { Module } from '@nestjs/common';
import { FollowupService } from './followup.service';
import { FollowupController } from './followup.controller';
import { FollowupReminderService } from './followup-reminder.service';

@Module({
  controllers: [FollowupController],
  providers: [FollowupService, FollowupReminderService],
  exports: [FollowupService],
})
export class FollowupModule {}
