import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { LeadModule } from './modules/lead/lead.module';
import { FollowupModule } from './modules/followup/followup.module';
import { DocumentModule } from './modules/document/document.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TrackerModule } from './modules/tracker/tracker.module';
import { ApplicationModule } from './modules/application/application.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { BrochureModule } from './modules/brochure/brochure.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { StudentPortalModule } from './modules/student-portal/student-portal.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    LeadModule,
    FollowupModule,
    DocumentModule,
    NotificationModule,
    TrackerModule,
    ApplicationModule,
    CommunicationModule,
    BrochureModule,
    AnalyticsModule,
    StudentPortalModule,
    WhatsappModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply Tenant resolution globally to all routes
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
