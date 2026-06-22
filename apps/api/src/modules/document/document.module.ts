import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { LeadDocumentService } from './lead-document.service';
import { LocalStorageProvider } from '../../common/storage/local-storage.provider';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [DocumentController],
  providers: [LeadDocumentService, LocalStorageProvider],
  exports: [LeadDocumentService, LocalStorageProvider],
})
export class DocumentModule {}
