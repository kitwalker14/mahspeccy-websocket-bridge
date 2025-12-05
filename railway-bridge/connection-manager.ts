/**
 * Connection Manager
 * Manages TCP connection pool and user sessions
 */

import { CTraderTcpClient } from './ctrader/tcp-client.ts';
import type { CTraderConfig } from './ctrader/types.ts';

interface UserSession {
  userId: string;
  tcpClient: CTraderTcpClient;
  socket: WebSocket | null;
  lastActivity: number;
  credentials: CTraderConfig;
}

export class ConnectionManager {
  private environment: 'demo' | 'live';
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CONNECTIONS = 100;
  
  constructor(environment: 'demo' | 'live') {
    this.environment = environment;
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    console.log(`✅ ConnectionManager initialized for ${environment.toUpperCase()} environment`);
  }
  
  /**
   * Get or create TCP connection for user
   */
  async getConnection(userId: string, credentials: CTraderConfig): Promise<CTraderTcpClient> {
    // Check if we already have an active session
    let session = this.sessions.get(userId);
    
    if (session) {
      // Check if connection is still alive
      if (session.tcpClient.isConnected()) {
        console.log(`🔄 [${userId}] Reusing existing TCP connection`);
        session.lastActivity = Date.now();
        return session.tcpClient;
      } else {
        // Connection dead, clean up
        console.log(`🧹 [${userId}] Cleaning up dead TCP connection`);
        this.closeConnection(userId);
      }
    }
    
    // Check connection limit
    if (this.sessions.size >= this.MAX_CONNECTIONS) {
      throw new Error(`Connection limit reached (${this.MAX_CONNECTIONS})`);
    }
    
    // Create new TCP connection
    console.log(`🆕 [${userId}] Creating new TCP connection to ${this.environment.toUpperCase()}`);
    
    const endpoint = this.environment === 'demo'
      ? 'https://demo.ctraderapi.com'
      : 'https://live.ctraderapi.com';
    
    const config: CTraderConfig = {
      ...credentials,
      endpoint,
    };
    
    const tcpClient = new CTraderTcpClient(config, userId);
    
    try {
      await tcpClient.connect();
      console.log(`✅ [${userId}] TCP connection established`);
      
      // Store session
      this.sessions.set(userId, {
        userId,
        tcpClient,
        socket: null,
        lastActivity: Date.now(),
        credentials,
      });
      
      return tcpClient;
      
    } catch (error) {
      console.error(`❌ [${userId}] Failed to connect TCP:`, error);
      throw error;
    }
  }
  
  /**
   * Get user's existing TCP connection (no auto-create)
   */
  getUserConnection(userId: string): CTraderTcpClient | null {
    const session = this.sessions.get(userId);
    if (session && session.tcpClient.isConnected()) {
      session.lastActivity = Date.now();
      return session.tcpClient;
    }
    return null;
  }
  
  /**
   * Register WebSocket for user
   */
  registerSocket(userId: string, socket: WebSocket): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.socket = socket;
      session.lastActivity = Date.now();
      console.log(`🔌 [${userId}] WebSocket registered`);
    }
  }
  
  /**
   * Unregister WebSocket (but keep TCP connection)
   */
  unregisterSocket(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.socket = null;
      session.lastActivity = Date.now();
      console.log(`🔌 [${userId}] WebSocket unregistered`);
    }
  }
  
  /**
   * Close TCP connection for user
   */
  closeConnection(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      try {
        session.tcpClient.disconnect();
      } catch (error) {
        console.error(`❌ [${userId}] Error disconnecting TCP:`, error);
      }
      
      if (session.socket) {
        try {
          session.socket.close();
        } catch (error) {
          console.error(`❌ [${userId}] Error closing WebSocket:`, error);
        }
      }
      
      this.sessions.delete(userId);
      console.log(`🗑️ [${userId}] Session closed`);
    }
  }
  
  /**
   * Get connection statistics
   */
  getStats() {
    const now = Date.now();
    let activeConnections = 0;
    let idleConnections = 0;
    
    for (const [userId, session] of this.sessions.entries()) {
      if (session.tcpClient.isConnected()) {
        if (session.socket) {
          activeConnections++;
        } else {
          idleConnections++;
        }
      }
    }
    
    return {
      environment: this.environment,
      totalSessions: this.sessions.size,
      activeConnections,
      idleConnections,
      maxConnections: this.MAX_CONNECTIONS,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Cleanup stale sessions
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const staleUserIds: string[] = [];
      
      for (const [userId, session] of this.sessions.entries()) {
        const idleTime = now - session.lastActivity;
        
        if (idleTime > this.SESSION_TIMEOUT) {
          staleUserIds.push(userId);
        }
      }
      
      if (staleUserIds.length > 0) {
        console.log(`🧹 Cleaning up ${staleUserIds.length} stale sessions`);
        for (const userId of staleUserIds) {
          this.closeConnection(userId);
        }
      }
    }, 60000); // Run every minute
  }
  
  /**
   * Shutdown - close all connections
   */
  shutdown(): void {
    console.log(`🛑 Shutting down ConnectionManager...`);
    for (const userId of this.sessions.keys()) {
      this.closeConnection(userId);
    }
    console.log(`✅ All connections closed`);
  }
}
