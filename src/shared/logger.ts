import { config } from './config';
import type { CASPAConfig } from './types';

const LEVELS: Record<CASPAConfig['logLevel'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: CASPAConfig['logLevel']): boolean {
  return LEVELS[level] >= LEVELS[config.logLevel];
}

function formatMessage(level: string, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

function log(level: CASPAConfig['logLevel'], message: string): void {
  if (!shouldLog(level)) {
    return;
  }

  const formatted = formatMessage(level, message);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

export const logger = {
  debug(message: string): void {
    log('debug', message);
  },
  info(message: string): void {
    log('info', message);
  },
  warn(message: string): void {
    log('warn', message);
  },
  error(message: string): void {
    log('error', message);
  },
};
