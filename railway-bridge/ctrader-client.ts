/**
 * cTrader WebSocket Client with ProtoOA Protocol Implementation
 * 
 * Handles:
 * - WebSocket connection management
 * - Protocol Buffers encoding/decoding
 * - Authentication flow (Application + Account)
 * - Message request/response correlation
 */

import { 
  ProtoOAPayloadType,
  type ApplicationAuthReq,
  type AccountAuthReq,
  type GetAccountsByAccessTokenReq,
  type TraderReq,
  type SymbolsListReq,
  type ReconcileReq,
  type NewOrderReq,
  type AmendPositionSLTPReq,
  type ClosePositionReq,
  ProtoOAOrderType,
  ProtoOATradeSide,
} from './proto-messages.ts';
import { protoLoader } from './proto-loader.ts';

export interface CTraderCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  accountId: string;
  isDemo: boolean;
}

// ✅ CRITICAL FIX: Make spot cache GLOBAL so it's shared across all client instances
// This fixes the issue where spot events on Client A are not visible to Client B
// Exporting it so server.ts can access it for the audit endpoint
export const globalSpotCache = new Map<string, Map<number, { bid: number; ask: number; timestamp: number }>>();
// REMOVED: globalSubscribedSymbols - Subscriptions must be per-connection to ensure liveness
// const globalSubscribedSymbols = new Map<string, Set<number>>();

function getGlobalCacheKey(isDemo: boolean, accountId: string): string {
  // ✅ SHARED QUOTE FEED OPTIMIZATION:
  // Use a simpler cache key that ignores accountId for market data.
  // This allows User B to benefit from quotes subscribed by User A.
  // We assume price feeds are consistent per environment (Demo vs Live).
  return `${isDemo ? 'demo' : 'live'}_shared_feed`;
}

export class CTraderClient {
  private ws: WebSocket | null = null;
  private host: string;
  private port: number;
  private appAuthenticated = false;
  private accountAuthenticated = false;
  private messageId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: number;
  }>();
  private heartbeatInterval: number | null = null;
  private lastActivityTimestamp = 0; // ✅ PHASE 3: Track last message activity for smart heartbeat
  private accessToken: string = ''; // ✅ Initialize with empty string
  private cacheKey: string; // ✅ Key for global cache
  private symbolMetadata = new Map<number, { digits: number; name: string }>(); // ✅ Cache symbol metadata for price transformation
  
  // ✅ Subscriptions are now tracked per-connection to ensure we actually receive events
  private _subscribedSymbols = new Set<number>();

  constructor(isDemo: boolean, accountId?: string) {
    this.host = isDemo ? 'demo.ctraderapi.com' : 'live.ctraderapi.com';
    this.port = 5035;
    this.cacheKey = getGlobalCacheKey(isDemo, accountId || 'unknown');
    
    // ✅ Initialize global cache for this account if it doesn't exist
    if (!globalSpotCache.has(this.cacheKey)) {
      globalSpotCache.set(this.cacheKey, new Map());
    }
  }
  
  // ✅ Helper methods to access global cache
  private get spotCache(): Map<number, { bid: number; ask: number; timestamp: number }> {
    return globalSpotCache.get(this.cacheKey)!;
  }
  
  private get subscribedSymbols(): Set<number> {
    return this._subscribedSymbols;
  }

  /**
   * Initialize Protocol Buffers
   */
  async initialize(): Promise<void> {
    await protoLoader.load();
    console.log('[CTraderClient] ✅ Protocol Buffers initialized');
  }

  /**
   * Connect to cTrader WebSocket server
   */
  async connect(): Promise<void> {
    const url = `wss://${this.host}:${this.port}`;
    console.log(`[CTraderClient] 🔌 Connecting to ${url}...`);
    console.log(`[CTraderClient] Environment: ${this.host.includes('demo') ? 'DEMO' : 'LIVE'}`);
    
    return new Promise((resolve, reject) => {
      let connectionEstablished = false;
      
      const timeout = setTimeout(() => {
        if (!connectionEstablished) {
          console.error(`[CTraderClient] ❌ Connection timeout after 15s`);
          this.disconnect();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 15000); // 15s timeout (increased from 10s)

      try {
        console.log(`[CTraderClient] Creating WebSocket...`);
        this.ws = new WebSocket(url);
        console.log(`[CTraderClient] WebSocket created, state: ${this.ws.readyState}`);

        this.ws.binaryType = 'arraybuffer';
        console.log(`[CTraderClient] Binary type set to: ${this.ws.binaryType}`);

        this.ws.onopen = () => {
          connectionEstablished = true;
          clearTimeout(timeout);
          console.log(`[CTraderClient] ✅ WebSocket connected!`);
          console.log(`[CTraderClient] ReadyState: ${this.ws?.readyState} (OPEN=1)`);
          this.startHeartbeat();
          resolve();
        };

        this.ws.onerror = (error: Event) => {
          clearTimeout(timeout);
          console.error(`[CTraderClient] ❌ WebSocket error:`, error);
          if (!connectionEstablished) {
            reject(new Error(`WebSocket error: ${error.type}`));
          }
        };

        this.ws.onclose = (event: CloseEvent) => {
          clearTimeout(timeout);
          console.log(`[CTraderClient] 🔌 WebSocket closed (code: ${event.code})`);
          this.cleanup();
          
          if (!connectionEstablished) {
            reject(new Error(`WebSocket closed before connection (code: ${event.code})`));
          }
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        clearTimeout(timeout);
        console.error(`[CTraderClient] ❌ Failed to create WebSocket:`, error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from cTrader
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return !!(
      this.ws && 
      this.ws.readyState === WebSocket.OPEN &&
      this.appAuthenticated
    );
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.appAuthenticated = false;
    this.accountAuthenticated = false;
    
    // ✅ DO NOT CLEAR GLOBAL CACHE - it's shared across all client instances!
    // The global cache should persist even when individual connections close.
    // Subscriptions are per-connection and will be dropped (correctly).
    console.log(`[CTraderClient] 🧹 Cleanup - dropping ${this.subscribedSymbols.size} active subscriptions, keeping ${this.spotCache.size} cached prices`);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Reject all pending requests
    for (const [msgId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
      this.pendingRequests.delete(msgId);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send heartbeat
        // console.log(`[CTraderClient] 💓 Sending heartbeat...`);
        const heartbeat = this.encodeMessage(ProtoOAPayloadType.HEARTBEAT_EVENT, {});
        this.ws.send(heartbeat);
      }
    }, 25000); // Every 25 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * ✅ NEW: Send manual heartbeat (for use during long waits)
   * This keeps the connection alive when waiting for spot events
   */
  private async sendManualHeartbeat(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const heartbeat = this.encodeMessage(ProtoOAPayloadType.HEARTBEAT_EVENT, {});
      this.ws.send(heartbeat);
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: ArrayBuffer): void {
    try {
      // Decode ProtoMessage wrapper using protoLoader
      const buffer = new Uint8Array(data);
      const decoded = protoLoader.decodeMessage(buffer);
      const { payloadType, payload, clientMsgId } = decoded;
      
      // Handle heartbeat
      if (payloadType === 51) { // HEARTBEAT_EVENT
        return; // Ignore heartbeat responses
      }
      
      // ✅ CRITICAL FIX: Handle PROTO_OA_SPOT_EVENT and cache quote data
      if (payloadType === ProtoOAPayloadType.PROTO_OA_SPOT_EVENT) {
        
        // ✅ JSON Structured Logging: Spot Event Received
        console.log(JSON.stringify({
          event: 'spot_event_received',
          timestamp: new Date().toISOString(),
          symbolId: payload.symbolId,
          payload_keys: Object.keys(payload)
        }));
        
        if (payload.symbolId && (payload.bid !== undefined || payload.ask !== undefined)) {
          const symbolId = payload.symbolId;
          
          // ✅ CRITICAL FIX: Merge partial spot events instead of overwriting
          const existing = this.spotCache.get(symbolId) || { bid: 0, ask: 0, timestamp: 0 };
          const bid = payload.bid !== undefined ? payload.bid : existing.bid;
          const ask = payload.ask !== undefined ? payload.ask : existing.ask;
          
          // Cache the quote data
          this.spotCache.set(symbolId, {
            bid,
            ask,
            timestamp: Date.now(),
          });
          
          // ✅ JSON Structured Logging: Quote Cache Write
          console.log(JSON.stringify({
            event: 'quote_cache_write',
            timestamp: new Date().toISOString(),
            symbolId: symbolId,
            bid: bid,
            ask: ask
          }));
          
        }
        return; // Spot events don't have matching requests
      }
      
      // Check for error responses
      if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
        console.error('[CTraderClient] ❌ Error Response:', payload);
      }
      
      // Find pending request
      if (clientMsgId && this.pendingRequests.has(clientMsgId)) {
        const request = this.pendingRequests.get(clientMsgId)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(clientMsgId);
        
        // Check for errors
        if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
          request.reject(new Error(`cTrader Error: ${payload.errorCode} - ${payload.description}`));
        } else {
          request.resolve(payload);
        }
      }
      
    } catch (error) {
      console.error('[CTraderClient] ❌ Message handling error:', error);
    }
  }

  /**
   * Send request and wait for response
   */
  private async sendRequest<T>(payloadType: number, payload: any, timeoutMs = 30000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection closed - WebSocket not connected');
    }
    
    // Check auth for non-auth messages
    const isAuthMessage = 
      payloadType === ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ || 
      payloadType === ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ ||     
      payloadType === ProtoOAPayloadType.PROTO_OA_VERSION_REQ;            
    
    if (!this.appAuthenticated && !isAuthMessage) {
      throw new Error('Connection closed - Not authenticated');
    }

    return new Promise((resolve, reject) => {
      const msgId = `msg_${++this.messageId}_${Date.now()}`;
      const encodedMessage = this.encodeMessage(payloadType, payload, msgId);
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(msgId);
        reject(new Error(`Request timeout (${timeoutMs}ms)`));
      }, timeoutMs);
      
      this.pendingRequests.set(msgId, { resolve, reject, timeout });
      
      this.ws!.send(encodedMessage);
    });
  }

  /**
   * Encode message with Protocol Buffers
   */
  private encodeMessage(payloadType: number, payload: any, clientMsgId?: string): Uint8Array {
    return protoLoader.encodeMessage(payloadType, payload, clientMsgId);
  }

  /**
   * Authenticate application
   */
  async authenticateApp(clientId: string, clientSecret: string): Promise<void> {
    if (this.appAuthenticated) return;
    
    const request: ApplicationAuthReq = { clientId, clientSecret };
    await this.sendRequest(ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ, request);
    this.appAuthenticated = true;
  }

  /**
   * Authenticate account
   */
  async authenticateAccount(accountId: string, accessToken: string): Promise<void> {
    if (!this.appAuthenticated) throw new Error('Application not authenticated');
    
    this.accessToken = accessToken;
    if (this.accountAuthenticated) return;

    const request: AccountAuthReq = {
      ctidTraderAccountId: parseInt(accountId),
      accessToken,
    };
    
    await this.sendRequest(ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ, request);
    this.accountAuthenticated = true;
  }

  /**
   * Get accounts by access token
   */
  async getAccounts(accessToken: string): Promise<any> {
    if (!this.appAuthenticated) throw new Error('Application not authenticated');
    return await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
      { accessToken }
    );
  }

  /**
   * Get trader (account) info
   */
  async getTrader(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) throw new Error('Account not authenticated');
    return await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_TRADER_REQ,
      { ctidTraderAccountId: parseInt(accountId) }
    );
  }

  /**
   * Get symbols list
   */
  async getSymbols(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) throw new Error('Account not authenticated');
    
    return await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_SYMBOLS_LIST_REQ,
      { ctidTraderAccountId: parseInt(accountId) },
      60000 
    );
  }

  /**
   * Get positions (via reconcile)
   */
  async getPositions(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) throw new Error('Account not authenticated');
    
    return await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_RECONCILE_REQ,
      { ctidTraderAccountId: parseInt(accountId) },
      45000
    );
  }

  /**
   * Place a new order
   */
  async placeOrder(accountId: string, symbolId: number, orderType: ProtoOAOrderType, tradeSide: ProtoOATradeSide, volume: number, price: number): Promise<any> {
    // Implementation omitted for brevity in this focused update, but kept method signature
     const request: NewOrderReq = {
      ctidTraderAccountId: parseInt(accountId),
      symbolId,
      orderType,
      tradeSide,
      volume,
      price,
    };
    return await this.sendRequest(ProtoOAPayloadType.PROTO_OA_NEW_ORDER_REQ, request);
  }
  
  // Re-adding helper methods used by server.ts
  async placeMarketOrder(params: any): Promise<any> {
      const request = {
      ctidTraderAccountId: parseInt(params.accountId),
      symbolId: params.symbolId,
      orderType: ProtoOAOrderType.MARKET,
      tradeSide: params.tradeSide === 'BUY' ? ProtoOATradeSide.BUY : ProtoOATradeSide.SELL,
      volume: Math.round(params.volume),
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
    };
    return await this.sendRequest(ProtoOAPayloadType.PROTO_OA_NEW_ORDER_REQ, request);
  }

  /**
   * Helper: Get symbol ID from symbol name
   */
  async getSymbolId(accountId: string, symbolName: string): Promise<number> {
    const symbolsData = await this.getSymbols(accountId);
    const symbol = symbolsData.symbol?.find((s: any) => s.symbolName === symbolName);
    
    if (!symbol) {
      throw new Error(`Symbol not found: ${symbolName}`);
    }
    
    return symbol.symbolId;
  }

  /**
   * Subscribe to spot events (real-time quotes)
   */
  async subscribeToSpotEvent(accountId: string, symbolId: number): Promise<any> {
    // ✅ JSON Structured Logging: Check Cache
    console.log(JSON.stringify({
      event: 'quote_cache_check',
      timestamp: new Date().toISOString(),
      symbolId: symbolId,
      cacheKey: this.cacheKey
    }));

    // ✅ Check connection health FIRST
    if (!this.ws || this.ws.readyState !== 1) { 
      throw new Error('WebSocket not connected - cannot subscribe to spot events');
    }
    
    // ✅ Check cache FIRST
    const cachedQuote = this.spotCache.get(symbolId);
    if (cachedQuote && cachedQuote.bid > 0 && cachedQuote.ask > 0) {
      console.log(JSON.stringify({
        event: 'quote_cache_hit',
        timestamp: new Date().toISOString(),
        symbolId: symbolId
      }));
      return {
        bid: cachedQuote.bid,
        ask: cachedQuote.ask,
        timestamp: cachedQuote.timestamp,
      };
    }
    
    // ✅ Check if already subscribed
    if (this.subscribedSymbols.has(symbolId)) {
      // Wait logic...
      const maxWait = 5000;
      const start = Date.now();
      
      console.log(JSON.stringify({
        event: 'poll_loop_started',
        timestamp: new Date().toISOString(),
        symbolId: symbolId,
        reason: 'already_subscribed'
      }));

      while (Date.now() - start < maxWait) {
        if (!this.ws || this.ws.readyState !== 1) throw new Error('WS Disconnected');
        
        const cached = this.spotCache.get(symbolId);
        if (cached && cached.bid > 0 && cached.ask > 0) {
          return { bid: cached.bid, ask: cached.ask, timestamp: cached.timestamp };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Fallback
      return { bid: 0, ask: 0, timestamp: Date.now(), marketClosed: true };
    }
    
    // ✅ Not subscribed, send subscription
    const request = {
      ctidTraderAccountId: parseInt(accountId),
      symbolId: [symbolId],
    };
    
    console.log(JSON.stringify({
      event: 'subscribe_spots_req_sent',
      timestamp: new Date().toISOString(),
      symbolId: symbolId
    }));
    
    await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_SUBSCRIBE_SPOTS_REQ,
      request
    );
    
    console.log(JSON.stringify({
      event: 'subscribe_spots_res_received',
      timestamp: new Date().toISOString(),
      symbolId: symbolId
    }));
    
    this.subscribedSymbols.add(symbolId);
    
    // ✅ Poll for tick
    console.log(JSON.stringify({
        event: 'poll_loop_started',
        timestamp: new Date().toISOString(),
        symbolId: symbolId,
        reason: 'new_subscription'
      }));
      
    const maxWait = 10000;
    const start = Date.now();
    let lastHeartbeat = Date.now();
    let pollCount = 0;
    
    while (Date.now() - start < maxWait) {
      pollCount++;
      if (Date.now() - lastHeartbeat > 3000) {
        await this.sendManualHeartbeat();
        lastHeartbeat = Date.now();
      }
      
      if (!this.ws || this.ws.readyState !== 1) {
         // Return cached if available
         const cached = this.spotCache.get(symbolId);
         if (cached && (cached.bid > 0 || cached.ask > 0)) {
           return { ...cached, _connectionLost: true };
         }
         throw new Error('WS Disconnected');
      }
      
      const cached = this.spotCache.get(symbolId);
      if (cached && cached.bid > 0 && cached.ask > 0) {
         console.log(JSON.stringify({
          event: 'poll_loop_completed',
          timestamp: new Date().toISOString(),
          symbolId: symbolId,
          pollCount: pollCount,
          elapsedMs: Date.now() - start,
          success: true
        }));
        return { bid: cached.bid, ask: cached.ask, timestamp: cached.timestamp };
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ✅ Timeout
    console.log(JSON.stringify({
      event: 'quote_timeout_fallback_returned',
      timestamp: new Date().toISOString(),
      symbolId: symbolId,
      elapsedMs: Date.now() - start
    }));
    
    const cached = this.spotCache.get(symbolId);
    if (cached && (cached.bid > 0 || cached.ask > 0)) {
        return { ...cached, _timeout: true };
    }

    return {
      bid: 0,
      ask: 0,
      timestamp: Date.now(),
      marketClosed: true, 
    };
  }
}
