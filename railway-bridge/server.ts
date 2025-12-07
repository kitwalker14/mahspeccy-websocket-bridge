/**
 * Railway Bridge Server - Production Ready
 * 
 * WebSocket-to-REST adapter for cTrader Open API
 * Architecture: Supabase → Railway Bridge (REST) → cTrader (WebSocket)
 * 
 * Features:
 * ✅ Full Protocol Buffers support
 * ✅ WebSocket connection pooling
 * ✅ Proper authentication flow
 * ✅ Error handling & logging
 * ✅ Health checks
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { connectionPool } from './connection-pool.ts';
import type { CTraderCredentials } from './ctrader-client.ts';

const app = new Hono();

// Global state
const startTime = Date.now();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS - Allow Supabase to call this service
app.use('*', cors({
  origin: '*', // In production, restrict to your Supabase domain
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Logging
app.use('*', logger());

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} - ${c.res.status} (${ms}ms)`);
});

// ============================================================================
// HEALTH & STATUS ENDPOINTS
// ============================================================================

app.get('/health', (c) => {
  const stats = connectionPool.getStats();
  
  return c.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    connections: {
      total: stats.total,
      inUse: stats.inUse,
      idle: stats.idle,
    },
    features: [
      'Protocol Buffers support',
      'WebSocket connection pooling',
      'cTrader ProtoOA protocol',
      'Automatic reconnection',
    ],
  });
});

app.get('/stats', (c) => {
  const stats = connectionPool.getStats();
  
  return c.json({
    uptime: Math.floor((Date.now() - startTime) / 1000),
    connectionPool: stats,
    memory: {
      heapUsed: Deno.memoryUsage().heapUsed,
      heapTotal: Deno.memoryUsage().heapTotal,
      external: Deno.memoryUsage().external,
    },
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate request body
 */
function validateRequest(body: any): { valid: boolean; error?: string; credentials?: CTraderCredentials } {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }

  const { clientId, clientSecret, accessToken, accountId, isDemo } = body;

  if (!clientId) {
    return { valid: false, error: 'clientId is required' };
  }
  if (!clientSecret) {
    return { valid: false, error: 'clientSecret is required' };
  }
  if (!accessToken) {
    return { valid: false, error: 'accessToken is required' };
  }
  if (!accountId) {
    return { valid: false, error: 'accountId is required' };
  }

  const credentials: CTraderCredentials = {
    clientId,
    clientSecret,
    accessToken,
    accountId: accountId.toString(),
    isDemo: isDemo !== false, // Default to demo for safety
  };

  return { valid: true, credentials };
}

/**
 * Validate request body for accounts endpoint (no accountId required)
 */
function validateAccountsRequest(body: any): { valid: boolean; error?: string; credentials?: CTraderCredentials } {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }

  const { clientId, clientSecret, accessToken, isDemo } = body;

  if (!clientId) {
    return { valid: false, error: 'clientId is required' };
  }
  if (!clientSecret) {
    return { valid: false, error: 'clientSecret is required' };
  }
  if (!accessToken) {
    return { valid: false, error: 'accessToken is required' };
  }

  // Use a dummy accountId since it's required by CTraderCredentials type but not used for this endpoint
  const credentials: CTraderCredentials = {
    clientId,
    clientSecret,
    accessToken,
    accountId: '0', // Dummy value, not used for getAccounts
    isDemo: isDemo !== false, // Default to demo for safety
  };

  return { valid: true, credentials };
}

/**
 * Handle errors consistently
 */
function handleError(error: any, context: string) {
  console.error(`[${context}] Error:`, error);
  
  return {
    error: error.message || 'Unknown error',
    code: 'CTRADER_ERROR',
    context,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// CTRADER API ENDPOINTS
// ============================================================================

/**
 * POST /api/account
 * Fetch account data via cTrader WebSocket
 */
app.post('/api/account', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Account] Fetching data for account ${credentials.accountId} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Use connection pool to execute request
    const traderData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getTrader(credentials.accountId);
    });

    console.log(`[Account] ✅ Success for account ${credentials.accountId}`);

    return c.json({
      success: true,
      data: {
        accountId: credentials.accountId,
        balance: traderData.balance || 0,
        equity: traderData.equity || 0,
        freeMargin: traderData.freeMargin || 0,
        margin: traderData.margin || 0,
        leverage: traderData.leverage || 1,
        isDemo: credentials.isDemo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Account] Error:', error);
    return c.json(handleError(error, 'api/account'), 500);
  }
});

/**
 * POST /api/positions
 * Fetch open positions via cTrader WebSocket
 */
app.post('/api/positions', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Positions] Fetching positions for account ${credentials.accountId} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Use connection pool to execute request
    const reconcileData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getPositions(credentials.accountId);
    });

    console.log(`[Positions] ✅ Success - ${reconcileData.position?.length || 0} positions`);

    return c.json({
      success: true,
      data: {
        positions: reconcileData.position || [],
        orders: reconcileData.order || [],
        accountId: credentials.accountId,
        isDemo: credentials.isDemo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Positions] Error:', error);
    return c.json(handleError(error, 'api/positions'), 500);
  }
});

/**
 * POST /api/symbols
 * Fetch available symbols via cTrader WebSocket
 */
app.post('/api/symbols', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Symbols] Fetching symbols for account ${credentials.accountId} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Use connection pool to execute request
    const symbolsData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getSymbols(credentials.accountId);
    });

    console.log(`[Symbols] ✅ Success - ${symbolsData.symbol?.length || 0} symbols`);

    return c.json({
      success: true,
      data: {
        symbols: symbolsData.symbol || [],
        accountId: credentials.accountId,
        isDemo: credentials.isDemo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Symbols] Error:', error);
    return c.json(handleError(error, 'api/symbols'), 500);
  }
});

/**
 * POST /api/accounts
 * Get all accounts for an access token
 */
app.post('/api/accounts', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateAccountsRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Accounts] Fetching accounts list (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Use connection pool to execute request (only needs app auth, not account auth)
    const accountsData = await connectionPool.withConnection(credentials, async (client) => {
      // Disconnect account auth for this request
      return await client.getAccounts(credentials.accessToken);
    });

    console.log(`[Accounts] ✅ Success - ${accountsData.ctidTraderAccount?.length || 0} accounts`);

    return c.json({
      success: true,
      data: {
        accounts: accountsData.ctidTraderAccount || [],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Accounts] Error:', error);
    return c.json(handleError(error, 'api/accounts'), 500);
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    availableEndpoints: [
      'GET /health',
      'GET /stats',
      'POST /api/account',
      'POST /api/positions',
      'POST /api/symbols',
      'POST /api/accounts',
    ],
  }, 404);
});

app.onError((err, c) => {
  console.error('[Server Error]', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString(),
  }, 500);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

Deno.addSignalListener('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  connectionPool.shutdown();
  Deno.exit(0);
});

Deno.addSignalListener('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  connectionPool.shutdown();
  Deno.exit(0);
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = parseInt(Deno.env.get('PORT') || '8080');

console.log('');
console.log('🚀 Railway Bridge Server - Production Ready');
console.log('='.repeat(60));
console.log('');
console.log('Features:');
console.log('  ✅ cTrader ProtoOA Protocol Buffers');
console.log('  ✅ WebSocket Connection Pooling');
console.log('  ✅ Automatic Reconnection');
console.log('  ✅ Full Authentication Flow');
console.log('');
console.log('Endpoints:');
console.log('  GET  /health          - Health check');
console.log('  GET  /stats           - Connection pool stats');
console.log('  POST /api/account     - Fetch account data');
console.log('  POST /api/positions   - Fetch positions');
console.log('  POST /api/symbols     - Fetch symbols');
console.log('  POST /api/accounts    - List accounts');
console.log('');
console.log(`🌐 Server starting on port ${PORT}...`);
console.log('='.repeat(60));
console.log('');

// Initialize Protocol Buffers before starting server
console.log('[Server] Initializing Protocol Buffers...');
await connectionPool.initialize();
console.log('[Server] ✅ Protocol Buffers initialized');
console.log('');

Deno.serve({ port: PORT }, app.fetch);