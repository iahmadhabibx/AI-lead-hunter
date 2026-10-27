import pino, { type Logger, type LoggerOptions } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export function createLogger(options: {
  name: string;
  level?: LogLevel;
  pretty?: boolean;
}): Logger {
  const opts: LoggerOptions = {
    name: options.name,
    level: options.level ?? 'info',
    base: { service: options.name },
    redact: {
      paths: [
        'password',
        'passwordHash',
        'req.headers.cookie',
        'req.headers.authorization',
        'SESSION_SECRET',
        'DATABASE_URL',
        'DB_ADMIN_URL',
      ],
      remove: true,
    },
  };

  if (options.pretty) {
    return pino({
      ...opts,
      transport: {
        target: 'pino/file',
        options: { destination: 1 },
      },
    });
  }

  return pino(opts);
}

export type { Logger };
