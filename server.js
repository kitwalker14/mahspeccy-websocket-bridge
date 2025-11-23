/**
 * mahSpeccy WebSocket Bridge Server
 * Maintains persistent WebSocket connections to cTrader
 * Updates Supabase cache with real-time trading data
 */

import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { CTraderWebSocketClient } from './ctrader-websocket.js';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Active WebSocket sessions (userId -> WebSocketClient)
const activeSessions = new Map();

/**
 * Hash user ID for privacy (same as backend)
 */
function hashUserId(userId) {
  return crypto.createHash('sha256').update(userId).digest('hex');
}

/**
 * Get user's cTrader settings from Supabase
 */
async function getCTraderSettings(userId) {
  try {
    const hashedUserId = hashUserId(userId);
    const { data, error } = await supabase
      .from('kv_store_5a9e4cc2')
      .select('value')
      .eq('key', `ctrader_settings_${hashedUserId}`)
      .single();
    
    if (error) {
      console.error(`❌ Failed to get cTrader settings:`, error);
      return null;
    }
    
    return data?.value || null;
  } catch (error) {
    console.error(`❌ Error getting cTrader settings:`, error);
    return null;
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeSessions: activeSessions.size,
    sessions: Array.from(activeSessions.keys()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get status of all active sessions
 */
app.get('/api/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([userId, client]) => ({
    userId,
    isConnected: client.isConnected,
    accountId: client.config.accountId,
    lastUpdate: client.accountData.lastUpdate,
    balance: client.accountData.balance,
    positions: client.accountData.positions.length,
  }));
  
  res.json({
    total: sessions.length,
    sessions,
  });
});

/**
 * Start WebSocket connection for a user
 * POST /api/start-websocket
 * Body: { userId: string }
 */
app.post('/api/start-websocket', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Check if already connected
    if (activeSessions.has(userId)) {
      console.log(`ℹ️ WebSocket already active for user: ${userId}`);
      return res.json({
        success: true,
        message: 'WebSocket already connected',
        alreadyConnected: true,
      });
    }
    
    // Get user's cTrader settings
    const settings = await getCTraderSettings(userId);
    
    if (!settings || !settings.accessToken || !settings.accountId) {
      console.error(`❌ No cTrader configuration found for user: ${userId}`);
      return res.status(400).json({
        error: 'No cTrader configuration found. Please connect cTrader first.',
      });
    }
    
    console.log(`🚀 Starting WebSocket for user: ${userId}, account: ${settings.accountId}`);
    
    // Create WebSocket client
    const wsClient = new CTraderWebSocketClient({
      userId,
      clientId: process.env.CTRADER_CLIENT_ID,
      clientSecret: process.env.CTRADER_CLIENT_SECRET,
      accessToken: settings.accessToken,
      accountId: settings.accountId,
      isDemo: settings.isDemo || settings.environment === 'demo',
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    
    // Connect
    const connected = await wsClient.connect();
    
    if (connected) {
      // Store in active sessions
      activeSessions.set(userId, wsClient);
      
      console.log(`✅ WebSocket started for user: ${userId}`);
      
      res.json({
        success: true,
        message: 'WebSocket connection started',
        accountId: settings.accountId,
        isDemo: settings.isDemo || settings.environment === 'demo',
      });
    } else {
      res.status(500).json({
        error: 'Failed to connect WebSocket',
      });
    }
    
  } catch (error) {
    console.error(`❌ Error starting WebSocket:`, error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Stop WebSocket connection for a user
 * POST /api/stop-websocket
 * Body: { userId: string }
 */
app.post('/api/stop-websocket', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const wsClient = activeSessions.get(userId);
    
    if (!wsClient) {
      return res.json({
        success: true,
        message: 'No active WebSocket connection',
        wasConnected: false,
      });
    }
    
    console.log(`🛑 Stopping WebSocket for user: ${userId}`);
    
    // Disconnect
    wsClient.disconnect();
    
    // Remove from active sessions
    activeSessions.delete(userId);
    
    console.log(`✅ WebSocket stopped for user: ${userId}`);
    
    res.json({
      success: true,
      message: 'WebSocket connection stopped',
      wasConnected: true,
    });
    
  } catch (error) {
    console.error(`❌ Error stopping WebSocket:`, error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Get WebSocket status for a user
 * GET /api/websocket-status/:userId
 */
app.get('/api/websocket-status/:userId', (req, res) => {
  const { userId } = req.params;
  
  const wsClient = activeSessions.get(userId);
  
  if (!wsClient) {
    return res.json({
      connected: false,
      message: 'No active WebSocket connection',
    });
  }
  
  res.json({
    connected: wsClient.isConnected,
    accountId: wsClient.config.accountId,
    lastUpdate: wsClient.accountData.lastUpdate,
    balance: wsClient.accountData.balance,
    equity: wsClient.accountData.equity,
    positions: wsClient.accountData.positions.length,
  });
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  // Disconnect all WebSocket sessions
  for (const [userId, wsClient] of activeSessions.entries()) {
    console.log(`🔌 Disconnecting user: ${userId}`);
    wsClient.disconnect();
  }
  
  activeSessions.clear();
  
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  
  // Disconnect all WebSocket sessions
  for (const [userId, wsClient] of activeSessions.entries()) {
    console.log(`🔌 Disconnecting user: ${userId}`);
    wsClient.disconnect();
  }
  
  activeSessions.clear();
  
  process.exit(0);
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 mahSpeccy WebSocket Bridge Server                       ║
║                                                               ║
║   Status: ONLINE                                              ║
║   Port: ${PORT}                                                   ║
║   Environment: ${process.env.NODE_ENV || 'development'}                                   ║
║                                                               ║
║   Endpoints:                                                  ║
║   • GET  /health                                              ║
║   • GET  /api/sessions                                        ║
║   • POST /api/start-websocket                                 ║
║   • POST /api/stop-websocket                                  ║
║   • GET  /api/websocket-status/:userId                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
  
  console.log(`✅ Server ready to accept connections`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Log unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
