import { pino } from 'pino';
import type { AppConfig } from '../config/config.js';

export function createLogger(config: Pick<AppConfig, 'logLevel'>) {
  return pino({
    level: config.logLevel,
  });
}
