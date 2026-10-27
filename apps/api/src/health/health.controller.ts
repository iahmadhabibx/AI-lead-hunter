import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { checkDatabaseConnection } from '@aijh/database';
import { ConfigService } from '../config/config.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: this.config.env.APP_NAME,
      time: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    const [dbOk, redisOk] = await Promise.all([
      checkDatabaseConnection(this.config.env.DATABASE_URL),
      this.redis.ping(),
    ]);

    if (!dbOk || !redisOk) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: dbOk, redis: redisOk },
      });
    }

    return {
      status: 'ready',
      checks: { database: true, redis: true },
    };
  }
}
