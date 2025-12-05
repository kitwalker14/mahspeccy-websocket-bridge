/**
 * cTrader Type Definitions (Simplified for Railway Bridge)
 */

export interface CTraderConfig {
  clientId: string;
  clientSecret: string;
  accountId: string;
  accessToken: string;
  endpoint: string;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  currency: string;
  isLive: boolean;
  freeMargin: number;
  margin: number;
  marginLevel: number;
}

export interface Position {
  positionId: number;
  symbol: string;
  symbolId: number;
  direction: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  swap: number;
  commission: number;
  netPnL: number;
  openTimestamp: number;
}

export interface Order {
  orderId: number;
  symbol: string;
  symbolId: number;
  direction: 'BUY' | 'SELL';
  volume: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
}

export interface Symbol {
  symbolId: number;
  symbolName: string;
  bid: number;
  ask: number;
  digits: number;
  pipPosition: number;
  minVolume: number;
  maxVolume: number;
  stepVolume: number;
}

export const CTraderDefaults = {
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
};

export class VolumeConverter {
  static toApi(lots: number): number {
    // Convert lots to cents (cTrader API uses volume in cents)
    return Math.round(lots * 100000);
  }
  
  static fromApi(cents: number): number {
    // Convert cents to lots
    return cents / 100000;
  }
}
