import { Module } from '@nestjs/common';
import { BrochureController } from './brochure.controller';
import { BrochureService } from './brochure.service';
import { LocalStorageProvider } from '../../common/storage/local-storage.provider';

@Module({
  controllers: [BrochureController],
  providers: [BrochureService, LocalStorageProvider],
  exports: [BrochureService],
})
export class BrochureModule {}
