/**
 * Production-safe logging utility
 * Logs to console only in development, can be extended for production logging services
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  component?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  
  private formatMessage(level: LogLevel, message: string, component?: string): string {
    const timestamp = new Date().toISOString();
    const componentStr = component ? `[${component}]` : '';
    return `[${timestamp}] ${level.toUpperCase()} ${componentStr} ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any, component?: string): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      component,
    };

    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage(level, message, component);
      
      switch (level) {
        case 'debug':
          console.debug(formattedMessage, data);
          break;
        case 'info':
          console.info(formattedMessage, data);
          break;
        case 'warn':
          console.warn(formattedMessage, data);
          break;
        case 'error':
          console.error(formattedMessage, data);
          break;
      }
    } else {
      // In production, you could send to a logging service
      // Example: sendToLoggingService(entry);
      
      // For now, only log errors to console in production
      if (level === 'error') {
        console.error(this.formatMessage(level, message, component), data);
      }
    }
  }

  debug(message: string, data?: any, component?: string): void {
    this.log('debug', message, data, component);
  }

  info(message: string, data?: any, component?: string): void {
    this.log('info', message, data, component);
  }

  warn(message: string, data?: any, component?: string): void {
    this.log('warn', message, data, component);
  }

  error(message: string, data?: any, component?: string): void {
    this.log('error', message, data, component);
  }

  // Specific method for AI operations
  aiError(operation: string, error: any, component?: string): void {
    this.error(`AI Operation Failed: ${operation}`, error, component);
  }

  // Specific method for validation errors
  validationError(field: string, error: any, component?: string): void {
    this.error(`Validation Error: ${field}`, error, component);
  }

  // Specific method for API errors
  apiError(endpoint: string, error: any, component?: string): void {
    this.error(`API Error: ${endpoint}`, error, component);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for external use
export type { LogLevel, LogEntry };