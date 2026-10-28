import { Module } from '@nestjs/common';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { CvModule } from './cv/cv.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MatchModule } from './match/match.module';
import { PreferencesModule } from './preferences/preferences.module';
import { ProfileModule } from './profile/profile.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { SourcesModule } from './sources/sources.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    HealthModule,
    AuthModule,
    CvModule,
    TasksModule,
    ProfileModule,
    SourcesModule,
    MatchModule,
    PreferencesModule,
    ApplicationsModule,
  ],
})
export class AppModule {}
