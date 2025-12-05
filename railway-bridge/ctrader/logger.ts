/**
 * Secure Logger Utility
 * Copied from /supabase/functions/server/secure-logger.ts
 */

// Environment detection
const ENVIRONMENT = Deno.env.get('ENVIRONMENT') || 'development';
const DEBUG_MODE = Deno.env.get('CTRADER_DEBUG') === 'true';
const PRODUCTION = ENVIRONMENT === 'production';

// Sensitive field patterns
const SENSITIVE_PATTERNS = [
  'token',
  'secret',
  'password',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'bearer',
  'clientsecret',
  'client_secret',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
];

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LoggerConfig {
  enableConsole: boolean;
  enableSanitization: boolean;
  logLevel: LogLevel;
  maxDataLength: number;
}

const DEFAULT_CONFIG: LoggerConfig = {
  enableConsole: !PRODUCTION,
  enableSanitization: true,
  logLevel: DEBUG_MODE ? LogLevel.DEBUG : LogLevel.INFO,
  maxDataLength: 1000,
};

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

function sanitizeData(data: any, maxLength: number = 1000): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: DEBUG_MODE ? data.stack : undefined,
      ...(data as any).context ? { context: sanitizeData((data as any).context, maxLength) } : {},
      ...(data as any).code ? { code: (data as any).code } : {},
      ...(data as any).isRetryable !== undefined ? { isRetryable: (data as any).isRetryable } : {},
      ...(data as any).timestamp ? { timestamp: (data as any).timestamp } : {},
    };
  }
  
  if (typeof data !== 'object') {
    const str = String(data);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '...[truncated]';
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, maxLength));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      if (typeof value === 'string' && value.length > 0) {
        sanitized[key] = value.substring(0, 4) + '...[REDACTED]';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeData(value, maxLength);
    } else {
      const str = String(value);
      if (str.length > maxLength) {
        sanitized[key] = str.substring(0, maxLength) + '...[truncated]';
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

function formatMessage(level: LogLevel, prefix: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${prefix} ${message}`;
}

function log(
  level: LogLevel,
  prefix: string,
  message: string,
  data?: any,
  config: LoggerConfig = DEFAULT_CONFIG
) {
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  const currentLevelIndex = levels.indexOf(config.logLevel);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex < currentLevelIndex) {
    return;
  }
  
  const formattedMessage = formatMessage(level, prefix, message);
  
  let sanitizedData = data;
  if (data !== undefined && config.enableSanitization) {
    sanitizedData = sanitizeData(data, config.maxDataLength);
  }
  
  if (config.enableConsole) {
    switch (level) {
      case LogLevel.DEBUG:
        console.log(formattedMessage, sanitizedData !== undefined ? sanitizedData : '');
        break;
      case LogLevel.INFO:
        console.log(formattedMessage, sanitizedData !== undefined ? sanitizedData : '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, sanitizedData !== undefined ? sanitizedData : '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, sanitizedData !== undefined ? sanitizedData : '');
        break;
    }
  }
}

export class SecureLogger {
  private prefix: string;
  private config: LoggerConfig;
  
  constructor(prefix: string, config: Partial<LoggerConfig> = {}) {
    this.prefix = prefix;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  debug(message: string, data?: any) {
    log(LogLevel.DEBUG, this.prefix, message, data, this.config);
  }
  
  info(message: string, data?: any) {
    log(LogLevel.INFO, this.prefix, message, data, this.config);
  }
  
  warn(message: string, data?: any) {
    log(LogLevel.WARN, this.prefix, message, data, this.config);
  }
  
  error(message: string, data?: any) {
    log(LogLevel.ERROR, this.prefix, message, data, this.config);
  }
  
  hexDump(message: string, data: Uint8Array, maxBytes: number = 100) {
    if (PRODUCTION) {
      this.debug(message + ' [hex dump disabled in production]');
      return;
    }
    
    if (!DEBUG_MODE) {
      this.debug(message + ' [enable CTRADER_DEBUG=true for hex dumps]');
      return;
    }
    
    const bytes = Array.from(data.slice(0, maxBytes));
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
    const truncated = data.length > maxBytes ? ` ...[${data.length - maxBytes} more bytes]` : '';
    
    this.debug(message, { hex: hex + truncated, length: data.length });
  }
  
  child(childPrefix: string): SecureLogger {
    return new SecureLogger(`${this.prefix}:${childPrefix}`, this.config);
  }
}

export function createLogger(prefix: string, config?: Partial<LoggerConfig>): SecureLogger {
  return new SecureLogger(prefix, config);
}

export const logger = createLogger('[cTrader]');

export function sanitizeForClient(data: any): any {
  return sanitizeData(data, 500);
}

export function isProduction(): boolean {
  return PRODUCTION;
}

export function isDebugMode(): boolean {
  return DEBUG_MODE;
}

export function getEnvironment(): string {
  return ENVIRONMENT;
}
