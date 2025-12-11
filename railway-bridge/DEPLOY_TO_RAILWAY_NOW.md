# 🚀 DEPLOY RAILWAY BRIDGE TO RAILWAY - STEP BY STEP

## ⚡ Problem
Railway Bridge at `https://mahspeccy-websocket-bridge-production.up.railway.app` is timing out with **"Connection closed"** errors because:
1. WebSocket connection timeout is 10 seconds (too short)
2. Need to increase to 15 seconds for cTrader authentication to complete

## ✅ Fix Applied (In Code)
File: `/railway-bridge/ctrader-client.ts` line 71
- **Before:** `10000` (10 seconds)
- **After:** `15000` (15 seconds)

---

## 📋 Deployment Options

### Option 1: GitHub Push + Railway Auto-Deploy (EASIEST - 3 minutes)

**Prerequisites:**
- Railway Bridge code is in a GitHub repository
- Railway project is connected to that GitHub repo
- Auto-deploy is enabled in Railway

**Steps:**

1. **Find your Railway Bridge GitHub repository**
   ```bash
   # Example repo names:
   # - mahspeccy-websocket-bridge
   # - railway-bridge
   # - ctrader-bridge
   ```

2. **Navigate to the repository folder on your computer**
   ```bash
   cd /path/to/railway-bridge-repo
   ```

3. **Copy updated code from this project**
   ```bash
   # Copy ONLY these files from /railway-bridge/ folder:
   cp /path/to/mahSpeccy/railway-bridge/ctrader-client.ts ./ctrader-client.ts
   cp /path/to/mahSpeccy/railway-bridge/server.ts ./server.ts
   cp /path/to/mahSpeccy/railway-bridge/connection-pool.ts ./connection-pool.ts
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "fix: increase WebSocket timeout from 10s to 15s for cTrader auth stability"
   git push origin main
   ```

5. **Wait for Railway to deploy** (~2 minutes)
   - Go to https://railway.app/dashboard
   - Find project: `mahspeccy-websocket-bridge-production`
   - Click on it
   - Watch the deployment progress
   - Wait for "Deployed" status

6. **Verify deployment**
   ```bash
   curl https://mahspeccy-websocket-bridge-production.up.railway.app/health
   ```
   Should return:
   ```json
   {
     "status": "healthy",
     "uptime": <low number>,
     "version": "2.0.0"
   }
   ```

7. **Test in mahSpeccy**
   - Go back to mahSpeccy app
   - Click "Diagnostics" button in Settings > cTrader
   - Should now show: ✅ Account data loaded successfully

---

### Option 2: Railway CLI Deploy (IF YOU HAVE RAILWAY CLI - 2 minutes)

**Prerequisites:**
- Railway CLI installed (`npm install -g @railway/cli`)
- Railway logged in

**Steps:**

1. **Navigate to railway-bridge folder**
   ```bash
   cd /path/to/mahSpeccy/railway-bridge
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Link to project**
   ```bash
   railway link
   # Select: mahspeccy-websocket-bridge-production
   ```

4. **Deploy**
   ```bash
   railway up
   ```

5. **Wait for deployment** (~2 minutes)
   Railway will build and deploy the updated code.

6. **Verify** (same as Option 1 steps 6-7)

---

### Option 3: Railway Dashboard Manual Deploy (NO GITHUB - 5 minutes)

**If you don't have the Railway Bridge in GitHub yet:**

1. **Create new GitHub repository**
   - Go to https://github.com/new
   - Name: `mahspeccy-railway-bridge`
   - Visibility: Private (recommended)
   - Click "Create repository"

2. **Copy Railway Bridge code to repository**
   ```bash
   # In your computer, create a new folder
   mkdir mahspeccy-railway-bridge
   cd mahspeccy-railway-bridge
   
   # Initialize git
   git init
   
   # Copy ALL files from /railway-bridge/
   cp -r /path/to/mahSpeccy/railway-bridge/* .
   
   # Remove unnecessary files
   rm -rf *.md  # Remove documentation files
   
   # Add and commit
   git add .
   git commit -m "Initial commit: Railway Bridge with 15s timeout"
   
   # Add remote (replace USERNAME with your GitHub username)
   git remote add origin https://github.com/USERNAME/mahspeccy-railway-bridge.git
   
   # Push
   git push -u origin main
   ```

3. **Connect Railway to GitHub**
   - Go to https://railway.app/dashboard
   - Find project: `mahspeccy-websocket-bridge-production`
   - Click "Settings" tab
   - Click "Connect Repo"
   - Select your new repository: `mahspeccy-railway-bridge`
   - Click "Connect"

4. **Trigger deployment**
   - Railway will automatically deploy from the GitHub repo
   - Wait ~2 minutes

5. **Verify** (same as Option 1 steps 6-7)

---

## 🧪 Testing After Deployment

### Test 1: Health Check
```bash
curl https://mahspeccy-websocket-bridge-production.up.railway.app/health
```

**Expected:**
```json
{
  "status": "healthy",
  "uptime": 30,
  "version": "2.0.0",
  "connections": {
    "total": 0,
    "inUse": 0,
    "idle": 0
  }
}
```

### Test 2: Stats Check
```bash
curl https://mahspeccy-websocket-bridge-production.up.railway.app/stats
```

**Expected:**
```json
{
  "uptime": 30,
  "connectionPool": {
    "total": 0,
    "inUse": 0,
    "idle": 0,
    "connections": []
  },
  "memory": {
    "heapUsed": 12345678,
    "heapTotal": 23456789
  }
}
```

### Test 3: Diagnostics in mahSpeccy
1. Open mahSpeccy app
2. Go to Settings → cTrader
3. Click "Diagnostics" button
4. Wait for results

**Expected:**
```
✅ Configuration Complete
✅ Railway Bridge: Success
✅ Account Data: balance=10000, equity=10000
```

---

## 🎯 Success Criteria

After deployment, you should see:
- ✅ Health endpoint returns `status: healthy`
- ✅ Uptime is low (indicates fresh deployment)
- ✅ Diagnostics in mahSpeccy shows success
- ✅ Dashboard loads real account data
- ✅ No more "Connection closed" errors

---

## ❌ Troubleshooting

### Error: "Repository not found"
**Solution:** Make sure the GitHub repository is public OR Railway has access to your private repositories

### Error: "Build failed"
**Solution:** Check Railway logs:
1. Go to Railway dashboard
2. Click on your project
3. Click "Deployments" tab
4. Click on the failed deployment
5. View logs to see error

### Error: Still getting "Connection closed"
**Possible causes:**
1. Old code still deployed (wait 2 more minutes)
2. Railway is caching old code (click "Redeploy" in Railway dashboard)
3. Code wasn't properly updated (verify `ctrader-client.ts` line 71 has `15000`)

---

## 📞 Quick Reference

**Railway Dashboard:** https://railway.app/dashboard
**Railway Bridge URL:** https://mahspeccy-websocket-bridge-production.up.railway.app
**Health Endpoint:** https://mahspeccy-websocket-bridge-production.up.railway.app/health

**GitHub Setup Help:** https://docs.github.com/en/get-started/quickstart/create-a-repo
**Railway Deploy Help:** https://docs.railway.app/deploy/deployments

---

## ⏱️ Expected Timeline

- **Option 1 (GitHub):** 3 minutes
- **Option 2 (Railway CLI):** 2 minutes  
- **Option 3 (Manual):** 5 minutes

**Don't have access to Railway Bridge repository?**

If the Railway Bridge was created by someone else or you don't have access:
1. Contact the person who created the Railway project
2. OR create a new Railway project from scratch using Option 3
3. OR use Railway CLI to deploy from local `/railway-bridge/` folder

---

**STATUS:** Ready to deploy
**PRIORITY:** High - blocks all cTrader data fetching
**IMPACT:** Will fix all "Connection closed" errors immediately
