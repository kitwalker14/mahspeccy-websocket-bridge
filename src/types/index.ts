export interface UserCredentials {
  userId: string
  accessToken: string
  refreshToken?: string
  clientId: string
  clientSecret: string
  tokenExpiresAt: Date
}

export interface CTraderAccount {
  accountId: string
  balance: number
  equity: number
  margin: number
  freeMargin: number
  marginLevel: number
  currency: string
  leverage: number
  broker: string
  environment: 'demo' | 'live'
}

export interface Position {
  positionId: string
  symbol: string
  volume: number
  entryPrice: number
  currentPrice: number
  profit: number
  swap: number
  commission: number
  side: 'buy' | 'sell'
  openTime: Date
  stopLoss?: number
  takeProfit?: number
}

export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'order' | 'closePosition' | 'ping' | 'authenticate' | 'connect' | 'disconnect'
  payload: any
}

export interface ServerMessage {
  type: 'accountUpdate' | 'positionUpdate' | 'error' | 'pong' | 'connected' | 'disconnected' | 'authenticated' | 'executionEvent' | 'spotEvent'
  payload: any
  timestamp: number
}

export interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface ConnectionState {
  userId: string
  isAuthenticated: boolean
  isConnectedToCTrader: boolean
  accountId?: string
  lastActivity: Date
  reconnectAttempts: number
}
