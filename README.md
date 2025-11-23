# mahSpeccy WebSocket Bridge Server

🚀 **External WebSocket service** that maintains persistent connections to cTrader and updates your Supabase cache in real-time.

## 🎯 What This Does

- ✅ Stays connected to cTrader 24/7 (no 8-second timeouts!)
- ✅ Receives real-time balance, positions, and trade updates
- ✅ Writes to Supabase cache every 2 seconds
- ✅ Auto-reconnects if connection drops
- ✅ Supports multiple user sessions simultaneously
- ✅ Graceful shutdown and error handling

## 📋 Prerequisites

- Node.js 18+ installed
- Supabase project with Service Role Key
- cTrader API credentials (Client ID & Secret)

## 🚀 Quick Start (Local Testing)

### 1. Install Dependencies

```bash
cd websocket-server
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase (get from: https://supabase.com/dashboard/project/_/settings/api)
SUPABASE_URL=https://zeyavgzsotipkxvscimp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# cTrader (get from: https://openapi.ctrader.com/apps)
CTRADER_CLIENT_ID=your_client_id_here
CTRADER_CLIENT_SECRET=your_client_secret_here

# Server
PORT=3000
NODE_ENV=development
```

### 3. Start Server

```bash
npm start
```

You should see:

```
╔═══════════════════════════════════════════════════════════════╗
║   🚀 mahSpeccy WebSocket Bridge Server                       ║
║   Status: ONLINE                                              ║
║   Port: 3000                                                  ║
╚═══════════════════════════════════════════════════════════════╝

✅ Server ready to accept connections
```

### 4. Test Health Check

Open browser to: `http://localhost:3000/health`

Should return:
```json
{
  "status": "ok",
  "uptime": 5.123,
  "activeSessions": 0,
  "timestamp": "2025-11-23T05:42:00.000Z"
}
```

---

## ☁️ Deploy to Railway.app (RECOMMENDED)

Railway is the easiest way to deploy - **one-click deployment**!

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Sign in with GitHub

### Step 2: Deploy from GitHub

**Option A: Use Template (Easiest)**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

1. Click the button above
2. Connect your GitHub account
3. Select repository
4. Add environment variables (see below)
5. Click "Deploy" - DONE!

**Option B: Manual Deployment**

1. Push this `websocket-server` folder to GitHub
2. In Railway dashboard, click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-detect `package.json` and build

### Step 3: Add Environment Variables

In Railway dashboard:

1. Click your project → "Variables" tab
2. Add these variables:

```
SUPABASE_URL=https://zeyavgzsotipkxvscimp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
CTRADER_CLIENT_ID=<your_client_id>
CTRADER_CLIENT_SECRET=<your_client_secret>
NODE_ENV=production
```

### Step 4: Get Your Server URL

1. Railway will auto-assign a URL like: `https://your-app.up.railway.app`
2. Copy this URL - you'll need it for the frontend integration
3. Test it: `https://your-app.up.railway.app/health`

### Step 5: Update Frontend (IMPORTANT!)

In your mahSpeccy app, create a new file:

**`/utils/websocket-bridge.ts`**

```typescript
// WebSocket Bridge configuration
export const WEBSOCKET_BRIDGE_URL = 'https://your-app.up.railway.app';

export async function startWebSocket(userId: string) {
  const response = await fetch(`${WEBSOCKET_BRIDGE_URL}/api/start-websocket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return response.json();
}

export async function stopWebSocket(userId: string) {
  const response = await fetch(`${WEBSOCKET_BRIDGE_URL}/api/stop-websocket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return response.json();
}

export async function getWebSocketStatus(userId: string) {
  const response = await fetch(`${WEBSOCKET_BRIDGE_URL}/api/websocket-status/${userId}`);
  return response.json();
}
```

**Replace** `https://your-app.up.railway.app` **with your actual Railway URL!**

---

## 🌐 Alternative Deployment Options

### Option 2: Render.com

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Add environment variables (same as Railway)
6. Click "Create Web Service"

⚠️ **Free tier sleeps after 15 mins of inactivity** (not ideal for 24/7 connections)

### Option 3: Your Own VPS (Advanced)

**Requirements**: Linux server with Node.js 18+

```bash
# SSH into your server
ssh user@your-server.com

# Clone repo
git clone <your-repo-url>
cd websocket-server

# Install dependencies
npm install

# Install PM2 (process manager)
npm install -g pm2

# Create .env file
nano .env
# (paste your environment variables)

# Start with PM2
pm2 start server.js --name mahspeccy-websocket
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs mahspeccy-websocket
```

**Recommended VPS providers**:
- DigitalOcean ($4/month Droplet)
- Linode ($5/month Nanode)
- Vultr ($3.50/month)

---

## 🔧 API Endpoints

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "uptime": 3600,
  "activeSessions": 2,
  "sessions": ["lance@lwk.space", "user2@example.com"],
  "timestamp": "2025-11-23T05:42:00.000Z"
}
```

### GET /api/sessions

Get all active WebSocket sessions.

**Response**:
```json
{
  "total": 1,
  "sessions": [
    {
      "userId": "lance@lwk.space",
      "isConnected": true,
      "accountId": "5150705",
      "lastUpdate": "2025-11-23T05:42:00.000Z",
      "balance": 10000,
      "positions": 2
    }
  ]
}
```

### POST /api/start-websocket

Start WebSocket connection for a user.

**Request**:
```json
{
  "userId": "lance@lwk.space"
}
```

**Response**:
```json
{
  "success": true,
  "message": "WebSocket connection started",
  "accountId": "5150705",
  "isDemo": true
}
```

### POST /api/stop-websocket

Stop WebSocket connection for a user.

**Request**:
```json
{
  "userId": "lance@lwk.space"
}
```

**Response**:
```json
{
  "success": true,
  "message": "WebSocket connection stopped",
  "wasConnected": true
}
```

### GET /api/websocket-status/:userId

Get WebSocket status for a specific user.

**Response**:
```json
{
  "connected": true,
  "accountId": "5150705",
  "lastUpdate": "2025-11-23T05:42:00.000Z",
  "balance": 10000,
  "equity": 10050,
  "positions": 2
}
```

---

## 🔐 Security Notes

- ✅ **Service Role Key**: Only used server-side, never exposed to frontend
- ✅ **User Isolation**: Each user's data is hashed and isolated
- ✅ **No CORS**: Only your Supabase Edge Functions can write to cache
- ⚠️ **Add Authentication**: In production, add API key or JWT authentication to endpoints

---

## 📊 Monitoring

### View Logs

**Railway**: Dashboard → "Logs" tab

**PM2** (VPS):
```bash
pm2 logs mahspeccy-websocket
```

### Check Active Sessions

```bash
curl https://your-app.up.railway.app/api/sessions
```

### Restart Server

**Railway**: Dashboard → "Deployments" → "Redeploy"

**PM2**:
```bash
pm2 restart mahspeccy-websocket
```

---

## 🐛 Troubleshooting

### "Failed to connect WebSocket"

**Check**:
1. cTrader credentials are correct
2. User has connected cTrader in Settings tab
3. Access token hasn't expired

**Fix**: User should reconnect cTrader in mahSpeccy Settings.

### "Cache update failed"

**Check**:
1. `SUPABASE_SERVICE_ROLE_KEY` is correct
2. Supabase project is online
3. Network connectivity

### WebSocket keeps disconnecting

**Check**:
1. cTrader server status: [status.spotware.com](https://status.spotware.com)
2. Server logs for error messages
3. Network stability

**Auto-reconnect**: The server will automatically retry up to 10 times.

---

## 💰 Cost Estimate

### Railway.app
- **Free**: $5/month credit (covers this server)
- **Hobby**: $5/month if you exceed free credit
- **Pro**: $20/month (for production apps)

### Render.com
- **Free**: Yes, but sleeps after 15 mins
- **Starter**: $7/month (24/7 uptime)

### VPS
- **DigitalOcean**: $4/month (cheapest Droplet)
- **Linode**: $5/month (Nanode 1GB)
- **Vultr**: $3.50/month (512MB)

**Recommended**: Railway.app free tier ($0-5/month)

---

## 🎉 Success Checklist

✅ Server deployed and running  
✅ `/health` endpoint returns 200 OK  
✅ Environment variables configured  
✅ Frontend updated with `WEBSOCKET_BRIDGE_URL`  
✅ User logged into mahSpeccy  
✅ cTrader connected in Settings  
✅ WebSocket started for user  
✅ Cache updating every 2 seconds  
✅ Balance shows real data!  

---

## 📞 Support

If you encounter issues:

1. **Check logs** (Railway dashboard or `pm2 logs`)
2. **Test health check**: `curl https://your-url/health`
3. **Verify environment variables** are set correctly
4. **Check cTrader status**: [status.spotware.com](https://status.spotware.com)

---

## 🚀 Next Steps

Once deployed, you can:

1. **Remove the "Load Real Data" button** - no longer needed!
2. **Get real-time updates** - balance updates automatically
3. **Enable auto-trading** - reliable enough for production
4. **Scale to multiple users** - server handles concurrent sessions

Enjoy your real-time trading data! 🎊
