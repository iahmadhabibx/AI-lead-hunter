import { Injectable } from '@nestjs/common';
import { type AppEnv, parseAppEnv } from '@aijh/contracts';

@Injectable()
export class ConfigService {
  readonly env: AppEnv;

  constructor() {
    this.env = parseAppEnv(process.env);
  }
}
