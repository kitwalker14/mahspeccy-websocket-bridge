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
const globalSpotCache = new Map<string, Map<number, { bid: number; ask: number; timestamp: number }>>();
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
          console.error(`[CTraderClient] Error type:`, error.type);
          console.error(`[CTraderClient] ReadyState: ${this.ws?.readyState}`);
          if (!connectionEstablished) {
            reject(new Error(`WebSocket error: ${error.type}`));
          }
        };

        this.ws.onclose = (event: CloseEvent) => {
          clearTimeout(timeout);
          console.log(`[CTraderClient] 🔌 WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'}, clean: ${event.wasClean})`);
          
          // ✅ CRITICAL: Log detailed close information for debugging
          console.error(`[CTraderClient] ❌ ========== WEBSOCKET CLOSED ==========`);
          console.error(`[CTraderClient] Close Code: ${event.code}`);
          console.error(`[CTraderClient] Close Reason: ${event.reason || 'No reason provided'}`);
          console.error(`[CTraderClient] Was Clean: ${event.wasClean}`);
          console.error(`[CTraderClient] Authenticated: app=${this.appAuthenticated}, account=${this.accountAuthenticated}`);
          console.error(`[CTraderClient] Subscribed Symbols: [${Array.from(this.subscribedSymbols).join(', ')}]`);
          console.error(`[CTraderClient] Pending Requests: ${this.pendingRequests.size}`);
          console.error(`[CTraderClient] ❌ ========== WEBSOCKET CLOSED END ==========`);
          
          this.cleanup();
          
          // If connection not yet established, reject the connection promise
          if (!connectionEstablished) {
            reject(new Error(`WebSocket closed before connection (code: ${event.code}, reason: ${event.reason || 'none'})`));
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
    console.log('[CTraderClient] 💓 ========== HEARTBEAT STARTED ==========');
    console.log('[CTraderClient] 💓 Interval: 25000ms (25 seconds)');
    console.log('[CTraderClient] 💓 Purpose: Keep connection alive (cTrader closes idle connections after 30s)');
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send heartbeat
        const timestamp = new Date().toISOString();
        console.log(`[CTraderClient] 💓 Sending heartbeat (${timestamp})...`);
        
        const heartbeat = this.encodeMessage(ProtoOAPayloadType.HEARTBEAT_EVENT, {});
        this.ws.send(heartbeat);
        
        console.log(`[CTraderClient] 💓 Heartbeat sent successfully`);
      } else {
        console.warn(`[CTraderClient] ⚠️ Cannot send heartbeat - WebSocket not open (state: ${this.ws?.readyState})`);
      }
    }, 25000); // Every 25 seconds
    
    console.log('[CTraderClient] 💓 ========== HEARTBEAT STARTED END ==========');
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      console.log('[CTraderClient] 💔 Stopping heartbeat...');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[CTraderClient] 💔 Heartbeat stopped');
    }
  }

  /**
   * ✅ NEW: Send manual heartbeat (for use during long waits)
   * This keeps the connection alive when waiting for spot events
   */
  private async sendManualHeartbeat(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[CTraderClient] ⚠️ Cannot send manual heartbeat - WebSocket not open (state: ${this.ws?.readyState})`);
      return;
    }
    
    try {
      const heartbeat = this.encodeMessage(ProtoOAPayloadType.HEARTBEAT_EVENT, {});
      this.ws.send(heartbeat);
      console.log(`[CTraderClient] 💓 Manual heartbeat sent during wait`);
    } catch (error) {
      console.warn(`[CTraderClient] ⚠️ Manual heartbeat failed:`, error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: ArrayBuffer): void {
    try {
      // Decode ProtoMessage wrapper using protoLoader
      const buffer = new Uint8Array(data);
      
      // ✅ PHASE 1 DIAGNOSTIC: Enhanced incoming message logging
      const timestamp = new Date().toISOString();
      console.log(`[CTraderClient] 📥 ========== INCOMING MESSAGE (${timestamp}) ==========`);
      console.log(`[CTraderClient] 📦 Message size: ${buffer.length} bytes`);
      console.log(`[CTraderClient] 🔍 First 20 bytes (hex):`, Array.from(buffer.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      const decoded = protoLoader.decodeMessage(buffer);
      const { payloadType, payload, clientMsgId } = decoded;
      
      // ✅ PHASE 1 DIAGNOSTIC: Detailed message type logging
      const messageTypeName = this.getMessageTypeName(payloadType);
      console.log(`[CTraderClient] 📨 Message Type: ${messageTypeName} (payloadType: ${payloadType})`);
      console.log(`[CTraderClient] 🆔 Client Message ID: ${clientMsgId || 'none'}`);
      console.log(`[CTraderClient] 📦 Payload keys:`, Object.keys(payload || {}));
      console.log(`[CTraderClient] 📊 Connection State: WebSocket=${this.ws?.readyState} (1=OPEN), App Auth=${this.appAuthenticated}, Account Auth=${this.accountAuthenticated}`);
      
      // Handle heartbeat
      if (payloadType === 51) { // HEARTBEAT_EVENT
        console.log('[CTraderClient] 💓 Heartbeat received - connection alive');
        return; // Ignore heartbeat responses
      }
      
      // ✅ CRITICAL FIX: Handle PROTO_OA_SPOT_EVENT and cache quote data
      if (payloadType === ProtoOAPayloadType.PROTO_OA_SPOT_EVENT) {
        console.log('[CTraderClient] 💰 ========== SPOT EVENT RECEIVED ==========');
        console.log('[CTraderClient] 💰 Full payload:', JSON.stringify(payload, null, 2));
        
        if (payload.symbolId && (payload.bid !== undefined || payload.ask !== undefined)) {
          const symbolId = payload.symbolId;
          
          // ✅ CRITICAL FIX: Merge partial spot events instead of overwriting
          // cTrader sends partial updates (bid-only or ask-only) - we must preserve the other value
          const existing = this.spotCache.get(symbolId) || { bid: 0, ask: 0, timestamp: 0 };
          const bid = payload.bid !== undefined ? payload.bid : existing.bid;
          const ask = payload.ask !== undefined ? payload.ask : existing.ask;
          
          // ✅ PHASE 1 DIAGNOSTIC: Log spot event details
          console.log(`[CTraderClient] 💰 Symbol ID: ${symbolId}`);
          console.log(`[CTraderClient] 💰 Bid: ${payload.bid !== undefined ? payload.bid + ' (new)' : existing.bid + ' (cached)'}`);
          console.log(`[CTraderClient] 💰 Ask: ${payload.ask !== undefined ? payload.ask + ' (new)' : existing.ask + ' (cached)'}`);
          console.log(`[CTraderClient] 💰 Timestamp: ${payload.timestamp || 'none'}`);
          console.log(`[CTraderClient] 💰 Trendbar count: ${payload.trendbar?.length || 0}`);
          
          // Cache the quote data
          this.spotCache.set(symbolId, {
            bid,
            ask,
            timestamp: Date.now(),
          });
          
          console.log(`[CTraderClient] ✅ Cached spot data for symbolId=${symbolId}: bid=${bid}, ask=${ask}`);
          console.log(`[CTraderClient] 📊 Total cached symbols: ${this.spotCache.size}`);
        } else {
          console.warn(`[CTraderClient] ⚠️ Spot event missing symbolId or bid/ask data`);
        }
        console.log('[CTraderClient] 💰 ========== SPOT EVENT END ==========');
        return; // Spot events don't have matching requests
      }
      
      // Check for error responses
      if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
        console.error('[CTraderClient] ❌ ========== ERROR RESPONSE ==========');
        console.error('[CTraderClient] ❌ Error Code:', payload.errorCode);
        console.error('[CTraderClient] ❌ Description:', payload.description);
        console.error('[CTraderClient] ❌ Full payload:', JSON.stringify(payload, null, 2));
        console.error('[CTraderClient] ❌ ========== ERROR RESPONSE END ==========');
      }
      
      // Find pending request
      if (clientMsgId && this.pendingRequests.has(clientMsgId)) {
        const request = this.pendingRequests.get(clientMsgId)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(clientMsgId);
        
        console.log(`[CTraderClient] ✅ Matched pending request: ${clientMsgId}`);
        console.log(`[CTraderClient] 📊 Remaining pending requests: ${this.pendingRequests.size}`);
        
        // Check for errors
        if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
          request.reject(new Error(`cTrader Error: ${payload.errorCode} - ${payload.description}`));
        } else {
          request.resolve(payload);
        }
      } else if (clientMsgId) {
        console.warn(`[CTraderClient] ⚠️ No pending request for msgId: ${clientMsgId}`);
        console.warn(`[CTraderClient] 📋 Pending requests:`, Array.from(this.pendingRequests.keys()));
      }
      
      console.log(`[CTraderClient] 📥 ========== MESSAGE PROCESSING COMPLETE ==========\n`);
    } catch (error) {
      console.error('[CTraderClient] ❌ ========== MESSAGE HANDLING ERROR ==========');
      console.error('[CTraderClient] ❌ Error:', error);
      console.error('[CTraderClient] ❌ Stack:', error.stack);
      console.error('[CTraderClient] ❌ ========== MESSAGE HANDLING ERROR END ==========');
      
      // If decode fails for a critical message, this connection may be stale/invalid
      // The connectionPool will handle cleanup when the request times out
    }
  }

  /**
   * Send request and wait for response
   */
  private async sendRequest<T>(payloadType: number, payload: any, timeoutMs = 30000): Promise<T> {
    // ✅ Enhanced health check - verify WebSocket is actually connected and authenticated
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection closed - WebSocket not connected');
    }
    
    // ✅ CRITICAL FIX: Allow authentication messages through even when not authenticated
    // This prevents the chicken-and-egg problem where auth messages are blocked because we're not authenticated yet
    const isAuthMessage = 
      payloadType === ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ || // 2100 - App auth
      payloadType === ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ ||     // 2102 - Account auth
      payloadType === ProtoOAPayloadType.PROTO_OA_VERSION_REQ;            // 2104 - Version check
    
    // Only enforce authentication for non-auth messages
    if (!this.appAuthenticated && !isAuthMessage) {
      throw new Error('Connection closed - Not authenticated');
    }

    return new Promise((resolve, reject) => {
      const msgId = `msg_${++this.messageId}_${Date.now()}`;
      const encodedMessage = this.encodeMessage(payloadType, payload, msgId);
      
      // ✅ PHASE 1 DIAGNOSTIC: Enhanced outgoing message logging
      const timestamp = new Date().toISOString();
      const messageTypeName = this.getMessageTypeName(payloadType);
      console.log(`[CTraderClient] 📤 ========== OUTGOING MESSAGE (${timestamp}) ==========`);
      console.log(`[CTraderClient] 📨 Message Type: ${messageTypeName} (payloadType: ${payloadType})`);
      console.log(`[CTraderClient] 🆔 Client Message ID: ${msgId}`);
      console.log(`[CTraderClient] ⏱️  Timeout: ${timeoutMs}ms`);
      console.log(`[CTraderClient] 📦 Payload:`, JSON.stringify(payload, null, 2));
      console.log(`[CTraderClient] 📊 Connection State: WebSocket=${this.ws?.readyState} (1=OPEN), App Auth=${this.appAuthenticated}, Account Auth=${this.accountAuthenticated}`);
      console.log(`[CTraderClient] 📋 Pending requests before send: ${this.pendingRequests.size}`);
      
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(msgId);
        console.error(`[CTraderClient] ⏰ ========== REQUEST TIMEOUT ==========`);
        console.error(`[CTraderClient] ⏰ Message: ${messageTypeName} (${msgId})`);
        console.error(`[CTraderClient] ⏰ Timeout: ${timeoutMs}ms`);
        console.error(`[CTraderClient] ⏰ Connection state: ${this.ws?.readyState}`);
        console.error(`[CTraderClient] ⏰ ========== REQUEST TIMEOUT END ==========`);
        reject(new Error(`Request timeout (${timeoutMs}ms): ${messageTypeName}`));
      }, timeoutMs);
      
      // Store pending request
      this.pendingRequests.set(msgId, { resolve, reject, timeout });
      
      // Send message
      console.log(`[CTraderClient] 🚀 Sending message... (Encoded size: ${encodedMessage.length} bytes)`);
      this.ws!.send(encodedMessage);
      console.log(`[CTraderClient] ✅ Message sent successfully`);
      console.log(`[CTraderClient] 📤 ========== OUTGOING MESSAGE END ==========\n`);
    });
  }

  /**
   * Encode message with Protocol Buffers
   */
  private encodeMessage(payloadType: number, payload: any, clientMsgId?: string): Uint8Array {
    return protoLoader.encodeMessage(payloadType, payload, clientMsgId);
  }

  /**
   * Get message type name for logging
   */
  private getMessageTypeName(payloadType: number): string {
    return ProtoOAPayloadType[payloadType] || `UNKNOWN_${payloadType}`;
  }

  /**
   * Authenticate application
   */
  async authenticateApp(clientId: string, clientSecret: string): Promise<void> {
    if (this.appAuthenticated) {
      return; // Already authenticated
    }

    console.log('[CTraderClient] Authenticating application...');
    
    const request: ApplicationAuthReq = {
      clientId,
      clientSecret,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ,
      request
    );
    
    this.appAuthenticated = true;
    console.log('[CTraderClient] ✅ Application authenticated');
  }

  /**
   * Authenticate account
   */
  async authenticateAccount(accountId: string, accessToken: string): Promise<void> {
    if (!this.appAuthenticated) {
      throw new Error('Application not authenticated');
    }
    
    // Store accessToken even if already authenticated (for reused connections)
    this.accessToken = accessToken;
    
    if (this.accountAuthenticated) {
      console.log('[CTraderClient] ⚡ Account already authenticated, accessToken refreshed');
      return; // Already authenticated
    }

    console.log('[CTraderClient] Authenticating account...');
    
    const request: AccountAuthReq = {
      ctidTraderAccountId: parseInt(accountId),
      accessToken,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ,
      request
    );
    
    this.accountAuthenticated = true;
    console.log('[CTraderClient] ✅ Account authenticated');
  }

  /**
   * Get accounts by access token
   */
  async getAccounts(accessToken: string): Promise<any> {
    if (!this.appAuthenticated) {
      throw new Error('Application not authenticated');
    }

    console.log('[CTraderClient] Fetching accounts...');
    
    const request: GetAccountsByAccessTokenReq = {
      accessToken,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
      request
    );
    
    return response;
  }

  /**
   * Get trader (account) info
   */
  async getTrader(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Fetching trader info...');
    
    const request: TraderReq = {
      ctidTraderAccountId: parseInt(accountId),
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_TRADER_REQ,
      request
    );
    
    return response;
  }

  /**
   * Get symbols list
   */
  async getSymbols(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) {
      console.error('[CTraderClient] ❌ Cannot fetch symbols - account not authenticated!');
      console.error('[CTraderClient] App authenticated:', this.appAuthenticated);
      console.error('[CTraderClient] Account authenticated:', this.accountAuthenticated);
      throw new Error('Account not authenticated - must call fullAuth() first');
    }

    console.log('[CTraderClient] 🔍 Fetching symbols for account:', accountId);
    console.log('[CTraderClient] Authentication state: app=' + this.appAuthenticated + ', account=' + this.accountAuthenticated);
    
    const request: SymbolsListReq = {
      ctidTraderAccountId: parseInt(accountId),
      // NOTE: accessToken is NOT included in SymbolsListReq per official cTrader proto schema
      // The session is already authenticated via AccountAuthReq
    };
    
    console.log('[CTraderClient] 📋 Request:', JSON.stringify(request, null, 2));
    console.log('[CTraderClient] 🚀 Sending PROTO_OA_SYMBOLS_LIST_REQ...');
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_SYMBOLS_LIST_REQ,
      request,
      60000 // 60s timeout for symbols (large response)
    );
    
    console.log('[CTraderClient] ✅ Symbols fetched successfully');
    return response;
  }

  /**
   * Get positions (via reconcile)
   */
  async getPositions(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Fetching positions...');
    
    const request: ReconcileReq = {
      ctidTraderAccountId: parseInt(accountId),
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_RECONCILE_REQ,
      request,
      45000 // 45s timeout for positions
    );
    
    return response;
  }

  /**
   * Place a new order
   */
  async placeOrder(accountId: string, symbolId: number, orderType: ProtoOAOrderType, tradeSide: ProtoOATradeSide, volume: number, price: number): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Placing new order...');
    
    const request: NewOrderReq = {
      ctidTraderAccountId: parseInt(accountId),
      symbolId,
      orderType,
      tradeSide,
      volume,
      price,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_NEW_ORDER_REQ,
      request,
      30000 // 30s timeout for order placement
    );
    
    return response;
  }

  /**
   * Amend position SL/TP
   */
  async amendPositionSLTP(accountId: string, positionId: number, stopLoss: number, takeProfit: number): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Amending position SL/TP...');
    
    const request: AmendPositionSLTPReq = {
      ctidTraderAccountId: parseInt(accountId),
      positionId,
      stopLoss,
      takeProfit,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_AMEND_POSITION_SL_TP_REQ,
      request,
      30000 // 30s timeout for amendment
    );
    
    return response;
  }

  /**
   * Close position
   */
  async closePosition(accountId: string, positionId: number): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Closing position...');
    
    const request: ClosePositionReq = {
      ctidTraderAccountId: parseInt(accountId),
      positionId,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_CLOSE_POSITION_REQ,
      request,
      30000 // 30s timeout for closure
    );
    
    return response;
  }

  /**
   * Full authentication flow
   */
  async fullAuth(credentials: CTraderCredentials): Promise<void> {
    console.log('[CTraderClient] ========== FULL AUTHENTICATION FLOW START ==========');
    
    // Step 1: Application Authentication
    console.log('[CTraderClient] 📝 Step 1: Application Authentication...');
    await this.authenticateApp(credentials.clientId, credentials.clientSecret);
    console.log('[CTraderClient] ✅ Step 1 Complete: Application authenticated');
    
    // Step 2: Account Authentication
    console.log('[CTraderClient] 📝 Step 2: Account Authentication...');
    await this.authenticateAccount(credentials.accountId, credentials.accessToken);
    console.log('[CTraderClient] ✅ Step 2 Complete: Account authenticated');
    
    // ✅ REMOVED: Proactive subscription during auth causes race conditions
    // Subscriptions will be handled on-demand by subscribeToSpotEvent() when needed
    
    console.log('[CTraderClient] ========== FULL AUTHENTICATION FLOW COMPLETE ==========');
  }

  // ============================================================================
  // HIGH-LEVEL TRADING METHODS (called by server.ts)
  // ============================================================================

  /**
   * Helper: Get symbol ID from symbol name
   */
  private async getSymbolId(accountId: string, symbolName: string): Promise<number> {
    const symbolsData = await this.getSymbols(accountId);
    const symbol = symbolsData.symbol?.find((s: any) => s.symbolName === symbolName);
    
    if (!symbol) {
      throw new Error(`Symbol not found: ${symbolName}`);
    }
    
    return symbol.symbolId;
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(params: {
    accountId: string;
    symbolId: number; // ✅ Changed from symbol (string) to symbolId (number)
    volume: number;
    tradeSide: 'BUY' | 'SELL';
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<any> {
    console.log('[CTraderClient] 📊 placeMarketOrder called:', params);
    
    // ✅ symbolId is now passed directly from server.ts, no need to lookup
    const symbolId = params.symbolId;
    console.log(`[CTraderClient] ✅ Using symbolId: ${symbolId}`);
    
    // Build request
    const request: NewOrderReq = {
      ctidTraderAccountId: parseInt(params.accountId),
      symbolId,
      orderType: ProtoOAOrderType.MARKET,
      tradeSide: params.tradeSide === 'BUY' ? ProtoOATradeSide.BUY : ProtoOATradeSide.SELL,
      volume: Math.round(params.volume), // Already in centilots from server.ts
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
    };
    
    console.log('[CTraderClient] 📤 Sending market order request:', request);
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_NEW_ORDER_REQ,
      request,
      30000 // 30s timeout
    );
    
    console.log('[CTraderClient] ✅ Market order response:', response);
    return response;
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(params: {
    accountId: string;
    symbol: string;
    volume: number;
    tradeSide: 'BUY' | 'SELL';
    limitPrice: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<any> {
    console.log('[CTraderClient] 📊 placeLimitOrder called:', params);
    
    // Get symbol ID
    const symbolId = await this.getSymbolId(params.accountId, params.symbol);
    
    // Build request
    const request: NewOrderReq = {
      ctidTraderAccountId: parseInt(params.accountId),
      symbolId,
      orderType: ProtoOAOrderType.LIMIT,
      tradeSide: params.tradeSide === 'BUY' ? ProtoOATradeSide.BUY : ProtoOATradeSide.SELL,
      volume: Math.round(params.volume), // Already in centilots
      limitPrice: params.limitPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_NEW_ORDER_REQ,
      request,
      30000
    );
    
    return response;
  }

  /**
   * Place a stop order
   */
  async placeStopOrder(params: {
    accountId: string;
    symbol: string;
    volume: number;
    tradeSide: 'BUY' | 'SELL';
    stopPrice: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<any> {
    console.log('[CTraderClient] 📊 placeStopOrder called:', params);
    
    // Get symbol ID
    const symbolId = await this.getSymbolId(params.accountId, params.symbol);
    
    // Build request
    const request: NewOrderReq = {
      ctidTraderAccountId: parseInt(params.accountId),
      symbolId,
      orderType: ProtoOAOrderType.STOP,
      tradeSide: params.tradeSide === 'BUY' ? ProtoOATradeSide.BUY : ProtoOATradeSide.SELL,
      volume: Math.round(params.volume), // Already in centilots
      stopPrice: params.stopPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_NEW_ORDER_REQ,
      request,
      30000
    );
    
    return response;
  }

  /**
   * Modify position (update SL/TP)
   */
  async modifyPosition(params: {
    accountId: string;
    positionId: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<any> {
    console.log('[CTraderClient] 📊 modifyPosition called:', params);
    
    const request: AmendPositionSLTPReq = {
      ctidTraderAccountId: parseInt(params.accountId),
      positionId: params.positionId,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_AMEND_POSITION_SLTP_REQ,
      request,
      30000
    );
    
    return response;
  }

  /**
   * Close position
   */
  async closePosition(params: {
    accountId: string;
    positionId: number;
  }): Promise<any> {
    console.log('[CTraderClient] 📊 closePosition called:', params);
    
    // Get position details to know the volume
    const positionsData = await this.getPositions(params.accountId);
    const position = positionsData.position?.find((p: any) => p.positionId === params.positionId);
    
    if (!position) {
      throw new Error(`Position not found: ${params.positionId}`);
    }
    
    const request: ClosePositionReq = {
      ctidTraderAccountId: parseInt(params.accountId),
      positionId: params.positionId,
      volume: position.tradeData.volume, // Full volume to close entire position
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_CLOSE_POSITION_REQ,
      request,
      30000
    );
    
    return response;
  }

  /**
   * Subscribe to spot events (real-time quotes)
   * 
   * ✅ FIXED: Now properly waits for PROTO_OA_SPOT_EVENT and returns bid/ask data
   * ✅ FIXED: Connection remains alive during spot event polling
   */
  async subscribeToSpotEvent(accountId: string, symbolId: number): Promise<any> {
    console.log(`[CTraderClient] 📊 subscribeToSpotEvent called for symbolId=${symbolId}`);
    console.log(`[CTraderClient] 🔍 DIAGNOSTICS - Connection state: ${this.ws?.readyState} (1=OPEN)`);
    console.log(`[CTraderClient] 🔍 DIAGNOSTICS - Authenticated: app=${this.appAuthenticated}, account=${this.accountAuthenticated}`);
    console.log(`[CTraderClient] 🔍 DIAGNOSTICS - Subscribed symbols: [${Array.from(this.subscribedSymbols).join(', ')}]`);
    console.log(`[CTraderClient] 🔍 DIAGNOSTICS - Cached symbols: [${Array.from(this.spotCache.keys()).join(', ')}]`);
    console.log(`[CTraderClient] 🔍 DIAGNOSTICS - Symbol ${symbolId} already subscribed: ${this.subscribedSymbols.has(symbolId)}`);
    console.log(`[CTraderClient] 🔍 DIAGNOSTICS - Symbol ${symbolId} has cache: ${this.spotCache.has(symbolId)}`);
    
    // ✅ CRITICAL FIX: Check connection health FIRST
    if (!this.ws || this.ws.readyState !== 1) { // 1 = OPEN
      console.error(`[CTraderClient] ❌ WebSocket not connected! State: ${this.ws?.readyState}`);
      throw new Error('WebSocket not connected - cannot subscribe to spot events');
    }
    
    // ✅ CRITICAL FIX: Check cache FIRST, regardless of subscription tracking
    // This handles the case where subscription tracking was cleared but cTrader still has the subscription active
    const cachedQuote = this.spotCache.get(symbolId);
    if (cachedQuote && cachedQuote.bid > 0 && cachedQuote.ask > 0) {
      console.log(`[CTraderClient] ⚡ CACHE HIT - Returning cached quote: bid=${cachedQuote.bid}, ask=${cachedQuote.ask}`);
      return {
        bid: cachedQuote.bid,
        ask: cachedQuote.ask,
        timestamp: cachedQuote.timestamp,
      };
    }
    
    // ✅ Check if we're tracking this symbol as subscribed
    if (this.subscribedSymbols.has(symbolId)) {
      console.log(`[CTraderClient] ⚡ Symbol ${symbolId} marked as subscribed, but no cache yet`);
      
      // ✅ CRITICAL FIX: Wait for spot event WITHOUT re-subscribing
      // Re-subscribing causes ALREADY_SUBSCRIBED error and connection closure
      console.log(`[CTraderClient] ⏳ Waiting for next spot event for ${symbolId}...`);
      
      const maxWait = 5000; // 5 seconds for already-subscribed symbol
      const start = Date.now();
      
      while (Date.now() - start < maxWait) {
        if (!this.ws || this.ws.readyState !== 1) {
          throw new Error('WebSocket connection lost while waiting for spot event');
        }
        
        const cached = this.spotCache.get(symbolId);
        if (cached && cached.bid > 0 && cached.ask > 0) {
          console.log(`[CTraderClient] ✅ Spot event received! bid=${cached.bid}, ask=${cached.ask}`);
          return {
            bid: cached.bid,
            ask: cached.ask,
            timestamp: cached.timestamp,
          };
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // ✅ If still no data after waiting, assume market is closed or symbol is quiet
      console.warn(`[CTraderClient] ⚠️ No spot event received for already-subscribed symbol ${symbolId}`);
      console.warn(`[CTraderClient] Returning last known cache or zero values (Market Closed?)`);
      
      return {
        bid: 0,
        ask: 0,
        timestamp: Date.now(),
        marketClosed: true,
      };
    }
    
    // ✅ If not subscribed, send subscription request
    const request = {
      ctidTraderAccountId: parseInt(accountId),
      symbolId: [symbolId], // cTrader expects array of symbolIds
    };
    
    console.log(`[CTraderClient] 📤 Sending PROTO_OA_SUBSCRIBE_SPOTS_REQ for symbolId=${symbolId}`);
    
    const subscribeResponse = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_SUBSCRIBE_SPOTS_REQ,
      request,
      30000
    );
    
    console.log(`[CTraderClient] ✅ PROTO_OA_SUBSCRIBE_SPOTS_RES received:`, JSON.stringify(subscribeResponse, null, 2));
    
    // ✅ Track this symbol as subscribed
    this.subscribedSymbols.add(symbolId);
    console.log(`[CTraderClient] ✅ Symbol ${symbolId} subscribed successfully`);
    
    // ✅ CRITICAL FIX: Wait for the PROTO_OA_SPOT_EVENT to arrive and be cached
    // ✅ Keep checking connection health during polling
    console.log(`[CTraderClient] ⏳ Waiting for spot event for symbolId=${symbolId}...`);
    
    const maxWait = 10000; // ✅ Increased to 10 seconds (was 5s)
    const start = Date.now();
    let lastHeartbeat = Date.now(); // ✅ NEW: Track last heartbeat
    
    while (Date.now() - start < maxWait) {
      // ✅ NEW: Send heartbeat every 3 seconds to keep connection alive
      if (Date.now() - lastHeartbeat > 3000) {
        console.log(`[CTraderClient] 💓 Sending heartbeat during spot wait (elapsed: ${Date.now() - start}ms)...`);
        await this.sendManualHeartbeat();
        lastHeartbeat = Date.now();
      }
      
      // ✅ Check if connection is still alive
      if (!this.ws || this.ws.readyState !== 1) {
        console.error(`[CTraderClient] ❌ WebSocket disconnected during spot wait`);
        console.error(`[CTraderClient] State: ${this.ws?.readyState} (1=OPEN, 2=CLOSING, 3=CLOSED)`);
        console.error(`[CTraderClient] Time elapsed: ${Date.now() - start}ms / ${maxWait}ms`);
        console.error(`[CTraderClient] Subscribed symbols: ${Array.from(this.subscribedSymbols).join(', ')}`);
        console.error(`[CTraderClient] Spot cache size: ${this.spotCache.size}`);
        
        // ⚠️ CRITICAL FIX: If we have cached data, return it instead of throwing
        // This handles cases where connection drops briefly but we already have data
        const cached = this.spotCache.get(symbolId);
        if (cached && (cached.bid > 0 || cached.ask > 0)) {
           console.log(`[CTraderClient] ⚠️ Connection lost, but returning cached quote: bid=${cached.bid}, ask=${cached.ask}`);
           return {
             bid: cached.bid,
             ask: cached.ask,
             timestamp: cached.timestamp,
             _connectionLost: true,
           };
        }

        throw new Error(`WebSocket connection lost while waiting for spot event (state=${this.ws?.readyState}, elapsed=${Date.now() - start}ms)`);
      }
      
      const cached = this.spotCache.get(symbolId);
      if (cached && cached.bid > 0 && cached.ask > 0) {
        console.log(`[CTraderClient] ✅ Spot event received! bid=${cached.bid}, ask=${cached.ask}`);
        return {
          bid: cached.bid,
          ask: cached.ask,
          timestamp: cached.timestamp,
        };
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ❌ Timeout - no spot event received
    console.error(`[CTraderClient] ❌ Timeout waiting for spot event for symbolId=${symbolId}`);
    console.error(`[CTraderClient] Connection state: ${this.ws?.readyState} (1=OPEN, 2=CLOSING, 3=CLOSED)`);
    console.error(`[CTraderClient] Subscribed symbols: ${Array.from(this.subscribedSymbols).join(', ')}`);
    console.error(`[CTraderClient] Cached symbols: ${Array.from(this.spotCache.keys()).join(', ')}`);
    
    // ⚠️ CRITICAL FIX: Return last known data if available, even on timeout
    const cached = this.spotCache.get(symbolId);
    if (cached && (cached.bid > 0 || cached.ask > 0)) {
        console.log(`[CTraderClient] ⚠️ Timeout, but returning cached quote: bid=${cached.bid}, ask=${cached.ask}`);
        return {
            bid: cached.bid,
            ask: cached.ask,
            timestamp: cached.timestamp,
            _timeout: true,
        };
    }

    // ✅ CRITICAL FIX: When market is closed, cTrader doesn't send spot events
    // Instead of throwing error, return zero prices with clear indication
    console.warn(`[CTraderClient] ⚠️ No spot event received - market may be closed or symbol inactive`);
    console.warn(`[CTraderClient] ⚠️ Returning zero prices - this is expected behavior when market is closed`);
    
    return {
      bid: 0,
      ask: 0,
      timestamp: Date.now(),
      marketClosed: true, // ✅ Flag indicating this is due to market closure
    };
  }

  /**
   * Get trendbars (historical candles)
   */
  async getTrendbars(params: {
    accountId: string;
    symbol: string;
    period: string;
    fromTimestamp?: number;
    toTimestamp?: number;
    count?: number;
  }): Promise<any> {
    console.log('[CTraderClient] 📊 getTrendbars called');
    
    // Get symbol ID
    const symbolId = await this.getSymbolId(params.accountId, params.symbol);
    
    const request = {
      ctidTraderAccountId: parseInt(params.accountId),
      symbolId,
      period: params.period,
      fromTimestamp: params.fromTimestamp,
      toTimestamp: params.toTimestamp,
      count: params.count || 100,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_GET_TRENDBARS_REQ,
      request,
      60000 // Longer timeout for historical data
    );
    
    return response;
  }
}