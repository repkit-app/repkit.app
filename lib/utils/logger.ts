/**
 * Structured Logging Utility
 * Routes logs through Sentry for error tracking and structured data
 */

import * as Sentry from '@sentry/nextjs';

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Log levels match Sentry severity levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Structured logger instance
 */
export const logger = {
  /**
   * Log debug message with context
   */
  debug(message: string, context?: LogContext): void {
    Sentry.captureMessage(message, {
      level: 'debug',
      tags: {
        type: 'debug',
      },
      contexts: {
        custom: context,
      },
    });
  },

  /**
   * Log info message with context
   */
  info(message: string, context?: LogContext): void {
    Sentry.captureMessage(message, {
      level: 'info',
      contexts: {
        custom: context,
      },
    });
  },

  /**
   * Log warning with context
   */
  warn(message: string, context?: LogContext): void {
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: {
        severity: 'warning',
      },
      contexts: {
        custom: context,
      },
    });
  },

  /**
   * Log error with context
   */
  error(message: string, error?: Error | null, context?: LogContext): void {
    if (error) {
      Sentry.captureException(error, {
        contexts: {
          custom: context,
        },
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        contexts: {
          custom: context,
        },
      });
    }
  },

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error | null, context?: LogContext): void {
    if (error) {
      Sentry.captureException(error, {
        level: 'fatal',
        contexts: {
          custom: context,
        },
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'fatal',
        contexts: {
          custom: context,
        },
      });
    }
  },
};
