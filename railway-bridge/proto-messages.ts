/**
 * cTrader ProtoOA Message Type Definitions
 * Based on cTrader Open API 2.0 Protocol
 */

export enum ProtoOAPayloadType {
  // Application authentication
  PROTO_OA_APPLICATION_AUTH_REQ = 2100,
  PROTO_OA_APPLICATION_AUTH_RES = 2101,
  
  // Account authentication
  PROTO_OA_ACCOUNT_AUTH_REQ = 2102,
  PROTO_OA_ACCOUNT_AUTH_RES = 2103,
  
  // Trading account
  PROTO_OA_TRADER_REQ = 2104,
  PROTO_OA_TRADER_RES = 2105,
  
  // Account info
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ = 2149,
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES = 2150,
  
  // Symbol info
  PROTO_OA_SYMBOL_BY_ID_REQ = 2106,
  PROTO_OA_SYMBOL_BY_ID_RES = 2107,
  PROTO_OA_SYMBOLS_LIST_REQ = 2151,
  PROTO_OA_SYMBOLS_LIST_RES = 2152,
  
  // Positions
  PROTO_OA_RECONCILE_REQ = 2124,
  PROTO_OA_RECONCILE_RES = 2125,
  
  // Orders
  PROTO_OA_NEW_ORDER_REQ = 2126,
  PROTO_OA_EXECUTION_EVENT = 2132,
  
  // Error
  PROTO_OA_ERROR_RES = 2142,
  
  // Heartbeat
  PROTO_MESSAGE = 5,
  HEARTBEAT_EVENT = 51,
}

export interface ProtoMessage {
  clientMsgId?: string;
  payloadType: number;
  payload: Uint8Array;
}

export interface ApplicationAuthReq {
  clientId: string;
  clientSecret: string;
}

export interface ApplicationAuthRes {
  clientId: string;
}

export interface AccountAuthReq {
  ctidTraderAccountId: number;
  accessToken: string;
}

export interface AccountAuthRes {
  ctidTraderAccountId: number;
}

export interface GetAccountsByAccessTokenReq {
  accessToken: string;
}

export interface GetAccountsByAccessTokenRes {
  ctidTraderAccount: Array<{
    ctidTraderAccountId: number;
    isLive: boolean;
    traderLogin: number;
  }>;
}

export interface TraderReq {
  ctidTraderAccountId: number;
}

export interface TraderRes {
  ctidTraderAccountId: number;
  balance: number;
  balanceVersion: number;
  managerBonus: number;
  ibBonus: number;
  leverage: number;
  equity?: number;
  freeMargin?: number;
  margin?: number;
}

export interface SymbolsListReq {
  ctidTraderAccountId: number;
  includeArchivedSymbols?: boolean;
  accessToken?: string; // Required by some broker configurations
}

export interface SymbolsListRes {
  ctidTraderAccountId: number;
  symbol: Array<{
    symbolId: number;
    symbolName: string;
    enabled: boolean;
    baseAssetId: number;
    quoteAssetId: number;
    symbolCategoryId: number;
    description?: string;
  }>;
}

export interface ReconcileReq {
  ctidTraderAccountId: number;
}

export interface ReconcileRes {
  ctidTraderAccountId: number;
  position: Array<{
    positionId: number;
    tradeData: {
      symbolId: number;
      volume: number;
      tradeSide: number;
      openPrice: number;
      openTimestamp: number;
      commission: number;
      swap: number;
      profit: number;
    };
    utcLastUpdateTimestamp: number;
  }>;
  order: Array<any>;
}

export interface ErrorRes {
  ctidTraderAccountId?: number;
  errorCode: string;
  description?: string;
  maintenanceEndTimestamp?: number;
}