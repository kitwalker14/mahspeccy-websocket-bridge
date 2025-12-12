# Railway Bridge - Connection Closed Error Fix

## Date: 2025-12-12

## Problem
The Railway Bridge was experiencing "Connection closed" errors when handling requests from Supabase. The WebSocket connections to cTrader were being dropped, causing 500 errors with CTRADER_ERROR messages.

## Root Causes Identified

1. **Stale Connection Reuse**: Connection pool was reusing connections without checking if they were still alive
2. **Long Idle Timeouts**: Connections were kept idle for 5 minutes, allowing cTrader to close them
3. **No Health Checks**: No validation that WebSocket was still OPEN before reusing
4. **No Reconnect Endpoint**: No way to force a fresh connection when errors occur

## Fixes Implemented

### 1. Connection Health Validation (`ctrader-client.ts`)
- Added `isHealthy()` method to check:
  - WebSocket exists
  - WebSocket.readyState === OPEN
  - Application authenticated

### 2. Enhanced Connection Management (`connection-pool.ts`)
- **maxIdleTime**: 5 minutes (UNCHANGED - per cTrader documentation)
- **maxConnectionAge**: 15 minutes (NEW - forces reconnection after 15 min)
- **Health Check**: Validate connection before reusing (NEW)
- **Track createdAt**: Monitor connection age (NEW)
- **Auto-disconnect unhealthy**: Remove dead connections immediately (NEW)

### 3. Reconnect Endpoint (`server.ts`)
- **New endpoint**: `POST /api/reconnect`
- **Functionality**:
  - Invalidates existing connection
  - Forces creation of fresh connection
  - Tests connection with account request
  - Returns success/failure status

### 4. Retry Logic Already Present
- Connection pool already had retry logic (2 attempts)
- Detects connection errors automatically
- Exponential backoff (1s, 2s)
- Removes failed connections from pool

## Testing & Verification

After redeploying to Railway, verify:

1. **Health Check**: `GET https://your-bridge.railway.app/health`
   - Should show connection pool stats

2. **Reconnect Endpoint**: `POST https://your-bridge.railway.app/api/reconnect`
   ```json
   {
     "accessToken": "YOUR_TOKEN",
     "accountId": "45287985",
     "isDemo": true
   }
   ```

3. **Connection Stats**: `GET https://your-bridge.railway.app/stats`
   - Monitor connection pool health

## Expected Improvements

1. ✅ **Faster Error Detection**: Unhealthy connections caught immediately
2. ✅ **Automatic Reconnection**: Stale connections replaced automatically
3. ✅ **Manual Override**: Users can force reconnect via button
4. ✅ **Connection Health Validation**: WebSocket state checked before reuse
5. ✅ **Connection Rotation**: 15-minute max age forces fresh connections

## Monitoring

Watch Railway logs for:
- `♻️ Reusing existing healthy connection` - Good, reusing working connection
- `❌ Existing connection is unhealthy` - Caught dead connection before use
- `🧹 Cleaned idle connection` - Normal cleanup after 5 minutes idle
- `🧹 Cleaned old connection` - Normal cleanup after 15 minutes age
- `⚠️ Connection error on attempt 1, retrying...` - Automatic retry in action

## Deployment Instructions

1. Commit all changes to Git
2. Push to GitHub repository
3. Railway will auto-deploy
4. Monitor Railway logs during deployment
5. Test reconnect endpoint after deployment
6. Verify no more "Connection closed" errors

## Files Modified

1. `/railway-bridge/ctrader-client.ts` - Added isHealthy() method
2. `/railway-bridge/connection-pool.ts` - Aggressive timeouts + health checks
3. `/railway-bridge/server.ts` - Added /api/reconnect endpoint