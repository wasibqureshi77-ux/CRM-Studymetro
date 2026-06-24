import { Module } from '@nestjs/common';
import { BrochureController, PublicBrochureController } from './brochure.controller';
import { BrochureService } from './brochure.service';
import { LocalStorageProvider } from '../../common/storage/local-storage.provider';

@Module({
  controllers: [BrochureController, PublicBrochureController],
  providers: [BrochureService, LocalStorageProvider],
  exports: [BrochureService],
})
export class BrochureModule {}
