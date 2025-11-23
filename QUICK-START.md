# ⚡ Quick Start - 5 Minute Deployment

Deploy your WebSocket Bridge in **5 minutes** with this checklist!

---

## ✅ Pre-Deployment Checklist

Before you start, make sure you have:

- [ ] Supabase project URL: `https://zeyavgzsotipkxvscimp.supabase.co`
- [ ] Supabase Service Role Key (get from [here](https://supabase.com/dashboard/project/zeyavgzsotipkxvscimp/settings/api))
- [ ] cTrader Client ID (you already have this from Settings)
- [ ] cTrader Client Secret (you already have this from Settings)
- [ ] GitHub account
- [ ] Railway account (sign up at [railway.app](https://railway.app))

---

## 🚀 Deployment Steps

### 1️⃣ Get Supabase Service Role Key (1 minute)

```bash
# Go to this URL:
https://supabase.com/dashboard/project/zeyavgzsotipkxvscimp/settings/api

# Scroll to "Project API keys"
# Copy the "service_role" key (NOT the anon key!)
# Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ⚠️ KEEP THIS SECRET - Never commit to GitHub!
```

✅ **Done when**: You have the service_role key copied

---

### 2️⃣ Push to GitHub (1 minute)

```bash
# From your project root
git add .
git commit -m "Add WebSocket Bridge server"
git push origin main
```

✅ **Done when**: Code is on GitHub

---

### 3️⃣ Deploy to Railway (3 minutes)

**Step 3.1: Create Project**

1. Go to: https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Sign in with GitHub if needed
4. Select **your repository**
5. Click **"Deploy Now"**

**Step 3.2: Configure Root Directory**

1. Click **"Settings"** tab
2. Scroll to **"Root Directory"**
3. Enter: `websocket-server`
4. Railway will redeploy automatically

**Step 3.3: Add Environment Variables**

Click **"Variables"** tab and add these **5 variables**:

```bash
SUPABASE_URL
https://zeyavgzsotipkxvscimp.supabase.co

SUPABASE_SERVICE_ROLE_KEY
<paste your service_role key from Step 1>

CTRADER_CLIENT_ID
<paste your cTrader client ID>

CTRADER_CLIENT_SECRET
<paste your cTrader client secret>

NODE_ENV
production
```

**Step 3.4: Generate Domain**

1. Go to **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"**
4. Railway assigns URL like: `mahspeccy-websocket-production.up.railway.app`
5. **COPY THIS URL** - you'll need it!

✅ **Done when**: Deployment shows "Success" and you have the Railway URL

---

### 4️⃣ Update Frontend (30 seconds)

**Edit `/utils/websocket-bridge.ts`**:

Find line 7:
```typescript
export const WEBSOCKET_BRIDGE_URL = process.env.WEBSOCKET_BRIDGE_URL || 'http://localhost:3000';
```

Replace with:
```typescript
export const WEBSOCKET_BRIDGE_URL = 'https://your-railway-url.up.railway.app';
```

**Replace `your-railway-url.up.railway.app` with YOUR actual Railway URL!**

Save the file.

✅ **Done when**: File saved with your Railway URL

---

### 5️⃣ Test Deployment (30 seconds)

```bash
# Test health endpoint (replace with YOUR Railway URL)
curl https://your-railway-url.up.railway.app/health
```

**Expected response**:
```json
{
  "status": "ok",
  "uptime": 5.123,
  "activeSessions": 0,
  "timestamp": "2025-11-23T..."
}
```

✅ **Done when**: Health check returns 200 OK

---

## 🎉 Final Test - See Your Real Balance!

1. **Open mahSpeccy** in browser
2. **Login** with your account
3. **Open browser console** (F12)
4. Look for: `✅ [WebSocket Bridge] Started`
5. **Go to Dashboard**
6. **Your real balance should appear!** 🎊

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Railway deployment shows "Success" ✅
- [ ] Health endpoint returns 200 OK
- [ ] Frontend has Railway URL configured
- [ ] Browser console shows "WebSocket Bridge Started"
- [ ] Dashboard displays real balance (not $10,000 demo)
- [ ] Balance updates automatically (watch for 30 seconds)

**If all checked** → You're done! 🎉

---

## 🐛 Quick Troubleshooting

### Railway deployment failed

**Check**:
- Root Directory is set to `websocket-server`
- All 5 environment variables are added
- No syntax errors in logs

**Fix**: Check Railway logs for error message

---

### Health check returns error

**Check**:
- Railway domain is generated
- Server is running (check Railway "Deployments" tab)
- URL is correct (no trailing slash)

**Fix**: Wait 1-2 minutes for deployment to complete

---

### Frontend can't connect

**Check**:
- `WEBSOCKET_BRIDGE_URL` in code matches Railway URL
- No typos in URL
- HTTPS not HTTP

**Fix**: Update URL and refresh browser

---

### "No cTrader configuration found"

**Check**:
- You've connected cTrader in Settings
- OAuth authorization completed
- Access token is valid

**Fix**: Go to Settings → Connect cTrader → Authorize

---

### Balance still shows $10,000

**Check**:
- Browser console for errors
- WebSocket actually started (check console logs)
- Railway server is running

**Fix**: Click "Refresh" on Dashboard and wait 5 seconds

---

## 📞 Need Help?

### View Logs

**Railway**:
1. Go to Railway dashboard
2. Click your project
3. Click "Deployments" tab
4. Click latest deployment
5. Click "View Logs"

**Browser**:
1. Press F12
2. Go to "Console" tab
3. Look for errors

### Run Test Script

```bash
cd websocket-server
npm install
SERVER_URL=https://your-railway-url.up.railway.app npm test
```

This will diagnose connection issues!

### Check cTrader Status

Go to: https://status.spotware.com

If cTrader is down, WebSocket won't work.

---

## 🎯 What's Next?

Once deployed and working:

1. **Monitor for 24 hours** - Check Railway logs
2. **Test thoroughly** - Open/close positions
3. **Remove "Load Real Data" button** - No longer needed!
4. **Enable auto-trading** - Now reliable enough
5. **Enjoy real-time data!** 🎉

---

## 💡 Pro Tips

### Free Month

Railway gives **$5 credit** on signup = FREE first month!

### Auto-Deploy

Push to GitHub → Railway auto-deploys. No manual steps!

### View Active Sessions

```bash
curl https://your-railway-url.up.railway.app/api/sessions
```

See all connected users and their status.

### Stop WebSocket (if needed)

```bash
curl -X POST https://your-railway-url.up.railway.app/api/stop-websocket \
  -H "Content-Type: application/json" \
  -d '{"userId":"lance@lwk.space"}'
```

---

## 🚀 You're All Set!

**Total time**: 5 minutes  
**Monthly cost**: $5 (or FREE first month)  
**Benefit**: Real-time, reliable trading data 24/7  

**No more mock data. No more timeouts. Just real trading.** ✨

Now go deploy! 🚀
