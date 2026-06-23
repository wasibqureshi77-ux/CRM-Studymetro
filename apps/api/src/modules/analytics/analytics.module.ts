import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ExportService } from './export.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ExportService],
  exports: [AnalyticsService, ExportService],
})
export class AnalyticsModule {}
