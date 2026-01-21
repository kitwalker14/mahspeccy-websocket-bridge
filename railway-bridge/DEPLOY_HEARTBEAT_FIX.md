# Railway Bridge - Heartbeat Fix Deployment Guide

## Changes Implemented

### ✅ Fix #1: Manual Heartbeat During Spot Event Wait (CRITICAL)

**File:** `/railway-bridge/ctrader-client.ts`

**Changes:**
1. Added `sendManualHeartbeat()` method (line ~234)
   - Sends WebSocket heartbeat on-demand to keep connection alive
   - Non-blocking, doesn't throw errors if it fails
   
2. Updated `subscribeToSpotEvent()` method (line ~953)
   - Now sends heartbeat every 3 seconds during the 10-second wait for spot events
   - Tracks last heartbeat timestamp to avoid spamming
   - Enhanced error logging with connection state diagnostics

**Why This Fixes The Issue:**
- cTrader closes idle WebSocket connections after ~30 seconds
- During the 10-second wait for spot events, no messages were being sent
- Connection would drop if the background heartbeat (every 25s) didn't fire during the wait
- Manual heartbeats keep the connection alive during long waits

---

## Deployment Steps

### Option 1: Deploy to Railway.app (RECOMMENDED)

1. **Commit changes to Git:**
   ```bash
   cd railway-bridge
   git add ctrader-client.ts
   git commit -m "Fix: Add heartbeat during spot event wait to prevent WebSocket timeout"
   git push origin main
   ```

2. **Railway will auto-deploy** (if connected to GitHub)
   - Go to https://railway.app
   - Check deployment logs
   - Verify deployment completes successfully

3. **Manual deployment (if needed):**
   ```bash
   railway up
   ```

### Option 2: Local Testing First

1. **Run Railway Bridge locally:**
   ```bash
   cd railway-bridge
   deno run --allow-net --allow-env --allow-read server.ts
   ```

2. **Test quote endpoint:**
   ```bash
   curl -X POST http://localhost:8080/api/quote \
     -H "Content-Type: application/json" \
     -d '{
       "accessToken": "YOUR_ACCESS_TOKEN",
       "accountId": "45287985",
       "isDemo": true,
       "symbolId": 1
     }'
   ```

3. **Expected logs:**
   ```
   [CTraderClient] 📊 subscribeToSpotEvent called for symbolId=1
   [CTraderClient] 📤 Sending PROTO_OA_SUBSCRIBE_SPOTS_REQ for symbolId=1
   [CTraderClient] ✅ PROTO_OA_SUBSCRIBE_SPOTS_RES received
   [CTraderClient] ⏳ Waiting for spot event for symbolId=1...
   [CTraderClient] 💓 Sending heartbeat during spot wait (elapsed: 3000ms)...
   [CTraderClient] 💓 Manual heartbeat sent during wait
   [CTraderClient] 💰 ========== SPOT EVENT RECEIVED ==========
   [CTraderClient] 💰 Symbol ID: 1
   [CTraderClient] 💰 Bid: 1.04567 (new)
   [CTraderClient] 💰 Ask: 1.04589 (new)
   [CTraderClient] ✅ Cached spot data for symbolId=1: bid=1.04567, ask=1.04589
   [CTraderClient] ✅ Spot event received! bid=1.04567, ask=1.04589
   ```

4. **If successful, deploy to Railway**

---

## Verification Checklist

After deployment, verify the fix is working:

### 1. Check Railway Bridge Logs
```bash
railway logs
```

Look for:
- ✅ `💓 Sending heartbeat during spot wait` - Heartbeats are being sent
- ✅ `✅ Spot event received! bid=X.XXXXX, ask=X.XXXXX` - Quotes working
- ❌ `❌ WebSocket connection lost while waiting for spot event` - Still broken

### 2. Test From Frontend
1. Open mahSpeccy app
2. Go to Trade Execution panel
3. Select symbol: EURUSD
4. Click "Validate Trade"
5. Check console logs

**Expected:**
- ✅ No "WebSocket connection lost" errors
- ✅ Quote appears with valid bid/ask prices
- ✅ Validation passes

**If Still Failing:**
- Check if forex markets are open (Mon-Fri, not weekends)
- Check Railway Bridge is running (`railway status`)
- Check Railway Bridge URL environment variable is correct

### 3. Monitor Connection Stability
Watch Railway logs for 5-10 minutes:
```bash
railway logs --follow
```

Look for:
- ✅ Regular heartbeats: `💓 Sending heartbeat (timestamp)...`
- ✅ Successful spot events: `💰 ========== SPOT EVENT RECEIVED ==========`
- ❌ Connection drops: `❌ ========== WEBSOCKET CLOSED ==========`

---

## Rollback Plan

If the fix causes issues:

1. **Revert the commit:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or redeploy previous version:**
   ```bash
   railway rollback
   ```

3. **Or disable heartbeat temporarily:**
   Edit `ctrader-client.ts` line ~960:
   ```typescript
   // Temporarily disable manual heartbeat for testing
   // if (Date.now() - lastHeartbeat > 3000) {
   //   await this.sendManualHeartbeat();
   //   lastHeartbeat = Date.now();
   // }
   ```

---

## Next Steps

After this fix is deployed and verified:

### Recommended (High Priority):
1. **Pre-subscribe to common forex pairs** (Fix #2 from audit report)
   - Subscribe to EURUSD, GBPUSD, USDJPY, etc. on connection
   - Reduces latency for first quote request

2. **Monitor spot event frequency**
   - Track how often cTrader sends spot events
   - Identify symbols that don't send events (market closed)

### Optional (Medium Priority):
1. **Add connection pool metrics**
   - Track connection age, usage, health
   - Identify stale connections proactively

2. **Implement exponential backoff for subscription retries**
   - If spot event doesn't arrive, retry subscription with backoff

---

## Support

If you encounter issues:

1. **Check logs first:**
   - Railway Bridge logs: `railway logs`
   - Frontend console: Browser DevTools
   - Supabase Edge Function logs: Supabase Dashboard

2. **Common Issues:**
   - **Markets closed:** Expected on weekends
   - **Access token expired:** Refresh OAuth token
   - **Wrong symbolId:** Use symbol lookup endpoint first

3. **Contact:**
   - Railway Bridge issues: Check `/railway-bridge/README.md`
   - cTrader API docs: https://help.ctrader.com/open-api/

---

**End of Deployment Guide**
