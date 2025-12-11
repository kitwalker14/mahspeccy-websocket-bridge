# 🚨 URGENT: Deploy Updated Railway Bridge

## Problem Identified
The Railway Bridge at `https://mahspeccy-websocket-bridge-production.up.railway.app` is experiencing:
1. **"Connection closed"** errors - WebSocket timing out during authentication
2. **"Message missing required fields: accessToken"** - Already fixed in code (accessToken correctly omitted from SymbolsListReq)

## Solution Applied
✅ Increased WebSocket connection timeout from 10s to 15s in `/railway-bridge/ctrader-client.ts`
✅ Code already correctly handles Proto OA message schemas

## ⚡ DEPLOY NOW - 3 Options

### Option 1: GitHub Auto-Deploy (RECOMMENDED - 2 minutes)
```bash
cd /path/to/railway-bridge-github-repo
cp -r /path/to/mahSpeccy/railway-bridge/* .
git add .
git commit -m "fix: increase WebSocket timeout to 15s for authentication stability"
git push origin main
```
Railway will auto-deploy within 1-2 minutes.

### Option 2: Railway CLI Deploy (3 minutes)
```bash
cd railway-bridge
railway login
railway up
```

### Option 3: Railway Dashboard Manual Deploy
1. Go to https://railway.app/dashboard
2. Find project: `mahspeccy-websocket-bridge-production`
3. Click "Deployments" tab
4. Click "Deploy" button
5. Wait ~2 minutes for deployment

## Files Changed
- `/railway-bridge/ctrader-client.ts` - Line 69: timeout increased 10s → 15s

## Verification After Deploy
After deployment completes (~2 min), test with:

```bash
curl https://mahspeccy-websocket-bridge-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": <low number>,
  "version": "2.0.0"
}
```

Then click "Diagnostics" button in mahSpeccy app to test account connection.

## Expected Result
✅ No more "Connection closed" errors
✅ Account data loads successfully
✅ Symbols load successfully
✅ Positions load successfully

## Timeline
- **Deploy time:** 2 minutes
- **Test time:** 1 minute  
- **Total:** 3 minutes to full resolution

## Next Steps After Deploy Works
1. Remove this URGENT_DEPLOY_NOW.md file
2. Test all endpoints (Account, Symbols, Positions)
3. Verify Dashboard shows real data
