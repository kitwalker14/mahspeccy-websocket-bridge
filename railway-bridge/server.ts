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

  const { accessToken, accountId, isDemo } = body;

  // ✅ Get client credentials from environment variables (SECURE)
  const clientId = Deno.env.get('CTRADER_CLIENT_ID');
  const clientSecret = Deno.env.get('CTRADER_CLIENT_SECRET');

  if (!clientId) {
    return { valid: false, error: 'CTRADER_CLIENT_ID not configured in environment' };
  }
  if (!clientSecret) {
    return { valid: false, error: 'CTRADER_CLIENT_SECRET not configured in environment' };
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

  const { accessToken, isDemo } = body;

  // ✅ Get client credentials from environment variables (SECURE)
  const clientId = Deno.env.get('CTRADER_CLIENT_ID');
  const clientSecret = Deno.env.get('CTRADER_CLIENT_SECRET');

  if (!clientId) {
    return { valid: false, error: 'CTRADER_CLIENT_ID not configured in environment' };
  }
  if (!clientSecret) {
    return { valid: false, error: 'CTRADER_CLIENT_SECRET not configured in environment' };
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
    console.log(`[Account] 📊 Trader data:`, {
      hasTrader: !!traderData.trader,
      balanceInCents: traderData.trader?.balance,
      equityInCents: traderData.trader?.equity,
      balance: traderData.trader?.balance ? traderData.trader.balance / 100 : 0,
      equity: traderData.trader?.equity ? traderData.trader.equity / 100 : 0,
    });

    // cTrader response structure: { ctidTraderAccountId, trader: { balance, equity, ... } }
    // ⚠️ CRITICAL: All monetary values in cTrader are in CENTS and must be divided by 100
    const trader = traderData.trader || {};

    return c.json({
      success: true,
      data: {
        accountId: credentials.accountId,
        balance: trader.balance ? trader.balance / 100 : 0,
        equity: trader.equity ? trader.equity / 100 : 0,
        freeMargin: trader.freeMargin ? trader.freeMargin / 100 : 0,
        margin: trader.margin ? trader.margin / 100 : 0,
        leverage: trader.leverageInCents ? trader.leverageInCents / 100 : 1,
        currency: 'USD', // TODO: Get from trader data
        isDemo: credentials.isDemo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Account] Error:', error);
    console.error('[Account] Error message:', error?.message);
    console.error('[Account] Error stack:', error?.stack);
    console.error('[Account] Error name:', error?.name);
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
    }, true); // ✅ Skip account auth for getAccounts endpoint

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

/**
 * POST /api/reconnect
 * Force reconnection for an account
 * Closes existing connection and creates a fresh one
 */
app.post('/api/reconnect', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Reconnect] Forcing reconnection for account ${credentials.accountId} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Invalidate existing connection
    connectionPool.invalidateConnection(credentials);
    console.log(`[Reconnect] ✅ Old connection invalidated`);

    // Force creation of new connection by making a request
    await connectionPool.withConnection(credentials, async (client) => {
      // Just test the connection with a simple account request
      return await client.getTrader(credentials.accountId);
    });

    console.log(`[Reconnect] ✅ New connection established successfully`);

    return c.json({
      success: true,
      message: 'Connection re-established',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Reconnect] Error:', error);
    return c.json(handleError(error, 'api/reconnect'), 500);
  }
});

/**
 * POST /api/candles
 * Fetch historical candles (OHLCV data) via cTrader WebSocket
 */
app.post('/api/candles', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { symbol, timeframe, fromTimestamp, toTimestamp, count } = body;
    
    if (!symbol || !timeframe) {
      return c.json({ error: 'symbol and timeframe are required' }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Candles] Fetching candles for ${symbol} ${timeframe} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Use connection pool to execute request
    const candlesData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getTrendbars({
        accountId: credentials.accountId,
        symbol,
        period: timeframe,
        fromTimestamp,
        toTimestamp,
        count: count || 100,
      });
    });

    console.log(`[Candles] ✅ Success - ${candlesData.trendbar?.length || 0} candles`);

    return c.json({
      success: true,
      data: {
        candles: candlesData.trendbar || [],
        symbol,
        timeframe,
        accountId: credentials.accountId,
        isDemo: credentials.isDemo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Candles] Error:', error);
    return c.json(handleError(error, 'api/candles'), 500);
  }
});

/**
 * POST /api/quote
 * Get real-time quote for a symbol
 */
app.post('/api/quote', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { symbol } = body;
    
    if (!symbol) {
      return c.json({ error: 'symbol is required' }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Quote] Fetching quote for ${symbol} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Subscribe to spot event and get latest price
    const quoteData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.subscribeToSpotEvent(credentials.accountId, symbol);
    });

    console.log(`[Quote] ✅ Success for ${symbol}`);

    return c.json({
      success: true,
      data: {
        symbol,
        bid: quoteData.bid || 0,
        ask: quoteData.ask || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Quote] Error:', error);
    return c.json(handleError(error, 'api/quote'), 500);
  }
});

/**
 * POST /api/trade/market
 * Place a market order
 */
app.post('/api/trade/market', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { symbol, volume, side, stopLoss, takeProfit } = body;
    
    if (!symbol || !volume || !side) {
      return c.json({ error: 'symbol, volume, and side are required' }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Trade] Placing market ${side} order: ${symbol} ${volume} lots (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    // Use connection pool to execute request
    const orderData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.placeMarketOrder({
        accountId: credentials.accountId,
        symbol,
        volume: volume * 100, // Convert to centiLots
        tradeSide: side === 'BUY' ? 'BUY' : 'SELL',
        stopLoss,
        takeProfit,
      });
    });

    console.log(`[Trade] ✅ Market order placed successfully`);

    return c.json({
      success: true,
      data: orderData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trade] Market order error:', error);
    return c.json(handleError(error, 'api/trade/market'), 500);
  }
});

/**
 * POST /api/trade/limit
 * Place a limit order
 */
app.post('/api/trade/limit', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { symbol, volume, side, price, stopLoss, takeProfit } = body;
    
    if (!symbol || !volume || !side || !price) {
      return c.json({ error: 'symbol, volume, side, and price are required' }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Trade] Placing limit ${side} order: ${symbol} ${volume} lots @ ${price} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    const orderData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.placeLimitOrder({
        accountId: credentials.accountId,
        symbol,
        volume: volume * 100, // Convert to centiLots
        tradeSide: side === 'BUY' ? 'BUY' : 'SELL',
        limitPrice: price,
        stopLoss,
        takeProfit,
      });
    });

    console.log(`[Trade] ✅ Limit order placed successfully`);

    return c.json({
      success: true,
      data: orderData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trade] Limit order error:', error);
    return c.json(handleError(error, 'api/trade/limit'), 500);
  }
});

/**
 * POST /api/trade/stop
 * Place a stop order
 */
app.post('/api/trade/stop', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { symbol, volume, side, price, stopLoss, takeProfit } = body;
    
    if (!symbol || !volume || !side || !price) {
      return c.json({ error: 'symbol, volume, side, and price are required' }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Trade] Placing stop ${side} order: ${symbol} ${volume} lots @ ${price} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    const orderData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.placeStopOrder({
        accountId: credentials.accountId,
        symbol,
        volume: volume * 100, // Convert to centiLots
        tradeSide: side === 'BUY' ? 'BUY' : 'SELL',
        stopPrice: price,
        stopLoss,
        takeProfit,
      });
    });

    console.log(`[Trade] ✅ Stop order placed successfully`);

    return c.json({
      success: true,
      data: orderData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trade] Stop order error:', error);
    return c.json(handleError(error, 'api/trade/stop'), 500);
  }
});

/**
 * POST /api/trade/modify
 * Modify an existing position (update stop loss / take profit)
 */
app.post('/api/trade/modify', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { positionId, stopLoss, takeProfit } = body;
    
    if (!positionId) {
      return c.json({ error: 'positionId is required' }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Trade] Modifying position ${positionId} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    const modifyData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.modifyPosition({
        accountId: credentials.accountId,
        positionId,
        stopLoss,
        takeProfit,
      });
    });

    console.log(`[Trade] ✅ Position modified successfully`);

    return c.json({
      success: true,
      data: modifyData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trade] Modify position error:', error);
    return c.json(handleError(error, 'api/trade/modify'), 500);
  }
});

/**
 * POST /api/trade/close
 * Close a position
 */
app.post('/api/trade/close', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { positionId } = body;
    
    if (!positionId) {
      return c.json({ error: 'positionId is required' }, 400);
    }

    const credentials = validation.credentials!;
    console.log(`[Trade] Closing position ${positionId} (${credentials.isDemo ? 'DEMO' : 'LIVE'})`);

    const closeData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.closePosition({
        accountId: credentials.accountId,
        positionId,
      });
    });

    console.log(`[Trade] ✅ Position closed successfully`);

    return c.json({
      success: true,
      data: closeData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trade] Close position error:', error);
    return c.json(handleError(error, 'api/trade/close'), 500);
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
      'POST /api/reconnect',
      'POST /api/candles',
      'POST /api/quote',
      'POST /api/trade/market',
      'POST /api/trade/limit',
      'POST /api/trade/stop',
      'POST /api/trade/modify',
      'POST /api/trade/close',
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
console.log('  ✅ Trade Execution (Market, Limit, Stop)');
console.log('  ✅ Position Management (Modify, Close)');
console.log('  ✅ Historical Data & Real-time Quotes');
console.log('');
console.log('Endpoints:');
console.log('  GET  /health               - Health check');
console.log('  GET  /stats                - Connection pool stats');
console.log('  POST /api/account          - Fetch account data');
console.log('  POST /api/positions        - Fetch positions');
console.log('  POST /api/symbols          - Fetch symbols');
console.log('  POST /api/accounts         - List accounts');
console.log('  POST /api/reconnect        - Force reconnect');
console.log('  POST /api/candles          - Fetch historical candles');
console.log('  POST /api/quote            - Get real-time quote');
console.log('  POST /api/trade/market     - Place market order');
console.log('  POST /api/trade/limit      - Place limit order');
console.log('  POST /api/trade/stop       - Place stop order');
console.log('  POST /api/trade/modify     - Modify position');
console.log('  POST /api/trade/close      - Close position');
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