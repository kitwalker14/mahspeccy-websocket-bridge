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
  private accessToken: string;
  private subscribedSymbols = new Set<number>(); // ✅ Track subscribed symbols to avoid ALREADY_SUBSCRIBED error

  constructor(isDemo: boolean) {
    this.host = isDemo ? 'demo.ctraderapi.com' : 'live.ctraderapi.com';
    this.port = 5035;
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
          console.log(`[CTraderClient] 🔌 WebSocket closed ${connectionEstablished ? 'after connection' : 'during connection'}`);
          console.log(`[CTraderClient] Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
          console.log(`[CTraderClient] Was clean: ${event.wasClean}`);
          this.stopHeartbeat();
          this.appAuthenticated = false;
          this.accountAuthenticated = false;
          
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
   * Handle incoming message
   */
  private handleMessage(data: ArrayBuffer): void {
    try {
      // Decode ProtoMessage wrapper using protoLoader
      const buffer = new Uint8Array(data);
      
      console.log(`[CTraderClient] 📥 Raw message received (${buffer.length} bytes)`);
      console.log(`[CTraderClient] 🔍 First 20 bytes (hex):`, Array.from(buffer.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      const decoded = protoLoader.decodeMessage(buffer);
      const { payloadType, payload, clientMsgId } = decoded;
      
      console.log(`[CTraderClient] ← Received: ${this.getMessageTypeName(payloadType)} (msgId: ${clientMsgId})`);
      console.log(`[CTraderClient] 📦 Payload keys:`, Object.keys(payload || {}));
      
      // Handle heartbeat
      if (payloadType === 51) { // HEARTBEAT_EVENT
        return; // Ignore heartbeat responses
      }
      
      // Check for error responses
      if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
        console.error('[CTraderClient] ❌ ERROR RESPONSE:', payload);
        console.error('[CTraderClient] Error code:', payload.errorCode);
        console.error('[CTraderClient] Description:', payload.description);
      }
      
      // Find pending request
      if (clientMsgId && this.pendingRequests.has(clientMsgId)) {
        const request = this.pendingRequests.get(clientMsgId)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(clientMsgId);
        
        console.log(`[CTraderClient] ✅ Matched pending request: ${clientMsgId}`);
        
        // Check for errors
        if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
          request.reject(new Error(`cTrader Error: ${payload.errorCode} - ${payload.description}`));
        } else {
          request.resolve(payload);
        }
      } else {
        console.warn(`[CTraderClient] ⚠️ No pending request for msgId: ${clientMsgId}`);
        console.warn(`[CTraderClient] 📋 Pending requests:`, Array.from(this.pendingRequests.keys()));
      }
    } catch (error) {
      console.error('[CTraderClient] Failed to handle message:', error);
      console.error('[CTraderClient] Error stack:', error.stack);
      
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
      
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(msgId);
        reject(new Error(`Request timeout (${timeoutMs}ms): ${this.getMessageTypeName(payloadType)}`));
      }, timeoutMs);
      
      // Store pending request
      this.pendingRequests.set(msgId, { resolve, reject, timeout });
      
      // Send message
      console.log(`[CTraderClient] → Sending: ${this.getMessageTypeName(payloadType)} (msgId: ${msgId})`);
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
    await this.authenticateApp(credentials.clientId, credentials.clientSecret);
    await this.authenticateAccount(credentials.accountId, credentials.accessToken);
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
   */
  async subscribeToSpotEvent(accountId: string, symbolId: number): Promise<any> {
    console.log(`[CTraderClient] 📊 subscribeToSpotEvent called for symbolId=${symbolId}`);
    
    // ✅ Check if already subscribed to avoid ALREADY_SUBSCRIBED error
    if (this.subscribedSymbols.has(symbolId)) {
      console.log(`[CTraderClient] ⚡ Symbol ${symbolId} already subscribed, returning success without resubscribing`);
      return { 
        success: true,
        alreadySubscribed: true,
        symbolId 
      };
    }
    
    // ✅ symbolId is now passed directly, no need to lookup
    const request = {
      ctidTraderAccountId: parseInt(accountId),
      symbolId: [symbolId], // cTrader expects array of symbolIds
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_SUBSCRIBE_SPOTS_REQ,
      request,
      30000
    );
    
    // ✅ Track this symbol as subscribed
    this.subscribedSymbols.add(symbolId);
    console.log(`[CTraderClient] ✅ Symbol ${symbolId} subscribed successfully`);
    
    return response;
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