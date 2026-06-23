import { Module } from '@nestjs/common';
import { FollowupService } from './followup.service';
import { FollowupController } from './followup.controller';
import { FollowupReminderService } from './followup-reminder.service';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [CommunicationModule],
  controllers: [FollowupController],
  providers: [FollowupService, FollowupReminderService],
  exports: [FollowupService],
})
export class FollowupModule {}
