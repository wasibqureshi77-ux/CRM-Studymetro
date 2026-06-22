import { Module } from '@nestjs/common';
import { TrackerController } from './tracker.controller';
import { TrackerService } from './tracker.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [PrismaModule, DocumentModule],
  controllers: [TrackerController],
  providers: [TrackerService],
  exports: [TrackerService]
})
export class TrackerModule {}
