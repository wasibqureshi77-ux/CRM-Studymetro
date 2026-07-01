import { Module } from '@nestjs/common';
import { WhatsappController } from './controllers/whatsapp.controller';
import { WhatsappService } from './services/whatsapp.service';
import { WhatsappGatewayService } from './gateway/whatsapp.gateway';
import { WhatsappQueueService } from './queue/whatsapp.queue';
import { WhatsappWebSocketGateway } from './websocket/whatsapp.websocket';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsappGatewayService,
    WhatsappQueueService,
    WhatsappWebSocketGateway,
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}
