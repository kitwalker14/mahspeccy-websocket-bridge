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
    return `${credentials.isDemo ? 'demo' : 'live'}_${credentials.accountId}`;
  }

  /**
   * Get or create connection
   */
  async getConnection(credentials: CTraderCredentials): Promise<CTraderClient> {
    const key = this.getKey(credentials);
    
    // Check if we have an existing connection
    const existing = this.connections.get(key);
    if (existing && !existing.inUse) {
      console.log(`[ConnectionPool] ♻️  Reusing connection: ${key}`);
      existing.inUse = true;
      existing.lastUsed = Date.now();
      return existing.client;
    }
    
    // Create new connection
    console.log(`[ConnectionPool] 🆕 Creating new connection: ${key}`);
    const client = new CTraderClient(credentials.isDemo);
    
    try {
      // Connect and authenticate
      await client.connect();
      await client.fullAuth(credentials);
      
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
   * Execute request with automatic connection management
   */
  async withConnection<T>(
    credentials: CTraderCredentials,
    callback: (client: CTraderClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getConnection(credentials);
    
    try {
      const result = await callback(client);
      this.releaseConnection(credentials);
      return result;
    } catch (error) {
      // On error, remove connection from pool (might be stale)
      const key = this.getKey(credentials);
      const connection = this.connections.get(key);
      if (connection) {
        connection.client.disconnect();
        this.connections.delete(key);
        console.log(`[ConnectionPool] ❌ Removed failed connection: ${key}`);
      }
      throw error;
    }
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