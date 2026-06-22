import { Module } from '@nestjs/common';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [DocumentModule],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService]
})
export class LeadModule {}
