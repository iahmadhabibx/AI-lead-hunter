import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { parseAppEnv } from '@aijh/contracts';
import { createLogger } from '@aijh/observability';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestIdMiddleware } from './common/request-id.middleware';

async function bootstrap() {
  const env = parseAppEnv(process.env);
  const logger = createLogger({
    name: 'api',
    level: env.LOG_LEVEL,
  });

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.enableCors({
    origin: env.APP_URL,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Job Hunter API')
    .setDescription('REST API for the AI job-hunting SaaS')
    .setVersion('0.1.0')
    .addCookieAuth(env.SESSION_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document);

  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT }, 'API listening');
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
