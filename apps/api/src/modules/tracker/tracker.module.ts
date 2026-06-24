import { Module } from '@nestjs/common';
import { TrackerController } from './tracker.controller';
import { TrackerService } from './tracker.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [PrismaModule, DocumentModule, CommunicationModule],
  controllers: [TrackerController],
  providers: [TrackerService],
  exports: [TrackerService]
})
export class TrackerModule {}
