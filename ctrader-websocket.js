/**
 * cTrader WebSocket Client
 * Maintains persistent connection to cTrader Open API
 * Handles protobuf message encoding/decoding
 */

import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export class CTraderWebSocketClient {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    this.heartbeatInterval = null;
    this.updateCacheInterval = null;
    
    // User identification
    this.userId = config.userId;
    this.hashedUserId = this.hashUserId(config.userId);
    
    // Account data cache (updated in real-time)
    this.accountData = {
      balance: 0,
      equity: 0,
      margin: 0,
      freeMargin: 0,
      currency: 'USD',
      leverage: 1,
      positions: [],
      lastUpdate: null,
    };
    
    // Supabase client for cache updates
    this.supabase = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey
    );
    
    console.log(`✅ [WebSocket] Client initialized for user: ${this.userId}`);
  }
  
  /**
   * Hash user ID for privacy (same as backend)
   */
  hashUserId(userId) {
    return crypto.createHash('sha256').update(userId).digest('hex');
  }
  
  /**
   * Connect to cTrader WebSocket API
   */
  async connect() {
    try {
      const wsUrl = this.config.isDemo 
        ? 'wss://demo.ctraderapi.com'
        : 'wss://live.ctraderapi.com';
      
      console.log(`🔌 [WebSocket] Connecting to ${wsUrl} for account ${this.config.accountId}...`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('error', (error) => this.onError(error));
      this.ws.on('close', (code, reason) => this.onClose(code, reason));
      
      return true;
    } catch (error) {
      console.error(`❌ [WebSocket] Connection failed:`, error);
      this.scheduleReconnect();
      return false;
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  async onOpen() {
    console.log(`✅ [WebSocket] Connected to cTrader for account ${this.config.accountId}`);
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Send authentication message
    await this.authenticate();
    
    // Subscribe to account updates
    await this.subscribeToAccountUpdates();
    
    // Start heartbeat to keep connection alive
    this.startHeartbeat();
    
    // Start periodic cache updates
    this.startCacheUpdates();
  }
  
  /**
   * Authenticate with cTrader using OAuth token
   */
  async authenticate() {
    try {
      console.log(`🔐 [WebSocket] Authenticating with cTrader...`);
      
      // cTrader uses a simple JSON auth message (not protobuf for initial auth)
      const authMessage = {
        payloadType: 'ProtoOAApplicationAuthReq',
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      };
      
      this.send(JSON.stringify(authMessage));
      
      // Then authorize the account with OAuth token
      setTimeout(() => {
        const accountAuthMessage = {
          payloadType: 'ProtoOAAccountAuthReq',
          ctidTraderAccountId: parseInt(this.config.accountId),
          accessToken: this.config.accessToken,
        };
        
        this.send(JSON.stringify(accountAuthMessage));
        console.log(`✅ [WebSocket] Account authorization sent`);
      }, 1000);
      
    } catch (error) {
      console.error(`❌ [WebSocket] Authentication failed:`, error);
    }
  }
  
  /**
   * Subscribe to real-time account updates
   */
  async subscribeToAccountUpdates() {
    try {
      console.log(`📡 [WebSocket] Subscribing to account updates...`);
      
      // Subscribe to account events
      const subscribeMessage = {
        payloadType: 'ProtoOASubscribeSpotsReq',
        ctidTraderAccountId: parseInt(this.config.accountId),
        symbolId: [], // Empty array = subscribe to all symbols
      };
      
      this.send(JSON.stringify(subscribeMessage));
      
      // Request initial account state
      setTimeout(() => {
        this.requestAccountInfo();
        this.requestPositions();
      }, 2000);
      
    } catch (error) {
      console.error(`❌ [WebSocket] Subscription failed:`, error);
    }
  }
  
  /**
   * Request current account information
   */
  requestAccountInfo() {
    const message = {
      payloadType: 'ProtoOATraderReq',
      ctidTraderAccountId: parseInt(this.config.accountId),
    };
    
    this.send(JSON.stringify(message));
  }
  
  /**
   * Request current open positions
   */
  requestPositions() {
    const message = {
      payloadType: 'ProtoOAReconcileReq',
      ctidTraderAccountId: parseInt(this.config.accountId),
    };
    
    this.send(JSON.stringify(message));
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  async onMessage(data) {
    try {
      // Try to parse as JSON first (cTrader uses JSON for most messages)
      const message = JSON.parse(data.toString());
      
      console.log(`📨 [WebSocket] Received:`, message.payloadType);
      
      // Handle different message types
      switch (message.payloadType) {
        case 'ProtoOAApplicationAuthRes':
          console.log(`✅ [WebSocket] Application authenticated`);
          break;
          
        case 'ProtoOAAccountAuthRes':
          console.log(`✅ [WebSocket] Account authorized`);
          break;
          
        case 'ProtoOATraderRes':
          // Account info response
          this.handleAccountInfo(message);
          break;
          
        case 'ProtoOAReconcileRes':
          // Positions update
          this.handlePositionsUpdate(message);
          break;
          
        case 'ProtoOAExecutionEvent':
          // Trade execution event
          this.handleTradeEvent(message);
          break;
          
        case 'ProtoOASpotEvent':
          // Price update event
          this.handlePriceUpdate(message);
          break;
          
        case 'ProtoHeartbeatEvent':
          // Heartbeat response
          console.log(`💓 [WebSocket] Heartbeat received`);
          break;
          
        case 'ProtoOAErrorRes':
          console.error(`❌ [WebSocket] Error from cTrader:`, message.errorCode, message.description);
          break;
          
        default:
          console.log(`📩 [WebSocket] Unhandled message type:`, message.payloadType);
      }
      
    } catch (error) {
      // If JSON parsing fails, it might be a protobuf binary message
      console.log(`📦 [WebSocket] Binary message received (${data.length} bytes)`);
      // For now, we'll use JSON messages only as they're simpler
    }
  }
  
  /**
   * Handle account info message
   */
  handleAccountInfo(message) {
    try {
      const payload = message.trader || {};
      
      this.accountData.balance = payload.balance ? payload.balance / 100 : 0; // cTrader sends in cents
      this.accountData.currency = payload.depositCurrency || 'USD';
      this.accountData.leverage = payload.leverageInCents ? payload.leverageInCents / 100 : 1;
      this.accountData.lastUpdate = new Date().toISOString();
      
      console.log(`💰 [WebSocket] Account updated: $${this.accountData.balance.toLocaleString()} ${this.accountData.currency}`);
      
      // Immediately update cache
      this.updateCache();
      
    } catch (error) {
      console.error(`❌ [WebSocket] Failed to parse account info:`, error);
    }
  }
  
  /**
   * Handle positions update message
   */
  handlePositionsUpdate(message) {
    try {
      const positions = message.position || [];
      
      this.accountData.positions = positions.map(pos => ({
        id: pos.positionId,
        symbol: this.getSymbolName(pos.tradeData?.symbolId),
        side: pos.tradeData?.tradeSide === 'BUY' ? 'buy' : 'sell',
        volume: pos.tradeData?.volume ? pos.tradeData.volume / 100 : 0,
        entryPrice: pos.price ? pos.price / 100000 : 0,
        currentPrice: pos.currentPrice ? pos.currentPrice / 100000 : 0,
        swap: pos.swap ? pos.swap / 100 : 0,
        commission: pos.commission ? pos.commission / 100 : 0,
        pnl: pos.moneyDigits ? pos.grossProfit / Math.pow(10, pos.moneyDigits) : 0,
      }));
      
      // Calculate equity
      const totalPnL = this.accountData.positions.reduce((sum, pos) => sum + pos.pnl, 0);
      this.accountData.equity = this.accountData.balance + totalPnL;
      
      console.log(`📊 [WebSocket] Positions updated: ${positions.length} open positions, equity: $${this.accountData.equity.toFixed(2)}`);
      
      // Update cache
      this.updateCache();
      
    } catch (error) {
      console.error(`❌ [WebSocket] Failed to parse positions:`, error);
    }
  }
  
  /**
   * Handle trade execution event
   */
  handleTradeEvent(message) {
    try {
      console.log(`🔔 [WebSocket] Trade event:`, message.executionType);
      
      // Request fresh positions data
      this.requestPositions();
      this.requestAccountInfo();
      
    } catch (error) {
      console.error(`❌ [WebSocket] Failed to handle trade event:`, error);
    }
  }
  
  /**
   * Handle price update event
   */
  handlePriceUpdate(message) {
    // Price updates come frequently, only log occasionally
    if (Math.random() < 0.01) { // Log 1% of price updates
      console.log(`📈 [WebSocket] Price update received`);
    }
  }
  
  /**
   * Get symbol name from symbol ID (simplified)
   */
  getSymbolName(symbolId) {
    // In a real implementation, you'd maintain a symbol mapping
    // For now, return the ID
    return `SYMBOL_${symbolId}`;
  }
  
  /**
   * Update Supabase cache with current account data
   */
  async updateCache() {
    try {
      const cacheKey = `ctrader_account_${this.hashedUserId}`;
      
      const cacheData = {
        balance: this.accountData.balance,
        equity: this.accountData.equity,
        currency: this.accountData.currency,
        leverage: this.accountData.leverage,
        positions: this.accountData.positions,
        dailyChange: 0, // TODO: Calculate from audit logs
        dailyPnL: 0, // TODO: Calculate from today's trades
        winRate: 0, // TODO: Calculate from audit logs
        lastUpdate: this.accountData.lastUpdate,
        _cache: true,
        _cacheTimestamp: Date.now(),
      };
      
      // Use the KV store
      const { data, error } = await this.supabase
        .from('kv_store_5a9e4cc2')
        .upsert({
          key: cacheKey,
          value: cacheData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        });
      
      if (error) {
        console.error(`❌ [WebSocket] Cache update failed:`, error);
      } else {
        console.log(`✅ [WebSocket] Cache updated for user ${this.userId}`);
      }
      
    } catch (error) {
      console.error(`❌ [WebSocket] Cache update error:`, error);
    }
  }
  
  /**
   * Start periodic cache updates (every 2 seconds)
   */
  startCacheUpdates() {
    if (this.updateCacheInterval) {
      clearInterval(this.updateCacheInterval);
    }
    
    this.updateCacheInterval = setInterval(() => {
      if (this.isConnected) {
        this.updateCache();
      }
    }, 2000); // 2 seconds
    
    console.log(`⏰ [WebSocket] Started periodic cache updates (every 2s)`);
  }
  
  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        const heartbeat = {
          payloadType: 'ProtoHeartbeatEvent',
        };
        
        this.send(JSON.stringify(heartbeat));
      }
    }, 30000); // 30 seconds
    
    console.log(`💓 [WebSocket] Started heartbeat (every 30s)`);
  }
  
  /**
   * Send message to WebSocket
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      console.error(`❌ [WebSocket] Cannot send - connection not open`);
    }
  }
  
  /**
   * Handle WebSocket error
   */
  onError(error) {
    console.error(`❌ [WebSocket] Error:`, error.message);
  }
  
  /**
   * Handle WebSocket close
   */
  onClose(code, reason) {
    console.log(`🔌 [WebSocket] Connection closed: ${code} - ${reason}`);
    this.isConnected = false;
    
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.updateCacheInterval) {
      clearInterval(this.updateCacheInterval);
      this.updateCacheInterval = null;
    }
    
    // Schedule reconnect
    this.scheduleReconnect();
  }
  
  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ [WebSocket] Max reconnect attempts reached (${this.maxReconnectAttempts})`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`🔄 [WebSocket] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    console.log(`🔌 [WebSocket] Disconnecting...`);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.updateCacheInterval) {
      clearInterval(this.updateCacheInterval);
      this.updateCacheInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  }
}
