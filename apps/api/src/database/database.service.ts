import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createDb, type Database } from '@aijh/database';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Database;
  private readonly connectionString: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.connectionString = config.env.DATABASE_URL;
    this.db = createDb(this.connectionString);
  }

  getConnectionString(): string {
    return this.connectionString;
  }

  async onModuleDestroy(): Promise<void> {
    // postgres-js clients are closed via process exit in Phase 0;
    // explicit pool end can be added when we retain the raw client.
  }
}
