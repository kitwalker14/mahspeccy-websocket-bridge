# 🎯 Quick Command Reference

One-page cheat sheet for all mahSpeccy WebSocket Bridge commands.

---

## 🚀 Deployment

```bash
# Automated deployment to Railway
npm run deploy
```

**What it does:** Creates project, deploys code, sets env vars, generates domain  
**Time:** ~3-5 minutes  
**Requirements:** RAILWAY_TOKEN in .env  

---

## 💓 Monitoring

```bash
# Continuous health monitoring (30s intervals)
npm run monitor
```

**What it shows:**
- ✅ Deployment status
- ✅ Application health
- ✅ Active sessions
- ✅ Balance per user
- ✅ Failure alerts

**Stop:** Ctrl+C

---

## ⚖️ Auto-Scaling

```bash
# Auto-scaling recommendations (60s intervals)
npm run autoscale
```

**What it does:**
- 📊 Monitors session count
- 📈 Calculates optimal instances
- 💰 Shows cost estimates
- 🎯 Recommends scaling actions

**Note:** Manual scaling required (Railway API limitation)

---

## 📋 Logs

```bash
# View last 100 logs
npm run logs

# Follow logs in real-time
npm run logs:follow

# Show only errors
npm run logs:errors

# Custom options
npm run logs -- --limit=500           # Last 500 logs
npm run logs -- --search=websocket    # Search logs
npm run logs -- --help                # Full help
```

**Colors:**
- 🔴 Red = Errors
- 🟡 Yellow = Warnings
- 🔵 Cyan = Info
- ⚪ Dim = Debug

---

## 🧪 Testing

```bash
# Test connection to deployed server
npm run test

# Single health check
npm run health-check
```

---

## 🔧 Development

```bash
# Start server locally
npm start

# Start with auto-reload
npm run dev

# Initial setup
npm run setup
```

---

## 🎛️ Environment Variables

Required in `.env`:

```env
# Railway API
RAILWAY_TOKEN=xxx

# GitHub
GITHUB_REPO=username/repo
GITHUB_BRANCH=main

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# cTrader
CTRADER_CLIENT_ID=xxx
CTRADER_CLIENT_SECRET=xxx
```

Get Railway token: https://railway.app/account/tokens

---

## 📊 Common Workflows

### Initial Setup & Deployment

```bash
cd websocket-server
npm run setup
# Edit .env with credentials
npm run deploy
npm run monitor
```

### Daily Monitoring

```bash
# Terminal 1: Follow logs
npm run logs:follow

# Terminal 2: Monitor health
npm run monitor
```

### Troubleshooting

```bash
# Check for errors
npm run logs:errors

# Run health check
npm run health-check

# View recent logs
npm run logs -- --limit=500
```

### Scaling

```bash
# Check session load
npm run monitor

# Get scaling recommendations
npm run autoscale

# Then scale manually in Railway dashboard
```

---

## 🚨 Emergency Commands

### Service Down?

```bash
# 1. Check logs for errors
npm run logs:errors

# 2. Check health
npm run health-check

# 3. Redeploy
npm run deploy
```

### Too Many Sessions?

```bash
# 1. Check load
npm run autoscale

# 2. Scale up in Railway dashboard
# Dashboard: https://railway.app
```

### Memory/CPU Issues?

```bash
# 1. View logs
npm run logs:follow

# 2. Monitor health
npm run monitor

# 3. Scale up or restart in Railway
```

---

## 🔗 Quick Links

| What | URL |
|------|-----|
| Railway Dashboard | https://railway.app |
| API Tokens | https://railway.app/account/tokens |
| Railway Status | https://railway.statuspage.io/ |
| Supabase Dashboard | https://supabase.com/dashboard |
| cTrader Status | https://status.spotware.com |
| GitHub Actions | https://github.com/YOUR_REPO/actions |

---

## 💡 Pro Tips

```bash
# Run monitor in background
nohup npm run monitor > monitor.log 2>&1 &

# Check monitor logs
tail -f monitor.log

# Stop background monitor
pkill -f "node monitor-health.js"

# Auto-deploy on push (GitHub Actions)
# Already configured in /.github/workflows/deploy-websocket.yml

# Search logs for specific user
npm run logs -- --search="lance@lwk.space"

# View only WebSocket logs
npm run logs -- --search="WebSocket"

# Cost estimate
npm run autoscale  # Shows monthly cost at bottom
```

---

## 📱 Status Indicators

| Icon | Meaning |
|------|---------|
| ✅ | Success / Healthy |
| ❌ | Error / Failed |
| ⚠️ | Warning / Degraded |
| 🔨 | Building |
| 🚀 | Deploying |
| ℹ️ | Info |
| 💓 | Heartbeat |
| 🔌 | WebSocket |
| 💰 | Balance/Money |
| 👥 | Users/Sessions |
| 📊 | Metrics/Stats |
| 🔍 | Searching |
| ⏱️ | Time/Uptime |

---

## 🆘 Help

```bash
# Command help
npm run logs -- --help

# View documentation
cat README.md
cat AUTOMATION.md
cat DEPLOYMENT.md

# Test Railway API connection
node -e "import('./railway-api.js').then(m => new m.RailwayAPI(process.env.RAILWAY_TOKEN).getMe().then(console.log))"
```

---

**Print this page and keep it handy!** 📄
