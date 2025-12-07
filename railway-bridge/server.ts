/**
 * WebSocket Server using Hono
 * Handles WebSocket connections from frontend and routes to TCP connections
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { ConnectionManager } from './connection-manager.ts';
import { MessageRouter } from './message-router.ts';
import { validateSessionToken, createSessionToken } from './auth-middleware.ts';

export function createServer(environment: 'demo' | 'live') {
  const app = new Hono();
  
  // Connection manager - handles TCP connection pooling
  const connectionManager = new ConnectionManager(environment);
  
  // Message router - translates WebSocket JSON ↔ ProtoOA
  const messageRouter = new MessageRouter();
  
  // Middleware
  app.use('*', cors({
    origin: '*', // TODO: Restrict in production
    credentials: true,
  }));
  
  app.use('*', logger(console.log));
  
  // Health check endpoint
  app.get('/health', (c) => {
    const stats = connectionManager.getStats();
    return c.json({
      status: 'healthy',
      environment,
      connections: stats.activeConnections,
      uptime: Math.floor(process.uptime?.() || 0),
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });
  
  // WebSocket endpoint
  app.get('/ws', async (c) => {
    // Validate session token from query params
    const token = c.req.query('token');
    
    if (!token) {
      return c.text('Missing session token', 401);
    }
    
    const sessionData = await validateSessionToken(token);
    
    if (!sessionData) {
      return c.text('Invalid session token', 401);
    }
    
    // Upgrade to WebSocket
    const upgrade = c.req.raw.headers.get('upgrade');
    if (upgrade !== 'websocket') {
      return c.text('Expected WebSocket', 400);
    }
    
    const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
    
    socket.onopen = async () => {
      console.log(`✅ [${sessionData.userId}] WebSocket connected`);
      
      try {
        // Get or create TCP connection for this user
        const tcpConnection = await connectionManager.getConnection(
          sessionData.userId,
          sessionData.credentials
        );
        
        // Store socket reference
        connectionManager.registerSocket(sessionData.userId, socket);
        
        // Send connection success
        socket.send(JSON.stringify({
          type: 'CONNECTION_SUCCESS',
          data: {
            environment,
            connected: true,
            timestamp: Date.now(),
          },
        }));
        
        // Setup TCP event forwarding
        tcpConnection.on('message', (data: any) => {
          // Forward TCP messages to WebSocket
          const jsonMessage = messageRouter.protoToJson(data);
          socket.send(JSON.stringify(jsonMessage));
        });
        
        tcpConnection.on('error', (error: any) => {
          socket.send(JSON.stringify({
            type: 'ERROR',
            error: error.message,
            timestamp: Date.now(),
          }));
        });
        
        tcpConnection.on('disconnected', () => {
          socket.send(JSON.stringify({
            type: 'DISCONNECTED',
            timestamp: Date.now(),
          }));
          socket.close();
        });
        
      } catch (error) {
        console.error(`❌ [${sessionData.userId}] Failed to establish TCP connection:`, error);
        socket.send(JSON.stringify({
          type: 'CONNECTION_ERROR',
          error: error instanceof Error ? error.message : 'Connection failed',
        }));
        socket.close();
      }
    };
    
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`📥 [${sessionData.userId}] Received:`, message.type);
        
        // Get user's TCP connection
        const tcpConnection = connectionManager.getUserConnection(sessionData.userId);
        
        if (!tcpConnection) {
          socket.send(JSON.stringify({
            type: 'ERROR',
            error: 'No TCP connection available',
            requestId: message.requestId,
          }));
          return;
        }
        
        // Route message to TCP connection
        await messageRouter.handleWebSocketMessage(message, tcpConnection);
        
      } catch (error) {
        console.error(`❌ [${sessionData.userId}] Message handling error:`, error);
        socket.send(JSON.stringify({
          type: 'ERROR',
          error: error instanceof Error ? error.message : 'Message handling failed',
        }));
      }
    };
    
    socket.onclose = () => {
      console.log(`🔌 [${sessionData.userId}] WebSocket disconnected`);
      connectionManager.unregisterSocket(sessionData.userId);
      
      // Optional: Keep TCP connection alive for reconnection
      // Or close it immediately:
      // connectionManager.closeConnection(sessionData.userId);
    };
    
    socket.onerror = (error) => {
      console.error(`❌ [${sessionData.userId}] WebSocket error:`, error);
      connectionManager.unregisterSocket(sessionData.userId);
    };
    
    return response;
  });
  
  // Session token endpoint (for testing/debugging)
  app.post('/session/create', async (c) => {
    const body = await c.req.json();
    const { userId, credentials } = body;
    
    if (!userId || !credentials) {
      return c.json({ error: 'Missing userId or credentials' }, 400);
    }
    
    const token = await createSessionToken({ userId, credentials });
    
    return c.json({
      success: true,
      token,
      expiresIn: 86400, // 24 hours
    });
  });
  
  // Stats endpoint (for monitoring)
  app.get('/stats', (c) => {
    const stats = connectionManager.getStats();
    return c.json(stats);
  });
  
  // ============================================================================
  // REST API ENDPOINTS (for Supabase Edge Function integration)
  // ============================================================================
  
  /**
   * POST /api/account
   * Get account data (balance, equity, margin) via REST
   */
  app.post('/api/account', async (c) => {
    try {
      const body = await c.req.json();
      const { clientId, clientSecret, accessToken, accountId, environment: env } = body;
      
      if (!clientId || !clientSecret || !accessToken || !accountId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }
      
      console.log(`📊 [REST API] Account request for ${accountId} (${env})`);
      
      // Create temporary connection for this request
      const userId = `rest_${accountId}_${Date.now()}`;
      const credentials = { clientId, clientSecret, accessToken, accountId };
      
      const tcpConnection = await connectionManager.getConnection(userId, credentials);
      
      // Send account info request
      const accountData = await messageRouter.requestAccountInfo(tcpConnection, accountId);
      
      // Cleanup connection
      await connectionManager.closeConnection(userId);
      
      return c.json(accountData);
    } catch (error: any) {
      console.error('❌ [REST API] Account error:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  /**
   * POST /api/positions
   * Get positions, orders, and deals via REST
   */
  app.post('/api/positions', async (c) => {
    try {
      const body = await c.req.json();
      const { clientId, clientSecret, accessToken, accountId, environment: env } = body;
      
      if (!clientId || !clientSecret || !accessToken || !accountId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }
      
      console.log(`📍 [REST API] Positions request for ${accountId} (${env})`);
      
      // Create temporary connection for this request
      const userId = `rest_${accountId}_${Date.now()}`;
      const credentials = { clientId, clientSecret, accessToken, accountId };
      
      const tcpConnection = await connectionManager.getConnection(userId, credentials);
      
      // Send positions/orders request
      const positionsData = await messageRouter.requestPositions(tcpConnection, accountId);
      
      // Cleanup connection
      await connectionManager.closeConnection(userId);
      
      return c.json(positionsData);
    } catch (error: any) {
      console.error('❌ [REST API] Positions error:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  /**
   * POST /api/symbols
   * Get available symbols via REST
   */
  app.post('/api/symbols', async (c) => {
    try {
      const body = await c.req.json();
      const { clientId, clientSecret, accessToken, accountId, environment: env } = body;
      
      if (!clientId || !clientSecret || !accessToken || !accountId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }
      
      console.log(`📋 [REST API] Symbols request for ${accountId} (${env})`);
      
      // Create temporary connection for this request
      const userId = `rest_${accountId}_${Date.now()}`;
      const credentials = { clientId, clientSecret, accessToken, accountId };
      
      const tcpConnection = await connectionManager.getConnection(userId, credentials);
      
      // Send symbols request
      const symbolsData = await messageRouter.requestSymbols(tcpConnection, accountId);
      
      // Cleanup connection
      await connectionManager.closeConnection(userId);
      
      return c.json(symbolsData);
    } catch (error: any) {
      console.error('❌ [REST API] Symbols error:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  return app;
}