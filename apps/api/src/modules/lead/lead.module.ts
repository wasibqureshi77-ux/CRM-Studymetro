import { Module } from '@nestjs/common';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { DocumentModule } from '../document/document.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [DocumentModule, CommunicationModule],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService]
})
export class LeadModule {}
