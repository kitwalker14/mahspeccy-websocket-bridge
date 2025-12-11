/**
 * WebSocket Connection Pool for cTrader
 * 
 * Manages persistent WebSocket connections to cTrader and reuses them
 * across multiple REST API requests.
 * 
 * Features:
 * - Connection reuse
 * - Automatic cleanup of idle connections
 * - Connection health checks
 * - Per-account connection pooling
 */

import { CTraderClient, type CTraderCredentials } from './ctrader-client.ts';
import { protoLoader } from './proto-loader.ts';

interface PooledConnection {
  client: CTraderClient;
  credentials: CTraderCredentials;
  lastUsed: number;
  inUse: boolean;
}

export class ConnectionPool {
  private connections = new Map<string, PooledConnection>();
  private maxIdleTime = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: number | null = null;
  private protoInitialized = false;

  constructor() {
    // Start cleanup task
    this.startCleanup();
  }

  /**
   * Initialize Protocol Buffers (call once on startup)
   */
  async initialize(): Promise<void> {
    if (!this.protoInitialized) {
      await protoLoader.load();
      this.protoInitialized = true;
      console.log('[ConnectionPool] ✅ Protocol Buffers initialized');
    }
  }

  /**
   * Get connection key for pooling
   */
  private getKey(credentials: CTraderCredentials): string {
    // Include first 8 chars of access token in key to detect token changes
    const tokenPrefix = credentials.accessToken.substring(0, 8);
    return `${credentials.isDemo ? 'demo' : 'live'}_${credentials.accountId}_${tokenPrefix}`;
  }

  /**
   * Get or create connection for credentials
   */
  async getConnection(credentials: CTraderCredentials, skipAccountAuth = false): Promise<CTraderClient> {
    const key = this.getKey(credentials);
    
    // Check if we have an existing connection that's not in use
    const existing = this.connections.get(key);
    if (existing && !existing.inUse) {
      console.log(`[ConnectionPool] ♻️ Reusing existing connection: ${key}`);
      existing.inUse = true;
      existing.lastUsed = Date.now();
      return existing.client;
    }
    
    // If connection exists but is in use, create a fresh one
    console.log(`[ConnectionPool] 🆕 Creating fresh connection: ${key}`);
    if (existing) {
      console.log(`[ConnectionPool] 🧹 Removing existing connection (inUse=${existing.inUse}): ${key}`);
      existing.client.disconnect();
      this.connections.delete(key);
    }
    
    const client = new CTraderClient(credentials.isDemo);
    
    try {
      // CRITICAL: Initialize proto files for this client instance
      console.log(`[ConnectionPool] 📦 Initializing proto files for client...`);
      await client.initialize();
      console.log(`[ConnectionPool] ✅ Proto files initialized for client`);
      
      // Connect and authenticate
      await client.connect();
      
      // For getAccounts endpoint, we only need app auth
      if (skipAccountAuth) {
        await client.authenticateApp(credentials.clientId, credentials.clientSecret);
      } else {
        await client.fullAuth(credentials);
      }
      
      // Store in pool
      this.connections.set(key, {
        client,
        credentials,
        lastUsed: Date.now(),
        inUse: true,
      });
      
      return client;
    } catch (error) {
      // Connection failed, cleanup
      client.disconnect();
      throw error;
    }
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(credentials: CTraderCredentials): void {
    const key = this.getKey(credentials);
    const connection = this.connections.get(key);
    
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      console.log(`[ConnectionPool] ✅ Released connection: ${key}`);
    }
  }

  /**
   * Invalidate and remove connection from pool
   * Used when authentication fails or connection becomes stale
   */
  invalidateConnection(credentials: CTraderCredentials): void {
    const key = this.getKey(credentials);
    const connection = this.connections.get(key);
    
    if (connection) {
      console.log(`[ConnectionPool] ❌ Invalidating connection: ${key}`);
      connection.client.disconnect();
      this.connections.delete(key);
    }
  }

  /**
   * Execute request with automatic connection management
   * ✅ NEW: Automatic retry on connection errors
   */
  async withConnection<T>(
    credentials: CTraderCredentials,
    callback: (client: CTraderClient) => Promise<T>,
    skipAccountAuth = false
  ): Promise<T> {
    const maxRetries = 2; // Try up to 2 times (initial + 1 retry)
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const client = await this.getConnection(credentials, skipAccountAuth);
        
        try {
          const result = await callback(client);
          this.releaseConnection(credentials);
          return result;
        } catch (error) {
          const key = this.getKey(credentials);
          const connection = this.connections.get(key);
          
          // Check if this is a connection error that we should retry
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isConnectionError = 
            errorMessage.includes('Connection closed') ||
            errorMessage.includes('ECONNRESET') ||
            errorMessage.includes('socket hang up') ||
            errorMessage.includes('timeout');
          
          if (isConnectionError && attempt < maxRetries - 1) {
            console.log(`[ConnectionPool] ⚠️ Connection error on attempt ${attempt + 1}, retrying...`);
            console.log(`[ConnectionPool] Error: ${errorMessage}`);
            
            // Remove stale connection
            if (connection) {
              connection.client.disconnect();
              this.connections.delete(key);
              console.log(`[ConnectionPool] ❌ Removed failed connection: ${key}`);
            }
            
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            lastError = error instanceof Error ? error : new Error(String(error));
            continue; // Retry
          }
          
          // Not a connection error or out of retries - fail immediately
          if (connection) {
            connection.client.disconnect();
            this.connections.delete(key);
            console.log(`[ConnectionPool] ❌ Removed failed connection: ${key}`);
          }
          throw error;
        }
      } catch (error) {
        // Error during getConnection() itself
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isConnectionError = 
          errorMessage.includes('Connection closed') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('socket hang up') ||
          errorMessage.includes('timeout');
        
        if (isConnectionError && attempt < maxRetries - 1) {
          console.log(`[ConnectionPool] ⚠️ Connection setup error on attempt ${attempt + 1}, retrying...`);
          console.log(`[ConnectionPool] Error: ${errorMessage}`);
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          lastError = error instanceof Error ? error : new Error(String(error));
          continue; // Retry
        }
        
        throw error;
      }
    }
    
    // All retries failed
    throw lastError || new Error('Connection failed after retries');
  }

  /**
   * Start cleanup task to remove idle connections
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, connection] of this.connections.entries()) {
        // Remove connections idle for more than maxIdleTime
        if (!connection.inUse && (now - connection.lastUsed) > this.maxIdleTime) {
          connection.client.disconnect();
          this.connections.delete(key);
          cleaned++;
          console.log(`[ConnectionPool] 🧹 Cleaned idle connection: ${key}`);
        }
      }
      
      if (cleaned > 0) {
        console.log(`[ConnectionPool] 🧹 Cleanup complete: ${cleaned} connections removed, ${this.connections.size} remaining`);
      }
    }, 60000); // Run every minute
  }

  /**
   * Shutdown pool and disconnect all connections
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    for (const [key, connection] of this.connections.entries()) {
      connection.client.disconnect();
      console.log(`[ConnectionPool] 🔌 Disconnected: ${key}`);
    }
    
    this.connections.clear();
    console.log('[ConnectionPool] ✅ Shutdown complete');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const total = this.connections.size;
    const inUse = Array.from(this.connections.values()).filter(c => c.inUse).length;
    const idle = total - inUse;
    
    return {
      total,
      inUse,
      idle,
      connections: Array.from(this.connections.keys()),
    };
  }
}

// Global connection pool instance
export const connectionPool = new ConnectionPool();