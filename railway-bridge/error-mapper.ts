/**
 * cTrader Error Mapper
 * Maps ProtoOA error codes and internal errors to standardized HTTP responses
 */

export interface StandardError {
  status: number;
  response: {
    error: string;
    code: string;
    description?: string;
    context?: string;
    timestamp: string;
  };
}

export class ErrorMapper {
  static map(error: any, context: string): StandardError {
    console.error(`[${context}] Error caught:`, error);

    const timestamp = new Date().toISOString();
    const message = error.message || 'Unknown error';

    // Handle standard cTrader ProtoOA errors (usually text messages in current implementation)
    if (message.includes('MARKET_CLOSED')) {
      return {
        status: 503, // Service Unavailable (temporarily)
        response: {
          error: 'Market is closed',
          code: 'MARKET_CLOSED',
          description: 'Trading is not available at this time.',
          context,
          timestamp,
        },
      };
    }

    if (message.includes('NOT_ENOUGH_MONEY') || message.includes('NOT_ENOUGH_FUNDS')) {
      return {
        status: 400,
        response: {
          error: 'Insufficient funds',
          code: 'INSUFFICIENT_FUNDS',
          description: 'You do not have enough free margin to place this trade.',
          context,
          timestamp,
        },
      };
    }

    if (message.includes('POSITION_LOCKED') || message.includes('TRADING_DISABLED')) {
      return {
        status: 403,
        response: {
          error: 'Trading disabled',
          code: 'TRADING_DISABLED',
          description: 'Trading is disabled for this account or symbol.',
          context,
          timestamp,
        },
      };
    }

    if (message.includes('SYMBOL_NOT_FOUND') || message.includes('Symbol not found')) {
      return {
        status: 404,
        response: {
          error: 'Symbol not found',
          code: 'SYMBOL_NOT_FOUND',
          context,
          timestamp,
        },
      };
    }

    if (message.includes('TIMEOUT') || message.includes('timeout') || message.name === 'TimeoutError') {
      return {
        status: 504, // Gateway Timeout
        response: {
          error: 'Request timed out',
          code: 'TIMEOUT',
          description: 'The request to cTrader timed out. Please try again.',
          context,
          timestamp,
        },
      };
    }

    if (message.includes('DISCONNECTED') || message.includes('Connection closed')) {
      return {
        status: 502, // Bad Gateway
        response: {
          error: 'Not connected',
          code: 'CONNECTION_LOST',
          description: 'Connection to cTrader was lost. Automatic reconnection is in progress.',
          context,
          timestamp,
        },
      };
    }

    if (message.includes('ALREADY_SUBSCRIBED')) {
        // This is actually a warning, usually handled internally, but if it bubbles up:
        return {
            status: 200, // Treat as success
            response: {
                error: 'Already subscribed',
                code: 'ALREADY_SUBSCRIBED',
                context,
                timestamp
            }
        }
    }

    // Default 500
    return {
      status: 500,
      response: {
        error: message,
        code: 'INTERNAL_ERROR',
        context,
        timestamp,
      },
    };
  }
}
