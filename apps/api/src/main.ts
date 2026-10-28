import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { parseAppEnv, resolveStorageRoot } from '@aijh/contracts';
import { createLogger } from '@aijh/observability';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';

async function bootstrap() {
  const env = parseAppEnv(process.env);
  const logger = createLogger({
    name: 'api',
    level: env.LOG_LEVEL,
  });

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  if (env.TRUST_PROXY) {
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.getInstance().set('trust proxy', 1);
  }

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
  app.use(
    new SecurityHeadersMiddleware().use.bind(new SecurityHeadersMiddleware()),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.enableCors({
    origin: env.APP_URL,
    credentials: true,
  });

  if (env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI Job Hunter API')
      .setDescription('REST API for the AI job-hunting SaaS')
      .setVersion('0.1.0')
      .addCookieAuth(env.SESSION_COOKIE_NAME)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, document);
  }

  await app.listen(env.API_PORT);
  logger.info(
    {
      port: env.API_PORT,
      storageRoot: resolveStorageRoot(env.STORAGE_ROOT),
    },
    'API listening',
  );
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
