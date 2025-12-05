// REAL cTrader Open API TCP Client
// Based on official cTrader Open API documentation
// Uses Protocol Buffers over TCP

import {
  CTraderConfig,
  Position,
  Order,
  AccountInfo,
  Symbol,
  CTraderDefaults,
  VolumeConverter,
} from './types.ts';

import { 
  ProtoOAPayloadType, 
  SimpleProtoEncoder,
  type ProtoMessage 
} from './protobuf.ts';

import { createLogger } from './logger.ts';
import {
  CTraderError,
  CTraderConnectionError,
  CTraderAuthenticationError,
  CTraderDataError,
  CTraderTradingError,
  CTraderErrorCode,
  createCTraderError,
  CTraderMessageError,
} from './errors.ts';

import {
  CTRADER_TIMEOUTS,
  CTRADER_RETRY,
  CTRADER_MESSAGE_TYPES,
  CTRADER_POOL,
} from './constants.ts';

const logger = createLogger('[TCP Client]');

interface PendingMessage {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: number;
  timestamp: number;
  expectedType: number;
}

export class CTraderTcpClient {
  private conn: Deno.Conn | null = null;
  private config: CTraderConfig;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatInterval: number | null = null;
  private lastHeartbeat: number = 0;
  private userId: string;
  private isReading = false;
  
  private pendingMessages: Map<string, PendingMessage> = new Map();
  private messageCounter = 0;
  
  private accountData: AccountInfo | null = null;
  private positions: Map<number, Position> = new Map();
  private orders: Map<number, Order> = new Map();
  
  private eventListeners: Map<string, Function[]> = new Map();
  
  private readBuffer: Uint8Array = new Uint8Array(0);
  
  constructor(config: CTraderConfig, userId: string) {
    this.config = config;
    this.userId = userId;
  }
  
  async connect(): Promise<void> {
    const hostname = this.config.endpoint.includes('demo') ? 'demo.ctraderapi.com' : 'live.ctraderapi.com';
    const port = 5035;
    
    logger.info(`🔌 [${this.userId}] Connecting to cTrader TCP with TLS:`, `${hostname}:${port}`);
    logger.info(`🔌 [${this.userId}] Config:`, {
      clientId: this.config.clientId?.substring(0, 10) + '...',
      hasSecret: !!this.config.clientSecret,
      accountId: this.config.accountId,
      hasToken: !!this.config.accessToken,
    });
    
    return new Promise(async (resolve, reject) => {
      try {
        logger.info(`🔌 [${this.userId}] Attempting TLS handshake to ${hostname}:${port}...`);
        
        const tlsConnectPromise = Deno.connectTls({ hostname, port });
        const tlsTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`TLS handshake timeout after 10s`));
          }, 10000);
        });
        
        this.conn = await Promise.race([tlsConnectPromise, tlsTimeoutPromise]);
        logger.info(`✅ [${this.userId}] TLS connection established - starting authentication`);
        
        this.startReading();
        
        const connectionTimeout = setTimeout(() => {
          if (!this.isAuthenticated) {
            const error = new CTraderConnectionError(
              `Connection timeout after 60s`,
              {
                operation: 'connect',
                userId: this.userId,
                accountId: this.config.accountId ? parseInt(this.config.accountId) : undefined,
                environment: this.config.endpoint.includes('demo') ? 'demo' : 'live',
                timestamp: Date.now(),
              }
            );
            logger.error(`❌ [${this.userId}] Connection timeout`);
            reject(error);
            this.disconnect();
          }
        }, CTRADER_TIMEOUTS.CONNECTION);
        
        try {
          await this.authenticate();
          clearTimeout(connectionTimeout);
          logger.info(`✅ [${this.userId}] Full connection established`);
          resolve();
        } catch (error) {
          clearTimeout(connectionTimeout);
          logger.error(`❌ [${this.userId}] Authentication failed:`, error);
          reject(error);
        }
      } catch (error) {
        logger.error(`❌ [${this.userId}] Connection failed:`, error);
        reject(error);
      }
    });
  }
  
  private async startReading(): Promise<void> {
    if (this.isReading || !this.conn) return;
    
    this.isReading = true;
    logger.info(`👀 [${this.userId}] Starting to read from TCP connection...`);
    
    try {
      const buffer = new Uint8Array(65536);
      
      while (this.conn) {
        const n = await this.conn.read(buffer);
        
        logger.info(`📥 [${this.userId}] Read ${n} bytes from TCP`);
        
        if (n === null) {
          logger.info(`🔌 [${this.userId}] TCP connection closed by server`);
          this.isAuthenticated = false;
          this.stopHeartbeat();
          
          if (this.reconnectAttempts < CTraderDefaults.MAX_RECONNECT_ATTEMPTS) {
            this.attemptReconnect();
          }
          break;
        }
        
        const newData = buffer.slice(0, n);
        const combined = new Uint8Array(this.readBuffer.length + newData.length);
        combined.set(this.readBuffer);
        combined.set(newData, this.readBuffer.length);
        this.readBuffer = combined;
        
        this.processMessages();
      }
    } catch (error) {
      logger.error(`❌ [${this.userId}] Read error:`, error);
      this.isAuthenticated = false;
      this.stopHeartbeat();
      
      if (this.reconnectAttempts < CTraderDefaults.MAX_RECONNECT_ATTEMPTS) {
        this.attemptReconnect();
      }
    } finally {
      this.isReading = false;
    }
  }
  
  private processMessages(): void {
    while (this.readBuffer.length >= 4) {
      const lengthView = new DataView(this.readBuffer.buffer, this.readBuffer.byteOffset, 4);
      const messageLength = lengthView.getUint32(0, false);
      
      if (this.readBuffer.length < 4 + messageLength) {
        break;
      }
      
      const messageData = this.readBuffer.slice(0, 4 + messageLength);
      this.readBuffer = this.readBuffer.slice(4 + messageLength);
      
      this.handleMessage(messageData);
    }
  }
  
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    const delay = Math.min(
      CTraderDefaults.RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );
    
    logger.info(`🔄 [${this.userId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${CTraderDefaults.MAX_RECONNECT_ATTEMPTS})...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error(`❌ [${this.userId}] Reconnection failed:`, error);
      });
    }, delay);
  }
  
  disconnect(): void {
    logger.info(`🔌 [${this.userId}] Disconnecting from cTrader TCP`);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    for (const [id, pending] of this.pendingMessages.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
      this.pendingMessages.delete(id);
    }
    
    if (this.conn) {
      try {
        this.conn.close();
      } catch (error) {
        logger.error(`❌ [${this.userId}] Error closing connection:`, error);
      }
      this.conn = null;
    }
    
    this.isAuthenticated = false;
    this.isReading = false;
  }
  
  isConnected(): boolean {
    return this.conn !== null && this.isAuthenticated;
  }
  
  getConnectionState() {
    return {
      connected: this.isConnected(),
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      endpoint: this.config.endpoint,
    };
  }
  
  private async authenticate(): Promise<void> {
    logger.info(`🔐 [${this.userId}] Authenticating with cTrader...`);
    
    const appAuthPayload = {
      1: this.config.clientId,
      2: this.config.clientSecret,
    };
    
    try {
      logger.info(`📤 [${this.userId}] Sending APPLICATION_AUTH_REQ with clientId: ${this.config.clientId.substring(0, 15)}...`);
      const appAuthResponse = await this.sendAndWait(
        ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ,
        appAuthPayload,
        ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_RES,
        CTRADER_TIMEOUTS.AUTHENTICATION
      );
      
      logger.info(`✅ [${this.userId}] Application authenticated:`, appAuthResponse);
      
      const ctidTraderAccountId = parseInt(this.config.accountId);
      logger.info(`📤 [${this.userId}] Sending ACCOUNT_AUTH_REQ for account ${ctidTraderAccountId} with token: ${this.config.accessToken.substring(0, 20)}...`);
      
      const accountAuthPayload = {
        1: ctidTraderAccountId,
        2: this.config.accessToken,
      };
      
      const accountAuthResponse = await this.sendAndWait(
        ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ,
        accountAuthPayload,
        ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_RES,
        CTRADER_TIMEOUTS.AUTHENTICATION
      );
      
      logger.info(`✅ [${this.userId}] Account authenticated:`, accountAuthResponse);
      this.isAuthenticated = true;
      
    } catch (error) {
      logger.error(`❌ [${this.userId}] Authentication failed:`, error);
      throw error;
    }
    
    this.startHeartbeat();
    
    logger.info(`✅ [${this.userId}] Fully authenticated and ready`);
  }
  
  private handleMessage(data: Uint8Array): void {
    try {
      const decoded = SimpleProtoEncoder.decodeMessage(data);
      
      if (!decoded) {
        logger.error(`❌ [${this.userId}] Failed to decode message`);
        return;
      }
      
      const { payloadType, payload } = decoded;
      
      logger.info(`📨 [${this.userId}] Received:`, payloadType, payload);
      
      if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
        logger.error(`❌ [${this.userId}] Error response:`, payload);
        this.handleError(payload);
        return;
      }
      
      if (payloadType === ProtoOAPayloadType.PROTO_OA_EXECUTION_EVENT) {
        this.handleExecutionEvent(payload);
        return;
      }
      
      if (payloadType === ProtoOAPayloadType.PROTO_OA_HEARTBEAT_EVENT) {
        logger.info(`💓 [${this.userId}] Heartbeat received`);
        return;
      }
      
      for (const [id, pending] of this.pendingMessages.entries()) {
        if (payloadType === pending.expectedType) {
          clearTimeout(pending.timeout);
          this.pendingMessages.delete(id);
          pending.resolve(payload);
          return;
        }
      }
      
      logger.warn(`⚠️ [${this.userId}] Unhandled message type:`, payloadType);
    } catch (error) {
      logger.error(`❌ [${this.userId}] Failed to handle message:`, error);
    }
  }
  
  private handleExecutionEvent(payload: any): void {
    logger.info(`⚡ [${this.userId}] Execution event:`, payload);
    this.emit('execution', payload);
  }
  
  private handleError(payload: any): void {
    const errorCode = payload[1] || 'UNKNOWN';
    const description = payload[2] || 'Unknown error';
    
    logger.error(`❌ [${this.userId}] cTrader error:`, errorCode, description);
    
    for (const [id, pending] of this.pendingMessages.entries()) {
      pending.reject(new Error(`${errorCode}: ${description}`));
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(id);
    }
    
    this.emit('error', { errorCode, description });
  }
  
  private async sendAndWait(
    payloadType: number,
    payload: any,
    expectedResponseType: number,
    timeoutMs: number = CTRADER_TIMEOUTS.DEFAULT
  ): Promise<any> {
    if (!this.conn) {
      throw new CTraderConnectionError(
        'TCP connection not established',
        {
          operation: 'sendAndWait',
          userId: this.userId,
          payloadType,
          timestamp: Date.now(),
        }
      );
    }
    
    const messageId = `${Date.now()}_${this.messageCounter++}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new CTraderMessageError(
          `Message timeout after ${timeoutMs}ms`,
          {
            operation: 'sendAndWait',
            userId: this.userId,
            payloadType,
            expectedResponseType,
            timeoutMs,
            timestamp: Date.now(),
          },
          { isRetryable: true }
        ));
      }, timeoutMs);
      
      this.pendingMessages.set(messageId, {
        resolve,
        reject,
        timeout,
        timestamp: Date.now(),
        expectedType: expectedResponseType,
      });
      
      try {
        const protoMessage = SimpleProtoEncoder.encodeMessage(payloadType, payload);
        
        logger.hexDump(`📤 [${this.userId}] Sending message type ${payloadType}`, protoMessage, 100);
        
        this.conn!.write(protoMessage);
        logger.info(`📤 [${this.userId}] Sent message type:`, { payloadType, length: protoMessage.length });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingMessages.delete(messageId);
        reject(new CTraderMessageError(
          'Failed to send message',
          {
            operation: 'sendAndWait',
            userId: this.userId,
            payloadType,
            originalError: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          },
          { isRetryable: true }
        ));
      }
    });
  }
  
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected() && this.conn) {
        try {
          const heartbeatMessage = SimpleProtoEncoder.encodeMessage(
            ProtoOAPayloadType.PROTO_OA_HEARTBEAT_EVENT,
            {}
          );
          this.conn.write(heartbeatMessage);
          this.lastHeartbeat = Date.now();
          logger.info(`💓 [${this.userId}] Heartbeat sent`);
        } catch (error) {
          logger.error(`❌ [${this.userId}] Heartbeat failed:`, error);
        }
      }
    }, CTraderDefaults.HEARTBEAT_INTERVAL_MS);
    
    logger.info(`💓 [${this.userId}] Heartbeat monitoring started`);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }
  
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          logger.error(`❌ [${this.userId}] Event listener error:`, error);
        }
      }
    }
  }
  
  async getAccountInfo(): Promise<AccountInfo> {
    const traderPayload = {
      1: parseInt(this.config.accountId),
    };
    
    try {
      const response = await this.sendAndWait(
        ProtoOAPayloadType.PROTO_OA_TRADER_REQ,
        traderPayload,
        ProtoOAPayloadType.PROTO_OA_TRADER_RES,
        10000
      );
      
      const trader = response[1] || response;
      
      this.accountData = {
        balance: (trader[3] || 0) / 100,
        equity: (trader[3] || 0) / 100,
        currency: trader[7] || 'USD',
        isLive: !this.config.endpoint.includes('demo'),
        freeMargin: 0,
        margin: 0,
        marginLevel: 0,
      };
      
      return this.accountData;
    } catch (error) {
      logger.error(`❌ [${this.userId}] Failed to get account info:`, error);
      throw error;
    }
  }
  
  async getPositions(): Promise<Position[]> {
    const reconcilePayload = {
      1: parseInt(this.config.accountId),
    };
    
    try {
      const response = await this.sendAndWait(
        ProtoOAPayloadType.PROTO_OA_RECONCILE_REQ,
        reconcilePayload,
        ProtoOAPayloadType.PROTO_OA_RECONCILE_RES,
        10000
      );
      
      const positions: Position[] = [];
      const positionArray = response[2] || [];
      
      if (Array.isArray(positionArray)) {
        for (const pos of positionArray) {
          positions.push(this.parsePosition(pos));
        }
      }
      
      return positions;
    } catch (error) {
      logger.error(`❌ [${this.userId}] Failed to get positions:`, error);
      return [];
    }
  }
  
  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }
  
  private parsePosition(data: any): Position {
    return {
      positionId: data[1] || 0,
      symbol: 'UNKNOWN',
      symbolId: data[2] || 0,
      direction: data[3] === 1 ? 'BUY' : 'SELL',
      volume: data[4] || 0,
      entryPrice: (data[5] || 0) / 100000,
      currentPrice: (data[6] || 0) / 100000,
      stopLoss: data[11] ? data[11] / 100000 : undefined,
      takeProfit: data[12] ? data[12] / 100000 : undefined,
      unrealizedPnL: (data[7] || 0) / 100,
      swap: (data[8] || 0) / 100,
      commission: (data[9] || 0) / 100,
      netPnL: ((data[7] || 0) + (data[8] || 0) - (data[9] || 0)) / 100,
      openTimestamp: data[10] || Date.now(),
    };
  }
}
