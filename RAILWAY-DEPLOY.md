# 🚂 One-Click Railway Deployment

## Fastest Way to Deploy (5 minutes)

### Option 1: Deploy Button (Coming Soon)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

*Note: Template link will be available once you push to GitHub*

---

### Option 2: Manual Deployment (Recommended)

#### Step 1: Push to GitHub

```bash
# From your project root
git add websocket-server/
git commit -m "Add WebSocket Bridge server"
git push origin main
```

#### Step 2: Railway Setup

1. **Go to Railway**: https://railway.app/new
2. **Sign in** with GitHub
3. **Click "Deploy from GitHub repo"**
4. **Select your repository**
5. **Click "Add variables"**

#### Step 3: Configure

**Root Directory** (IMPORTANT!):
```
websocket-server
```

**Environment Variables**:
```bash
# Click "Add Variable" for each:

SUPABASE_URL=https://zeyavgzsotipkxvscimp.supabase.co

SUPABASE_SERVICE_ROLE_KEY=
# 👆 Get from: https://supabase.com/dashboard/project/zeyavgzsotipkxvscimp/settings/api
# Copy the "service_role" key (NOT anon key!)

CTRADER_CLIENT_ID=
# 👆 Already configured in your Edge Functions
# Same value as CTRADER_CLIENT_ID environment variable

CTRADER_CLIENT_SECRET=
# 👆 Already configured in your Edge Functions  
# Same value as CTRADER_CLIENT_SECRET environment variable

NODE_ENV=production
```

#### Step 4: Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes ⏳
3. Railway builds and deploys automatically
4. You'll see **"Deployment successful"** ✅

#### Step 5: Get Your URL

1. In Railway dashboard, go to **"Settings"** tab
2. Under **"Domains"**, click **"Generate Domain"**
3. Railway assigns URL like: `mahspeccy-websocket-production.up.railway.app`
4. **Copy this URL** - you'll need it!

#### Step 6: Test It

```bash
# Replace with your Railway URL
curl https://your-app.up.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "uptime": 12.34,
  "activeSessions": 0,
  "timestamp": "2025-11-23T..."
}
```

#### Step 7: Update Frontend

**Edit `/utils/websocket-bridge.ts`** in your mahSpeccy app:

```typescript
// Change this line:
export const WEBSOCKET_BRIDGE_URL = process.env.WEBSOCKET_BRIDGE_URL || 'http://localhost:3000';

// To (replace with YOUR Railway URL):
export const WEBSOCKET_BRIDGE_URL = 'https://your-app.up.railway.app';
```

**Or better - use environment variable**:

In Supabase Edge Functions settings, add:
```
WEBSOCKET_BRIDGE_URL=https://your-app.up.railway.app
```

Then in `/utils/websocket-bridge.ts`:
```typescript
export const WEBSOCKET_BRIDGE_URL = 
  (typeof Deno !== 'undefined' ? Deno.env.get('WEBSOCKET_BRIDGE_URL') : null) ||
  'http://localhost:3000';
```

#### Step 8: Done! 🎉

Your WebSocket bridge is live!

---

## Verify Everything Works

### Test 1: Health Check ✅

```bash
curl https://your-railway-url.up.railway.app/health
```

Expected: `{"status":"ok",...}`

### Test 2: Run Test Script ✅

```bash
cd websocket-server
npm install
SERVER_URL=https://your-railway-url.up.railway.app npm test
```

### Test 3: Connect from mahSpeccy ✅

1. Open mahSpeccy in browser
2. Login with your account
3. Go to Settings → Connect cTrader
4. Check browser console for: `✅ [WebSocket Bridge] Started`
5. Check Dashboard - balance should update automatically every 2 seconds!

---

## What Happens Next?

Once deployed, the flow is:

```
1. You login to mahSpeccy
   ↓
2. Frontend calls: startWebSocket(your_email)
   ↓
3. Railway server receives request
   ↓
4. Server connects to cTrader WebSocket
   ↓
5. Real-time data streams from cTrader
   ↓
6. Server writes to Supabase cache every 2s
   ↓
7. mahSpeccy Dashboard reads from cache
   ↓
8. You see real balance! 🎊
```

**No more**:
- ❌ "Load Real Data" button
- ❌ Timeouts and errors
- ❌ Stale $10,000 demo data

**You get**:
- ✅ Real-time balance updates
- ✅ Auto-refreshing positions
- ✅ Live trade notifications
- ✅ Reliable, production-ready data

---

## Monitoring Your Deployment

### View Logs

Railway Dashboard → **Deployments** → Click latest deployment → **View Logs**

Look for:
```
✅ Server ready to accept connections
🔌 Connecting to wss://demo.ctraderapi.com...
✅ WebSocket Connected
💰 Account updated: $12,345 USD
✅ Cache updated
```

### Check Active Sessions

```bash
curl https://your-railway-url.up.railway.app/api/sessions
```

You should see your user in the list when connected.

### Resource Usage

Railway Dashboard → **Metrics** tab

Monitor:
- CPU usage (should be <10% idle, <50% active)
- Memory usage (should be <200MB)
- Network I/O

---

## Troubleshooting

### "Application failed to respond"

**Fix**:
1. Check Railway logs for errors
2. Verify environment variables are set
3. Make sure Root Directory = `websocket-server`

### "Service Unavailable"

**Fix**:
1. Railway might be deploying - wait 1-2 mins
2. Check Railway status: https://railway.statuspage.io/

### Frontend can't connect

**Fix**:
1. Check `WEBSOCKET_BRIDGE_URL` is correct
2. Test health endpoint manually
3. Check browser console for CORS errors

### "No cTrader configuration found"

**Fix**: 
1. Go to mahSpeccy Settings
2. Click "Connect cTrader"
3. Authorize with cTrader OAuth
4. Try again

---

## Cost

### Railway Pricing

- **Hobby Plan**: $5/month
  - ✅ 500 hours/month (enough for 24/7)
  - ✅ $5 credit included (FREE first month!)
  - ✅ Auto-deploy from GitHub
  - ✅ Custom domains
  - ✅ Metrics & logs

- **Free Trial**: $5 credit
  - Use for ~1 month of testing
  - No credit card required initially

### Estimated Monthly Cost

```
Server runtime: $5/month (Railway Hobby)
Supabase: $0 (free tier)
cTrader API: $0 (free)
---
Total: $5/month (or FREE for first month with trial credit)
```

**Worth it?**
- ✅ Yes! For reliable, real-time trading data
- ✅ Much better than manually clicking "Refresh" buttons
- ✅ Required for auto-trading features
- ✅ Production-ready, professional solution

---

## Next Steps After Deployment

1. **Test thoroughly** - Make sure WebSocket stays connected 24/7
2. **Monitor for 1 week** - Check logs daily, ensure stability
3. **Remove "Load Real Data" button** - No longer needed!
4. **Enable auto-trading** - Now reliable enough for automated trades
5. **Add more users** - Server handles multiple concurrent sessions

---

## Quick Reference

| What | Where |
|------|-------|
| **Deploy** | https://railway.app/new |
| **Supabase API Key** | https://supabase.com/dashboard/project/zeyavgzsotipkxvscimp/settings/api |
| **cTrader App** | https://openapi.ctrader.com/apps |
| **Railway Status** | https://railway.statuspage.io/ |
| **cTrader Status** | https://status.spotware.com |
| **Test Script** | `cd websocket-server && npm test` |
| **Logs** | Railway Dashboard → Deployments → View Logs |

---

## Support

Having issues? Check:

1. ✅ Environment variables are set correctly
2. ✅ Root directory = `websocket-server`
3. ✅ Railway deployment succeeded
4. ✅ Health endpoint returns 200 OK
5. ✅ cTrader is connected in mahSpeccy Settings

Still stuck? Run the test script:
```bash
cd websocket-server
SERVER_URL=https://your-url.up.railway.app npm test
```

This will diagnose the issue!

---

**You're all set!** 🚀

Your mahSpeccy app now has production-grade, real-time trading data streaming 24/7. Enjoy!
