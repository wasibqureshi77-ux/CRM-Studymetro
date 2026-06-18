import { Controller, Get, Post, Body, Req, Header } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { TrackEventDto, TrackFormDto, IdentifyVisitorDto } from './dto/tracker.dto';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { METRO_TRACKER_SDK } from './metro-tracker';

@Controller()
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  @Get('sdk/metro-tracker.js')
  @Header('Content-Type', 'application/javascript')
  @Header('Access-Control-Allow-Origin', '*')
  getTrackerSdk() {
    return METRO_TRACKER_SDK;
  }

  @Post('api/v1/tracker/event')
  async trackEvent(@Req() req: AuthenticatedRequest, @Body() dto: TrackEventDto) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.trackerService.trackEvent(dto, tenantId);
  }

  @Post('api/v1/tracker/form')
  async trackForm(@Req() req: AuthenticatedRequest, @Body() dto: TrackFormDto) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.trackerService.trackForm(dto, tenantId);
  }

  @Post('api/v1/tracker/identify')
  async identify(@Req() req: AuthenticatedRequest, @Body() dto: IdentifyVisitorDto) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.trackerService.identifyVisitor(dto, tenantId);
  }
}
