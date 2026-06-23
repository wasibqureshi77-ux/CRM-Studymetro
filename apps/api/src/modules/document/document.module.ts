import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { LeadDocumentService } from './lead-document.service';
import { LocalStorageProvider } from '../../common/storage/local-storage.provider';
import { NotificationModule } from '../notification/notification.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [NotificationModule, CommunicationModule],
  controllers: [DocumentController],
  providers: [LeadDocumentService, LocalStorageProvider],
  exports: [LeadDocumentService, LocalStorageProvider],
})
export class DocumentModule {}
