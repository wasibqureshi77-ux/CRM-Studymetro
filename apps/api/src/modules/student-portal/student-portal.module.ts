import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommunicationModule } from '../communication/communication.module';
import { DocumentModule } from '../document/document.module';
import { StudentAuthController } from './student-auth.controller';
import { StudentDashboardController } from './student-dashboard.controller';
import { StudentPortalController } from './student-portal.controller';
import { StudentJwtStrategy } from './strategies/student-jwt.strategy';
import { StudentJwtAuthGuard } from './guards/student-jwt.guard';

@Module({
  imports: [
    PrismaModule,
    CommunicationModule,
    DocumentModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'study-metro-very-secure-jwt-key-2026-sprint1',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [StudentAuthController, StudentDashboardController, StudentPortalController],
  providers: [StudentJwtStrategy, StudentJwtAuthGuard],
  exports: [StudentJwtAuthGuard, StudentJwtStrategy],
})
export class StudentPortalModule {}
