import { Module } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';
import { EmailService } from './email.service';

@Module({
  controllers: [CommunicationController],
  providers: [CommunicationService, EmailService],
  exports: [CommunicationService, EmailService],
})
export class CommunicationModule {}
