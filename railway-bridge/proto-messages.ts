/**
 * cTrader ProtoOA Message Type Definitions
 * Based on cTrader Open API 2.0 Protocol
 * 
 * ✅ VALIDATED against official OpenApiModelMessages.proto (2025-12-11)
 */

export enum ProtoOAPayloadType {
  // Application authentication
  PROTO_OA_APPLICATION_AUTH_REQ = 2100,
  PROTO_OA_APPLICATION_AUTH_RES = 2101,
  
  // Account authentication
  PROTO_OA_ACCOUNT_AUTH_REQ = 2102,
  PROTO_OA_ACCOUNT_AUTH_RES = 2103,
  
  // Version
  PROTO_OA_VERSION_REQ = 2104,
  PROTO_OA_VERSION_RES = 2105,
  
  // Orders
  PROTO_OA_NEW_ORDER_REQ = 2106,  // FIXED: Was incorrectly 2126
  PROTO_OA_TRAILING_SL_CHANGED_EVENT = 2107,
  PROTO_OA_CANCEL_ORDER_REQ = 2108,
  PROTO_OA_AMEND_ORDER_REQ = 2109,
  PROTO_OA_AMEND_POSITION_SLTP_REQ = 2110,
  PROTO_OA_CLOSE_POSITION_REQ = 2111,
  
  // Assets
  PROTO_OA_ASSET_LIST_REQ = 2112,
  PROTO_OA_ASSET_LIST_RES = 2113,
  
  // Symbols
  PROTO_OA_SYMBOLS_LIST_REQ = 2114,  // FIXED: Was incorrectly 2151
  PROTO_OA_SYMBOLS_LIST_RES = 2115,  // FIXED: Was incorrectly 2152
  PROTO_OA_SYMBOL_BY_ID_REQ = 2116,  // FIXED: Was incorrectly 2106
  PROTO_OA_SYMBOL_BY_ID_RES = 2117,  // FIXED: Was incorrectly 2107
  PROTO_OA_SYMBOLS_FOR_CONVERSION_REQ = 2118,
  PROTO_OA_SYMBOLS_FOR_CONVERSION_RES = 2119,
  PROTO_OA_SYMBOL_CHANGED_EVENT = 2120,
  
  // Trader/Account
  PROTO_OA_TRADER_REQ = 2121,  // FIXED: Was incorrectly 2104
  PROTO_OA_TRADER_RES = 2122,  // FIXED: Was incorrectly 2105
  PROTO_OA_TRADER_UPDATE_EVENT = 2123,
  
  // Positions
  PROTO_OA_RECONCILE_REQ = 2124,
  PROTO_OA_RECONCILE_RES = 2125,
  
  // Execution
  PROTO_OA_EXECUTION_EVENT = 2126,  // FIXED: Was incorrectly labeled as NEW_ORDER_REQ
  
  // Spots
  PROTO_OA_SUBSCRIBE_SPOTS_REQ = 2127,
  PROTO_OA_SUBSCRIBE_SPOTS_RES = 2128,
  PROTO_OA_UNSUBSCRIBE_SPOTS_REQ = 2129,
  PROTO_OA_UNSUBSCRIBE_SPOTS_RES = 2130,
  PROTO_OA_SPOT_EVENT = 2131,
  PROTO_OA_ORDER_ERROR_EVENT = 2132,  // FIXED: Was incorrectly labeled as EXECUTION_EVENT
  
  // Deals
  PROTO_OA_DEAL_LIST_REQ = 2133,
  PROTO_OA_DEAL_LIST_RES = 2134,
  
  // Trendbars
  PROTO_OA_SUBSCRIBE_LIVE_TRENDBAR_REQ = 2135,
  PROTO_OA_UNSUBSCRIBE_LIVE_TRENDBAR_REQ = 2136,
  PROTO_OA_GET_TRENDBARS_REQ = 2137,
  PROTO_OA_GET_TRENDBARS_RES = 2138,
  
  // Margin
  PROTO_OA_EXPECTED_MARGIN_REQ = 2139,
  PROTO_OA_EXPECTED_MARGIN_RES = 2140,
  PROTO_OA_MARGIN_CHANGED_EVENT = 2141,
  
  // Error
  PROTO_OA_ERROR_RES = 2142,
  
  // Cash flow
  PROTO_OA_CASH_FLOW_HISTORY_LIST_REQ = 2143,
  PROTO_OA_CASH_FLOW_HISTORY_LIST_RES = 2144,
  
  // Tick data
  PROTO_OA_GET_TICKDATA_REQ = 2145,
  PROTO_OA_GET_TICKDATA_RES = 2146,
  
  // Events
  PROTO_OA_ACCOUNTS_TOKEN_INVALIDATED_EVENT = 2147,
  PROTO_OA_CLIENT_DISCONNECT_EVENT = 2148,
  
  // Account info
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ = 2149,
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES = 2150,
  
  // Profile (NOT symbols!)
  PROTO_OA_GET_CTID_PROFILE_BY_TOKEN_REQ = 2151,  // This is NOT symbols list
  PROTO_OA_GET_CTID_PROFILE_BY_TOKEN_RES = 2152,  // This is NOT symbols list
  
  // Asset classes
  PROTO_OA_ASSET_CLASS_LIST_REQ = 2153,
  PROTO_OA_ASSET_CLASS_LIST_RES = 2154,
  
  // Depth
  PROTO_OA_DEPTH_EVENT = 2155,
  PROTO_OA_SUBSCRIBE_DEPTH_QUOTES_REQ = 2156,
  PROTO_OA_SUBSCRIBE_DEPTH_QUOTES_RES = 2157,
  PROTO_OA_UNSUBSCRIBE_DEPTH_QUOTES_REQ = 2158,
  PROTO_OA_UNSUBSCRIBE_DEPTH_QUOTES_RES = 2159,
  
  // Symbol category
  PROTO_OA_SYMBOL_CATEGORY_REQ = 2160,
  PROTO_OA_SYMBOL_CATEGORY_RES = 2161,
  
  // Logout
  PROTO_OA_ACCOUNT_LOGOUT_REQ = 2162,
  PROTO_OA_ACCOUNT_LOGOUT_RES = 2163,
  PROTO_OA_ACCOUNT_DISCONNECT_EVENT = 2164,
  
  // Trendbar responses
  PROTO_OA_SUBSCRIBE_LIVE_TRENDBAR_RES = 2165,
  PROTO_OA_UNSUBSCRIBE_LIVE_TRENDBAR_RES = 2166,
  
  // Common heartbeat
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
