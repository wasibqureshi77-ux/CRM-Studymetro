import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.notificationService.findAllForUser(userId);
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user!.id;
    return this.notificationService.markAsRead(id, userId);
  }
}
