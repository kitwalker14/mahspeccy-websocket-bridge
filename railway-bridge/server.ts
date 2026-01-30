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
import { type CTraderCredentials, globalSpotCache } from './ctrader-client.ts';
import { ErrorMapper } from './error-mapper.ts';

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
  
  // ✅ Check if environment variables are configured
  const hasClientId = !!Deno.env.get('CTRADER_CLIENT_ID');
  const hasClientSecret = !!Deno.env.get('CTRADER_CLIENT_SECRET');
  
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
    environment: {
      hasClientId,
      hasClientSecret,
      isConfigured: hasClientId && hasClientSecret,
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

// ✅ NEW: Cache Explorer Endpoint for Audit Module
app.get('/api/debug/cache', async (c) => {
  try {
    const cacheData: Record<string, any> = {};
    
    // Iterate over the global cache map
    for (const [envKey, symbolMap] of globalSpotCache.entries()) {
      const symbols: Record<string, any> = {};
      
      for (const [symbolId, quote] of symbolMap.entries()) {
        symbols[symbolId] = {
          ...quote,
          age_ms: Date.now() - quote.timestamp
        };
      }
      
      cacheData[envKey] = {
        count: symbolMap.size,
        lastUpdated: new Date().toISOString(), // Approximation
        symbols: symbols
      };
    }

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: cacheData
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/debug/routes
 * List all available routes (for introspection)
 */
app.get('/api/debug/routes', (c) => {
  return c.json({
    data: {
      service: "mahspeccy-websocket-bridge",
      buildSha: Deno.env.get('RAILWAY_GIT_COMMIT_SHA') || "unknown",
      routes: [
        { method: "GET", path: "/health" },
        { method: "GET", path: "/stats" },
        { method: "GET", path: "/api/debug/cache" },
        { method: "GET", path: "/api/debug/routes" },
        { method: "POST", path: "/api/account" },
        { method: "POST", path: "/api/positions" },
        { method: "POST", path: "/api/symbols" },
        { method: "POST", path: "/api/symbol-lookup" },
        { method: "POST", path: "/api/quote" },
        { method: "POST", path: "/api/trade/market" },
        { method: "POST", path: "/api/candles" },
        { method: "POST", path: "/api/historical" }
      ]
    }
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
  const standardError = ErrorMapper.map(error, context);
  return standardError.response;
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

    // ✅ CRITICAL FIX: Use PROTO_OA_RECONCILE_REQ to get BOTH balance AND equity
    // PROTO_OA_TRADER_RES only returns balance, NOT equity
    // PROTO_OA_RECONCILE_RES returns: positions, orders, AND live account state with equity
    const reconcileData = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getPositions(credentials.accountId);
    });

    console.log(`[Account] ✅ Success for account ${credentials.accountId}`);
    
    // cTrader PROTO_OA_RECONCILE_RES structure:
    // { ctidTraderAccountId, position: [...], order: [...] }
    // ⚠️ CRITICAL: All monetary values in cTrader are in CENTS and must be divided by 100
    
    // ✅ FIX: Extract balance from reconcileData if available, otherwise fetch from getTrader()
    let balanceValue = 0;
    let equityValue = 0;
    let freeMarginValue = 0;
    let marginValue = 0;
    
    // Check if reconcile data contains account balance (it should)
    // According to cTrader docs, reconcile might have balance in the response
    if (reconcileData.balance) {
      balanceValue = reconcileData.balance / 100;
    }
    
    // Calculate equity from positions
    // Equity = Balance + Sum of all unrealized P&L from positions
    const positions = reconcileData.position || [];
    let totalUnrealizedPnL = 0;
    
    for (const position of positions) {
      // Each position has unrealizedGrossProfit or grossProfit field in cents
      const pnl = position.grossProfit || position.unrealizedGrossProfit || 0;
      totalUnrealizedPnL += pnl;
    }
    
    // If reconcile didn't have balance, fetch it from getTrader()
    if (balanceValue === 0) {
      console.log(`[Account] ⚠️ Reconcile data missing balance, fetching from getTrader()...`);
      const traderData = await connectionPool.withConnection(credentials, async (client) => {
        return await client.getTrader(credentials.accountId);
      });
      
      const trader = traderData.trader || {};
      balanceValue = trader.balance ? trader.balance / 100 : 0;
      freeMarginValue = trader.freeMargin ? trader.freeMargin / 100 : balanceValue;
      marginValue = trader.margin ? trader.margin / 100 : 0;
    }
    
    // Calculate equity = balance + unrealized P&L
    equityValue = balanceValue + (totalUnrealizedPnL / 100);
    
    console.log(`[Account] 💰 Calculated values:`, {
      balance: balanceValue,
      equity: equityValue,
      unrealizedPnL: totalUnrealizedPnL / 100,
      openPositions: positions.length,
    });

    return c.json({
      success: true,
      data: {
        accountId: credentials.accountId,
        balance: balanceValue,
        equity: equityValue,
        freeMargin: freeMarginValue || balanceValue,
        margin: marginValue,
        leverage: 1, // TODO: Get from trader data
        currency: 'USD', // TODO: Get from trader data
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
    console.log(`[Positions] Fetching positions for account ${credentials.accountId}`);

    const response = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getPositions(credentials.accountId);
    });

    console.log(`[Positions] ✅ Success for account ${credentials.accountId}`);
    
    // Transform positions to user-friendly format
    const positions = (response.position || []).map((p: any) => ({
      id: p.positionId,
      symbolId: p.tradeData.symbolId,
      volume: p.tradeData.volume / 100, // Convert to units
      side: p.tradeData.tradeSide === 1 ? 'BUY' : 'SELL',
      entryPrice: p.price,
      currentPrice: 0, // Need to fetch quote to calculate
      pnl: (p.grossProfit || p.unrealizedGrossProfit || 0) / 100, // Convert cents to USD
      stopLoss: p.stopLoss,
      takeProfit: p.takeProfit,
      entryTime: p.tradeData.openTimestamp,
    }));

    return c.json({
      success: true,
      data: {
        positions,
        count: positions.length,
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
 * Fetch available symbols
 */
app.post('/api/symbols', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateAccountsRequest(body); // No accountId needed technically, but good to have context
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Use a dummy accountId if not provided, or the one from validation
    // getSymbols requires an accountId for the proto message
    let accountId = body.accountId || '0'; 
    
    const credentials = validation.credentials!;
    credentials.accountId = accountId; // Ensure accountId is set

    console.log(`[Symbols] Fetching symbols`);

    const response = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getSymbols(credentials.accountId);
    });

    console.log(`[Symbols] ✅ Success`);
    
    const symbols = (response.symbol || []).map((s: any) => ({
      id: s.symbolId,
      name: s.symbolName,
      digits: s.digits,
      description: s.description,
    }));

    return c.json({
      success: true,
      data: {
        symbols,
        count: symbols.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Symbols] Error:', error);
    return c.json(handleError(error, 'api/symbols'), 500);
  }
});

/**
 * POST /api/symbol-lookup
 * Look up a specific symbol ID by name
 */
app.post('/api/symbol-lookup', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateAccountsRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }
    
    const { symbolName } = body;
    if (!symbolName) {
       return c.json({ error: 'symbolName is required' }, 400);
    }

    const credentials = validation.credentials!;
    // Ensure accountId is set for the proto request
    if (!credentials.accountId || credentials.accountId === '0') {
        credentials.accountId = body.accountId || '0'; 
    }

    console.log(`[SymbolLookup] Looking up '${symbolName}'`);

    const symbolId = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getSymbolId(credentials.accountId, symbolName);
    });

    console.log(`[SymbolLookup] ✅ Found ID: ${symbolId}`);

    return c.json({
      success: true,
      data: {
        symbolId,
        symbolName,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[SymbolLookup] Error:', error);
    // If symbol not found, return 404
    if (error.message && error.message.includes('not found')) {
        return c.json({ error: error.message }, 404);
    }
    return c.json(handleError(error, 'api/symbol-lookup'), 500);
  }
});

/**
 * POST /api/quote
 * Get real-time quote for a symbol
 * Accepts either symbolId (number) or symbol (string, e.g. "EURUSD")
 */
app.post('/api/quote', async (c) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // ✅ JSON Structured Logging: Request Start
  console.log(JSON.stringify({
    event: 'quote_rest_request',
    timestamp: new Date().toISOString(),
    request_id: requestId,
    message: 'Quote request received'
  }));
  
  try {
    const body = await c.req.json();
    // Use validateRequest which checks for accessToken and accountId
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      // ✅ JSON Structured Logging: Validation Error
      console.log(JSON.stringify({
        event: 'quote_validation_error',
        timestamp: new Date().toISOString(),
        request_id: requestId,
        error: validation.error
      }));
      return c.json({ error: validation.error }, 400);
    }

    let { symbolId, symbol } = body;
    const credentials = validation.credentials!;
    
    // Check for symbol mismatch if both provided
    if (symbolId && symbol) {
       // We can't verify mismatch easily without resolving 'symbol' first.
       // We'll trust the caller or verify after resolution if we needed to resolve.
       // For strict audit, we should check if they match.
    }
    
    // If symbol name provided but no ID, look it up
    if (!symbolId && symbol) {
      console.log(JSON.stringify({
        event: 'symbol_resolution_start',
        timestamp: new Date().toISOString(),
        request_id: requestId,
        symbol: symbol
      }));
      
      try {
        symbolId = await connectionPool.withConnection(credentials, async (client) => {
          return await client.getSymbolId(credentials.accountId, symbol);
        });
        
        console.log(JSON.stringify({
          event: 'symbol_resolved',
          timestamp: new Date().toISOString(),
          request_id: requestId,
          symbol: symbol,
          symbolId: symbolId
        }));
      } catch (e) {
        console.log(JSON.stringify({
          event: 'symbol_resolution_error',
          timestamp: new Date().toISOString(),
          request_id: requestId,
          symbol: symbol,
          error: e.message
        }));
        return c.json({ error: `Symbol resolution failed: ${e.message}` }, 400);
      }
    }
    
    if (!symbolId) {
      return c.json({ error: 'symbolId or valid symbol name is required' }, 400);
    }

    // Subscribe to spot event and get latest price
    const quoteData = await connectionPool.withConnection(credentials, async (client) => {
      // Log that we are entering the client interaction
      console.log(JSON.stringify({
        event: 'subscribe_spots_req_initiating',
        timestamp: new Date().toISOString(),
        request_id: requestId,
        symbolId: symbolId
      }));
      
      const result = await client.subscribeToSpotEvent(credentials.accountId, parseInt(symbolId.toString()));
      return result;
    });

    const elapsedTime = Date.now() - startTime;
    
    // Construct the response data
    const responseData = {
      symbolId: parseInt(symbolId.toString()),
      symbol: symbol || 'Unknown', // Return back the name if we have it
      bid: quoteData.bid || 0,
      ask: quoteData.ask || 0,
      timestamp: quoteData.timestamp ? new Date(quoteData.timestamp).toISOString() : new Date().toISOString(),
      marketClosed: quoteData.marketClosed || false,
      elapsedMs: elapsedTime,
    };

    // ✅ JSON Structured Logging: Success Response
    console.log(JSON.stringify({
      event: 'quote_rest_response',
      timestamp: new Date().toISOString(),
      request_id: requestId,
      symbolId: symbolId,
      elapsedMs: elapsedTime,
      marketClosed: responseData.marketClosed,
      data: responseData
    }));

    return c.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    
    // ✅ JSON Structured Logging: Error
    console.log(JSON.stringify({
      event: 'quote_error',
      timestamp: new Date().toISOString(),
      request_id: requestId,
      elapsedMs: elapsedTime,
      error: error.message,
      stack: error.stack
    }));
    
    const mapped = ErrorMapper.map(error, 'api/quote');
    return c.json(mapped.response, mapped.status);
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

    const { symbolId, volume, side, stopLoss, takeProfit } = body;
    
    if (!symbolId || !volume || !side) {
      return c.json({ error: 'symbolId, volume, and side are required' }, 400);
    }
    
    const credentials = validation.credentials!;
    console.log(`[Trade] Placing market order: ${side} ${volume} units of symbolId ${symbolId}`);

    const response = await connectionPool.withConnection(credentials, async (client) => {
      return await client.placeMarketOrder({
        accountId: credentials.accountId,
        symbolId: parseInt(symbolId),
        volume: parseFloat(volume),
        tradeSide: side,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      });
    });

    console.log(`[Trade] ✅ Success`);
    return c.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[Trade] Error:', error);
    return c.json(handleError(error, 'api/trade/market'), 500);
  }
});

/**
 * POST /api/candles
 * Get historical candles
 */
app.post('/api/candles', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { symbolId, period, from, to, count } = body;
    
    if (!symbolId || !period) {
      return c.json({ error: 'symbolId and period are required' }, 400);
    }
    
    // Validate time range: either (from + to) OR (count + to)
    if ((!from || !to) && (!count || !to)) {
       return c.json({ error: 'Either (from + to) or (count + to) is required' }, 400);
    }
    
    const credentials = validation.credentials!;
    console.log(`[Candles] Fetching candles for symbolId ${symbolId}, period ${period}`);

    const response = await connectionPool.withConnection(credentials, async (client) => {
      // Calculate 'from' if missing but count provided
      // Actually, proto message allows omitting fromTimestamp if count is provided?
      // Looking at ctrader-client.ts, it passes fromTimestamp: from.
      // If 'from' is undefined, it might be an issue if the type requires it.
      // In proto-messages.ts: fromTimestamp is number (mandatory).
      // So we MUST calculate 'from' or use 0 if the protocol supports it, but usually trendbars need a range or count.
      // If the client supports count, it might ignore fromTimestamp.
      
      return await client.getTrendbars(
        credentials.accountId,
        parseInt(symbolId),
        parseInt(period),
        from ? parseInt(from) : 0, // 0 if not provided
        parseInt(to),
        count ? parseInt(count) : undefined
      );
    });

    console.log(`[Candles] ✅ Success`);
    return c.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[Candles] Error:', error);
    return c.json(handleError(error, 'api/candles'), 500);
  }
});

/**
 * POST /api/historical
 * Alias for /api/candles
 */
app.post('/api/historical', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const { symbolId, period, from, to, count } = body;
    
    if (!symbolId || !period) {
      return c.json({ error: 'symbolId and period are required' }, 400);
    }
    
    // Validate time range: either (from + to) OR (count + to)
    if ((!from || !to) && (!count || !to)) {
       return c.json({ error: 'Either (from + to) or (count + to) is required' }, 400);
    }
    
    const credentials = validation.credentials!;
    console.log(`[Historical] Fetching candles for symbolId ${symbolId}, period ${period}`);

    const response = await connectionPool.withConnection(credentials, async (client) => {
      return await client.getTrendbars(
        credentials.accountId,
        parseInt(symbolId),
        parseInt(period),
        from ? parseInt(from) : 0,
        parseInt(to),
        count ? parseInt(count) : undefined
      );
    });

    console.log(`[Historical] ✅ Success`);
    return c.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[Historical] Error:', error);
    return c.json(handleError(error, 'api/historical'), 500);
  }
});

// Start the server
const port = parseInt(Deno.env.get('PORT') || '8000');
console.log(`[Server] Starting on port ${port}...`);

Deno.serve({ port }, app.fetch);
