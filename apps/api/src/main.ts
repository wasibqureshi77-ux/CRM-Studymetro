import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure production-safe CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://crm.studymetrojaipur.com',
    'https://api.studymetrojaipur.com',
    'https://studymetrojaipur.com',
  ];
  if (process.env.CORS_ALLOWED_ORIGINS) {
    allowedOrigins.push(...process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      const isWhitelisted = allowedOrigins.some(ao => origin === ao || origin.startsWith(ao));
      if (isWhitelisted) {
        callback(null, true);
      } else {
        // Allow other origins to support Tracker SDK form and event submissions from external domains
        callback(null, true);
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Tenant-ID,x-tenant-id',
  });

  // Global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;

  await app.listen(port);
  console.log(`Study Metro API is running on: http://localhost:${port}`);
}
bootstrap();
