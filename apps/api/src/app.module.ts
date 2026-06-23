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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply Tenant resolution middleware globally to all routes
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
