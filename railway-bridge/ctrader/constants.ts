/**
 * cTrader Open API Constants
 * Copied from /supabase/functions/server/ctrader-constants.ts
 */

// ===== BASE PROTOCOL PAYLOAD TYPES (50-99) =====
export const ProtoPayloadType = {
  PROTO_MESSAGE: 5,
  ERROR_RES: 50,
  HEARTBEAT_EVENT: 51
} as const;

// ===== OPEN API PAYLOAD TYPES (2100+) =====
export const ProtoOAPayloadType = {
  // Authentication & Session
  PROTO_OA_APPLICATION_AUTH_REQ: 2100,
  PROTO_OA_APPLICATION_AUTH_RES: 2101,
  PROTO_OA_ACCOUNT_AUTH_REQ: 2102,
  PROTO_OA_ACCOUNT_AUTH_RES: 2103,
  PROTO_OA_VERSION_REQ: 2116,
  PROTO_OA_VERSION_RES: 2117,
  
  // Account & Trader
  PROTO_OA_TRADER_REQ: 2121,
  PROTO_OA_TRADER_RES: 2122,
  PROTO_OA_RECONCILE_REQ: 2124,
  PROTO_OA_RECONCILE_RES: 2125,
  PROTO_OA_EXECUTION_EVENT: 2126,
  
  // Heartbeat & Errors
  PROTO_OA_HEARTBEAT_EVENT: 2051,
  PROTO_OA_ERROR_RES: 2050,
} as const;

// ===== TRADING ENUMS =====
export const ProtoOATradeSide = {
  BUY: 1,
  SELL: 2
} as const;

// ===== DEFAULTS =====
export const CTraderDefaults = {
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
};

// ===== TIMEOUTS (milliseconds) =====
export const CTRADER_TIMEOUTS = {
  CONNECTION: 60000,          // 60 seconds for TCP connection
  AUTHENTICATION: 45000,      // 45 seconds for auth
  DEFAULT: 45000              // 45 seconds default
} as const;

// ===== RETRY CONFIGURATION =====
export const CTRADER_RETRY = {
  DEFAULT: 0,
  MAX_ATTEMPTS: 5,
  BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 30000
} as const;

// ===== CONNECTION POOL CONFIGURATION =====
export const CTRADER_POOL = {
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT_MS: 300000,    // 5 minutes
  MAX_AGE_MS: 3600000         // 1 hour
} as const;

// ===== MESSAGE TYPES =====
export const CTRADER_MESSAGE_TYPES = {
  HEARTBEAT: 'HEARTBEAT',
  AUTH: 'AUTH',
  TRADE: 'TRADE',
  MARKET_DATA: 'MARKET_DATA',
  ACCOUNT: 'ACCOUNT'
} as const;
