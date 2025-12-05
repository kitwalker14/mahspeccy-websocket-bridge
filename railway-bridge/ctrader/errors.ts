/**
 * cTrader Error Classes
 * Simplified version for Railway Bridge
 */

export enum CTraderErrorCode {
  // Connection Errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',
  
  // Authentication Errors
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_TIMEOUT = 'AUTH_TIMEOUT',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  
  // Trading Errors
  TRADE_REJECTED = 'TRADE_REJECTED',
  TRADE_TIMEOUT = 'TRADE_TIMEOUT',
  
  // Data Errors
  DATA_FETCH_FAILED = 'DATA_FETCH_FAILED',
  DATA_TIMEOUT = 'DATA_TIMEOUT',
  
  // Protocol Errors
  PROTOCOL_INVALID_MESSAGE = 'PROTOCOL_INVALID_MESSAGE',
  
  // Configuration Errors
  CONFIG_MISSING = 'CONFIG_MISSING',
  
  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface CTraderErrorContext {
  operation: string;
  userId?: string;
  accountId?: number;
  environment?: 'demo' | 'live';
  timestamp: number;
  originalError?: string;
  payloadType?: number;
  expectedResponseType?: number;
  timeoutMs?: number;
}

export class CTraderError extends Error {
  public readonly code: CTraderErrorCode;
  public readonly context: CTraderErrorContext;
  public readonly timestamp: number;
  public readonly userMessage: string;
  public readonly isRetryable: boolean;
  
  constructor(
    message: string,
    code: CTraderErrorCode,
    context: CTraderErrorContext,
    options: {
      userMessage?: string;
      isRetryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'CTraderError';
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();
    this.userMessage = options.userMessage || message;
    this.isRetryable = options.isRetryable ?? false;
    
    if (options.cause) {
      this.context.originalError = options.cause.message;
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp,
      isRetryable: this.isRetryable,
    };
  }
  
  toString(): string {
    const ctx = this.context;
    return [
      `[${this.code}] ${this.message}`,
      `  Operation: ${ctx.operation}`,
      ctx.userId ? `  User: ${ctx.userId.substring(0, 8)}...` : '',
      ctx.accountId ? `  Account: ${ctx.accountId}` : '',
      ctx.environment ? `  Environment: ${ctx.environment}` : '',
      `  Time: ${new Date(ctx.timestamp).toISOString()}`,
    ].filter(Boolean).join('\n');
  }
}

export class CTraderConnectionError extends CTraderError {
  constructor(
    message: string,
    context: CTraderErrorContext,
    options: { cause?: Error; isRetryable?: boolean } = {}
  ) {
    super(
      message,
      CTraderErrorCode.CONNECTION_FAILED,
      context,
      {
        userMessage: 'Failed to connect to cTrader.',
        isRetryable: true,
        ...options,
      }
    );
    this.name = 'CTraderConnectionError';
  }
}

export class CTraderAuthenticationError extends CTraderError {
  constructor(
    message: string,
    context: CTraderErrorContext,
    options: { cause?: Error; code?: CTraderErrorCode } = {}
  ) {
    super(
      message,
      options.code || CTraderErrorCode.AUTH_FAILED,
      context,
      {
        userMessage: 'Authentication failed.',
        isRetryable: false,
        ...options,
      }
    );
    this.name = 'CTraderAuthenticationError';
  }
}

export class CTraderTradingError extends CTraderError {
  constructor(
    message: string,
    context: CTraderErrorContext,
    options: { cause?: Error; code?: CTraderErrorCode; isRetryable?: boolean } = {}
  ) {
    super(
      message,
      options.code || CTraderErrorCode.TRADE_REJECTED,
      context,
      {
        userMessage: 'Trade operation failed.',
        isRetryable: options.isRetryable ?? false,
        ...options,
      }
    );
    this.name = 'CTraderTradingError';
  }
}

export class CTraderDataError extends CTraderError {
  constructor(
    message: string,
    context: CTraderErrorContext,
    options: { cause?: Error; code?: CTraderErrorCode; isRetryable?: boolean } = {}
  ) {
    super(
      message,
      options.code || CTraderErrorCode.DATA_FETCH_FAILED,
      context,
      {
        userMessage: 'Failed to fetch data.',
        isRetryable: options.isRetryable ?? true,
        ...options,
      }
    );
    this.name = 'CTraderDataError';
  }
}

export class CTraderMessageError extends CTraderError {
  constructor(
    message: string,
    context: CTraderErrorContext,
    options: { cause?: Error; code?: CTraderErrorCode; isRetryable?: boolean } = {}
  ) {
    super(
      message,
      options.code || CTraderErrorCode.PROTOCOL_INVALID_MESSAGE,
      context,
      {
        userMessage: 'Message handling error.',
        isRetryable: options.isRetryable ?? true,
        ...options,
      }
    );
    this.name = 'CTraderMessageError';
  }
}

export function createCTraderError(
  error: unknown,
  operation: string,
  context: Partial<CTraderErrorContext> = {}
): CTraderError {
  const fullContext: CTraderErrorContext = {
    operation,
    timestamp: Date.now(),
    ...context,
  };
  
  if (error instanceof CTraderError) {
    return error;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return new CTraderConnectionError(
        `Timeout during ${operation}`,
        fullContext,
        { cause: error, isRetryable: true }
      );
    }
    
    if (message.includes('auth')) {
      return new CTraderAuthenticationError(
        `Authentication failed during ${operation}`,
        fullContext,
        { cause: error }
      );
    }
    
    if (message.includes('connect')) {
      return new CTraderConnectionError(
        `Connection failed during ${operation}`,
        fullContext,
        { cause: error }
      );
    }
    
    return new CTraderError(
      `Error during ${operation}: ${error.message}`,
      CTraderErrorCode.UNKNOWN_ERROR,
      fullContext,
      { cause: error }
    );
  }
  
  return new CTraderError(
    `Unknown error during ${operation}`,
    CTraderErrorCode.UNKNOWN_ERROR,
    fullContext
  );
}
