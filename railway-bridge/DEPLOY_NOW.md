# 🚀 Deploy Railway Bridge NOW

## Quick Deployment Guide

Your Railway Bridge code is **ready to deploy**. Follow these steps to get it live on Railway.app.

---

## 📦 Files Ready for Deployment

All files in `/railway-bridge/` directory:

```
✅ server.ts                  - Main server
✅ connection-pool.ts         - WebSocket connection pooling
✅ connection-manager.ts      - Connection lifecycle management
✅ ctrader-client.ts          - cTrader API client
✅ message-router.ts          - Message routing logic
✅ proto-loader.ts            - Protocol Buffers loader
✅ proto-messages.ts          - ProtoOA message definitions
✅ railway.json               - Railway deployment config
✅ deno.json                  - Deno configuration

📁 ctrader/
  ✅ constants.ts             - cTrader constants
  ✅ errors.ts                - Error definitions
  ✅ logger.ts                - Logging utilities
  ✅ protobuf.ts              - Protobuf utilities
  ✅ tcp-client.ts            - TCP client (legacy)
  ✅ types.ts                 - TypeScript types

📁 proto/
  ✅ OpenApiCommonMessages.proto
  ✅ OpenApiCommonModelMessages.proto
  ✅ OpenApiMessages.proto
  ✅ OpenApiModelMessages.proto
```

---

## 🎯 Option 1: Deploy via Railway Dashboard (EASIEST)

### Step 1: Prepare Your Files

1. Download all files from `/railway-bridge/` directory
2. Create a zip file or prepare for GitHub upload

### Step 2: Go to Railway

1. Navigate to https://railway.app
2. Log in or create account
3. Click "New Project"

### Step 3: Deploy from GitHub (RECOMMENDED)

**If you have GitHub:**

1. Create a new repository on GitHub
2. Upload all files from `/railway-bridge/` to the repository
3. In Railway, click "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect the Deno project

**If you don't have GitHub:**

1. Click "Deploy from local directory"
2. Railway CLI will guide you through upload

### Step 4: Configure Environment Variables

In Railway Dashboard → Your Project → Variables:

```bash
# Required
CTRADER_CLIENT_ID=3_5az7pj935owsss8cs5s4ocgo84wgwk0kw8o4wco0kos0ow4k8
CTRADER_CLIENT_SECRET=<your_secret_here>

# Optional (Railway sets automatically)
PORT=8080
```

### Step 5: Deploy

1. Railway automatically deploys after you add variables
2. Wait 2-3 minutes for build and deployment
3. Note your Railway URL (e.g., `your-app.up.railway.app`)

### Step 6: Verify Deployment

```bash
# Test health endpoint
curl https://your-app.up.railway.app/health

# Should return:
{
  "status": "healthy",
  "version": "2.0.0",
  "connections": {...},
  "environment": {
    "isConfigured": true
  }
}
```

---

## 🎯 Option 2: Deploy via Railway CLI (ADVANCED)

### Prerequisites

```bash
# Install Railway CLI
npm install -g @railway/cli

# Or with Homebrew (Mac)
brew install railway
```

### Step 1: Login

```bash
railway login
```

### Step 2: Initialize Project

```bash
# Navigate to railway-bridge directory
cd railway-bridge

# Initialize new project or link existing
railway init
# OR
railway link
```

### Step 3: Set Environment Variables

```bash
# Set variables
railway variables set CTRADER_CLIENT_ID=3_5az7pj935owsss8cs5s4ocgo84wgwk0kw8o4wco0kos0ow4k8
railway variables set CTRADER_CLIENT_SECRET=<your_secret>
railway variables set PORT=8080
```

### Step 4: Deploy

```bash
# Deploy to Railway
railway up

# Railway will:
# 1. Upload your code
# 2. Build the Deno project
# 3. Start the server
# 4. Provide you with a URL
```

### Step 5: Monitor Logs

```bash
# View live logs
railway logs
```

---

## 🎯 Option 3: Deploy from Browser (SIMPLEST - NO CLI)

### Step 1: Create Deployment Package

Create a file called `deploy-package.zip` with these contents:

```
railway-bridge/
├── server.ts
├── connection-pool.ts
├── connection-manager.ts
├── ctrader-client.ts
├── message-router.ts
├── proto-loader.ts
├── proto-messages.ts
├── railway.json
├── deno.json
├── ctrader/
│   ├── constants.ts
│   ├── errors.ts
│   ├── logger.ts
│   ├── protobuf.ts
│   ├── tcp-client.ts
│   └── types.ts
└── proto/
    ├── OpenApiCommonMessages.proto
    ├── OpenApiCommonModelMessages.proto
    ├── OpenApiMessages.proto
    └── OpenApiModelMessages.proto
```

### Step 2: Upload to Railway

1. Go to https://railway.app/new
2. Click "Empty Project"
3. Click "New" → "Empty Service"
4. Click "Settings" → "Source"
5. Upload your zip file

### Step 3: Configure

1. Go to "Variables" tab
2. Add environment variables:
   ```
   CTRADER_CLIENT_ID=3_5az7pj935owsss8cs5s4ocgo84wgwk0kw8o4wco0kos0ow4k8
   CTRADER_CLIENT_SECRET=<your_secret>
   PORT=8080
   ```

3. Railway will automatically redeploy

### Step 4: Get URL

1. Go to "Settings" tab
2. Under "Networking", you'll see your public URL
3. Copy the URL (format: `your-service.up.railway.app`)

---

## ✅ Post-Deployment Checklist

After deployment, verify everything works:

### 1. Health Check

```bash
curl https://your-service.up.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "uptime": 123,
  "version": "2.0.0",
  "timestamp": "2026-01-01T...",
  "connections": {
    "total": 0,
    "inUse": 0,
    "idle": 0
  },
  "environment": {
    "hasClientId": true,
    "hasClientSecret": true,
    "isConfigured": true
  },
  "features": [
    "Protocol Buffers support",
    "WebSocket connection pooling",
    "cTrader ProtoOA protocol",
    "Automatic reconnection"
  ]
}
```

### 2. Stats Endpoint

```bash
curl https://your-service.up.railway.app/stats
```

### 3. Update Supabase Backend

Once deployed, update the `RAILWAY_BRIDGE_URL` environment variable in Supabase:

```
RAILWAY_BRIDGE_URL=https://your-service.up.railway.app
```

### 4. Test Integration

From your Figma Make app:

```bash
# Test via Supabase backend
curl https://${projectId}.supabase.co/functions/v1/make-server-5a9e4cc2/health/railway
```

**Expected:**
```json
{
  "status": "healthy",
  "healthy": true,
  "info": {
    "url": "https://your-service.up.railway.app",
    "version": "2.0.0"
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Build Failed

**Cause:** Missing dependencies or configuration

**Solution:**
1. Check Railway logs for specific error
2. Verify `railway.json` exists in root
3. Ensure `deno.json` is present
4. Check that all `.proto` files are included

### Issue: Environment Variables Not Set

**Cause:** Variables not configured in Railway

**Solution:**
1. Go to Railway Dashboard → Variables
2. Add `CTRADER_CLIENT_ID` and `CTRADER_CLIENT_SECRET`
3. Railway will auto-redeploy

### Issue: Health Check Returns 503

**Cause:** Server not fully started or crashed

**Solution:**
1. Check Railway logs
2. Look for startup errors
3. Verify Deno permissions in `railway.json`
4. Check that PORT is set to 8080

### Issue: "isConfigured: false" in Health Check

**Cause:** Missing cTrader credentials

**Solution:**
1. Verify `CTRADER_CLIENT_ID` is set
2. Verify `CTRADER_CLIENT_SECRET` is set
3. Redeploy after adding variables

---

## 📞 Getting Help

### Railway Support
- Documentation: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### Check Deployment Status
```bash
# Via Railway CLI
railway status

# Via Railway Dashboard
# Go to your project → Deployments tab
```

### View Logs
```bash
# Via Railway CLI
railway logs

# Via Railway Dashboard
# Go to your project → Deployments → View Logs
```

---

## 🎉 Success!

Once you see:
- ✅ Health check returns `"status": "healthy"`
- ✅ Environment shows `"isConfigured": true`
- ✅ No errors in Railway logs
- ✅ Supabase can reach Railway Bridge

**Your Railway Bridge is LIVE! 🚀**

Next step: Return to Figma Make and test the full integration!

---

## 🔐 Security Notes

- ✅ Never commit `CTRADER_CLIENT_SECRET` to version control
- ✅ Railway automatically encrypts environment variables
- ✅ Use Railway's built-in secrets management
- ✅ Regularly rotate your cTrader credentials
- ✅ Monitor deployment logs for suspicious activity

---

**Deployment Time:** ~10-15 minutes  
**Difficulty:** Easy to Moderate  
**Cost:** Railway free tier available

*Ready to deploy? Choose your preferred option above and follow the steps!*
