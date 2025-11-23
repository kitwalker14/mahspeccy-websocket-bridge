# 🤖 Automation & Monitoring Guide

Complete guide for automated deployment, monitoring, scaling, and log management.

---

## 📋 Table of Contents

1. [Automated Deployment](#automated-deployment)
2. [Health Monitoring](#health-monitoring)
3. [Auto-Scaling](#auto-scaling)
4. [Log Aggregation](#log-aggregation)
5. [GitHub Actions CI/CD](#github-actions-cicd)
6. [Railway API Setup](#railway-api-setup)

---

## 🚀 Automated Deployment

Deploy to Railway with **one command** - no manual clicking required!

### Prerequisites

1. **Railway Account Token**
   - Go to: https://railway.app/account/tokens
   - Click "Create Token"
   - Copy the token

2. **Environment Variables**
   - Create `.env` file in `/websocket-server/`
   - Add all required variables (see below)

### Setup

```bash
cd websocket-server

# Copy example env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required variables:**
```env
# Railway API
RAILWAY_TOKEN=your_railway_api_token_here

# GitHub
GITHUB_REPO=username/repository-name
GITHUB_BRANCH=main

# Supabase
SUPABASE_URL=https://zeyavgzsotipkxvscimp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# cTrader
CTRADER_CLIENT_ID=your_client_id
CTRADER_CLIENT_SECRET=your_client_secret
```

### Deploy

```bash
# Install dependencies
npm install

# Deploy to Railway
npm run deploy
```

**What it does:**
1. ✅ Authenticates with Railway API
2. ✅ Creates project (if doesn't exist)
3. ✅ Deploys from GitHub
4. ✅ Sets environment variables
5. ✅ Generates domain
6. ✅ Waits for deployment to complete
7. ✅ Tests health endpoint
8. ✅ Outputs service URL

**Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║   🚀 mahSpeccy WebSocket Bridge - Automated Deployment      ║
╚═══════════════════════════════════════════════════════════════╝

📋 Step 1: Authenticating with Railway...
✅ Authenticated as: Your Name (you@email.com)

📋 Step 2: Checking for existing project...
📦 Project not found. Creating new project...
✅ Created project: mahspeccy-websocket

📋 Step 3: Deploying from GitHub...
✅ Created service: websocket-bridge

📋 Step 4: Setting environment variables...
✅ Environment variables configured

📋 Step 5: Configuring domain...
✅ Domain created: https://mahspeccy-websocket-production.up.railway.app

📋 Step 6: Waiting for deployment...
⏳ This may take 2-3 minutes...
   Status: BUILDING
   Status: DEPLOYING
   Status: SUCCESS
✅ Deployment successful!

📋 Step 7: Testing deployment...
✅ Health check passed!

╔═══════════════════════════════════════════════════════════════╗
║   🎉 Deployment Complete!                                    ║
╚═══════════════════════════════════════════════════════════════╝

📦 Project: mahspeccy-websocket
🚀 Service: websocket-bridge
🌐 URL: https://mahspeccy-websocket-production.up.railway.app

✅ Next steps:
   1. Update /utils/websocket-bridge.ts with: https://mahspeccy-websocket-production.up.railway.app
   2. Test health: curl https://mahspeccy-websocket-production.up.railway.app/health
   3. Monitor logs: npm run logs
   4. Check health: npm run monitor
```

**Time:** ~3-5 minutes (fully automated!)

---

## 💓 Health Monitoring

Continuously monitor your WebSocket Bridge health and active sessions.

### Quick Start

```bash
npm run monitor
```

### What It Monitors

1. **Railway Deployment Status**
   - Build status
   - Deployment health
   - Last deploy time

2. **Application Health**
   - HTTP health endpoint
   - Server uptime
   - Active sessions count

3. **WebSocket Sessions**
   - Connected users
   - Account IDs
   - Balance per user
   - Open positions
   - Last update time

4. **Alerts**
   - Consecutive failure threshold (3 failures = alert)
   - Could integrate with:
     - Email notifications
     - Slack alerts
     - PagerDuty
     - SMS via Twilio

### Output Example

```
╔═══════════════════════════════════════════════════════════════╗
║   💓 mahSpeccy WebSocket Bridge - Health Monitor            ║
╚═══════════════════════════════════════════════════════════════╝

🔍 Finding Railway project...
✅ Found project: mahspeccy-websocket
✅ Found service: websocket-bridge
🌐 Service URL: https://mahspeccy-websocket-production.up.railway.app
⏱️  Check interval: 30s
🚨 Alert threshold: 3 consecutive failures

▶️  Monitoring started. Press Ctrl+C to stop.

================================================================================
🔍 Health Check @ 2025-11-23T10:30:00.000Z
================================================================================

📋 Railway Deployment Status:
   ✅ Status: SUCCESS
   📅 Deployed: 11/23/2025, 10:25:00 AM

💓 Application Health:
   ✅ Status: Healthy
   ⏱️  Uptime: 300.45s
   👥 Active Sessions: 2

🔌 WebSocket Sessions:
   📊 Total Sessions: 2
   ✅ Session 1:
      👤 User: lance@lwk.space
      🏦 Account: 5150705
      💰 Balance: $12,345
      📊 Positions: 3
      🕐 Last Update: 2025-11-23T10:29:55.000Z
   ✅ Session 2:
      👤 User: user2@example.com
      🏦 Account: 5150706
      💰 Balance: $8,500
      📊 Positions: 1
      🕐 Last Update: 2025-11-23T10:29:58.000Z

================================================================================

[Monitoring continues every 30 seconds...]
```

### Configuration

Edit `monitor-health.js` to customize:

```javascript
const CHECK_INTERVAL = 30000; // 30 seconds (change to your preference)
const ALERT_THRESHOLD = 3; // Alert after 3 failures
```

### Advanced: Add Alerting

To add Slack notifications, edit `monitor-health.js`:

```javascript
if (consecutiveFailures >= ALERT_THRESHOLD) {
  // Send Slack webhook
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 WebSocket Bridge unhealthy for ${consecutiveFailures} checks!`,
    }),
  });
}
```

---

## ⚖️ Auto-Scaling

Automatically scale Railway instances based on active WebSocket sessions.

### Quick Start

```bash
npm run autoscale
```

### Scaling Rules

| Sessions | Instances | Action |
|----------|-----------|--------|
| 0-20 | 1 | Scale down |
| 21-50 | 1 | Maintain |
| 51-100 | 2 | Scale up |
| 101-150 | 3 | Scale up |
| 151-200 | 4 | Scale up |
| 201-250 | 5 | Max instances |

**Formula:** `instances = ceil(sessions / 50)`  
**Limits:** Min 1, Max 5

### Configuration

Edit `auto-scale.js`:

```javascript
const SCALE_UP_THRESHOLD = 50; // Scale up when > 50 sessions
const SCALE_DOWN_THRESHOLD = 20; // Scale down when < 20 sessions
const MIN_INSTANCES = 1;
const MAX_INSTANCES = 5;
const CHECK_INTERVAL = 60000; // 60 seconds
```

### Output Example

```
╔═══════════════════════════════════════════════════════════════╗
║   ⚖️  mahSpeccy WebSocket Bridge - Auto Scaler              ║
╚═══════════════════════════════════════════════════════════════╝

🔍 Finding Railway project...
✅ Found project: mahspeccy-websocket
✅ Found service: websocket-bridge
🌐 Service URL: https://mahspeccy-websocket-production.up.railway.app

📊 Scaling Configuration:
   Scale Up Threshold: 50 sessions
   Scale Down Threshold: 20 sessions
   Min Instances: 1
   Max Instances: 5
   Check Interval: 60s

▶️  Auto-scaler started. Press Ctrl+C to stop.

================================================================================
⚖️  Auto-Scale Check @ 2025-11-23T10:35:00.000Z
================================================================================

📊 Current Metrics:
   👥 Active Sessions: 65
   ⏱️  Uptime: 600.23s

📈 Scaling Analysis:
   Current Sessions: 65
   Current Instances: 1
   Desired Instances: 2
   Sessions/Instance: 65.0

🎯 Decision: SCALE UP
   High session count (65). Recommend scaling up for better performance.

📈 Scaling to 2 instance(s)...
⚠️  Automatic instance scaling not yet supported by Railway API
   Recommended: Manually scale to 2 instances in Railway dashboard
   Dashboard: https://railway.app

📋 Active Sessions:
   1. lance@lwk.space - Account: 5150705 - Connected: ✅
   2. user2@example.com - Account: 5150706 - Connected: ✅
   [...64 more sessions]

💰 Estimated Monthly Cost: $10

================================================================================
```

### Important Note

⚠️ **Railway API doesn't yet support programmatic instance scaling via GraphQL.**

The auto-scaler will:
- ✅ Monitor session count
- ✅ Calculate optimal instance count
- ✅ **Recommend** scaling actions
- ⚠️ **Not automatically scale** (manual action required)

**To scale manually:**
1. Go to Railway dashboard
2. Click your service
3. Settings → Instances
4. Adjust instance count

**Future:** When Railway adds scaling to their API, the script will automatically scale instances.

---

## 📋 Log Aggregation

Fetch and analyze Railway deployment logs.

### Commands

```bash
# View last 100 logs
npm run logs

# Follow logs in real-time
npm run logs:follow

# Show only errors
npm run logs:errors

# Custom limit
npm run logs -- --limit=500

# Search logs
npm run logs -- --search=error

# Help
npm run logs -- --help
```

### Output Example

```
================================================================================
📋 Fetching deployment logs...
================================================================================

Deployment ID: d1234567-89ab-cdef-0123-456789abcdef
Status: SUCCESS
Created: 11/23/2025, 10:25:00 AM

────────────────────────────────────────────────────────────────────────────────

11/23 10:25:01 ℹ️  Starting build process...
11/23 10:25:05 ℹ️  Installing dependencies...
11/23 10:25:15 ℹ️  Build completed successfully
11/23 10:25:16 ℹ️  Starting deployment...
11/23 10:25:20 ✅ Server ready to accept connections
11/23 10:25:20 ℹ️  🔗 Health check: http://localhost:3000/health
11/23 10:26:30 ✅ WebSocket started for user: lance@lwk.space
11/23 10:26:31 🔌 Connecting to wss://demo.ctraderapi.com...
11/23 10:26:32 ✅ WebSocket Connected to cTrader
11/23 10:26:35 💰 Account updated: $12,345 USD
11/23 10:26:37 ✅ Cache updated for user lance@lwk.space
```

### Follow Mode

```bash
npm run logs:follow
```

Shows live logs as they come in (like `tail -f`):

```
────────────────────────────────────────────────────────────────────────────────
👀 Following logs... Press Ctrl+C to stop
────────────────────────────────────────────────────────────────────────────────

11/23 10:30:00 💓 Heartbeat received
11/23 10:30:30 💓 Heartbeat received
11/23 10:31:00 💓 Heartbeat received
11/23 10:31:05 📨 Received: ProtoOATraderRes
11/23 10:31:05 💰 Account updated: $12,367 USD
11/23 10:31:07 ✅ Cache updated
[... continues in real-time ...]
```

### Error Analysis

```bash
npm run logs:errors
```

Shows only errors with summary:

```
================================================================================
🔴 Error Analysis
================================================================================

Found 2 errors:

11/23 10:28:15 ❌ WebSocket connection failed: ECONNREFUSED
11/23 10:28:20 ❌ Failed to connect to cTrader API

────────────────────────────────────────────────────────────────────────────────
📊 Error Summary:
   Total Errors: 2
   Time Range: 11/23 10:28:15 - 11/23 10:28:20
```

### Search Logs

```bash
npm run logs -- --search="websocket"
```

Finds all logs containing "websocket".

---

## 🔄 GitHub Actions CI/CD

Automatic deployment on every push to `main` branch.

### Setup

1. **Add GitHub Secrets**

   Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`

   Add these secrets:
   - `RAILWAY_TOKEN` - Your Railway API token
   - `SUPABASE_URL` - Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
   - `CTRADER_CLIENT_ID` - cTrader client ID
   - `CTRADER_CLIENT_SECRET` - cTrader client secret

2. **Workflow File**

   Already created at: `/.github/workflows/deploy-websocket.yml`

### How It Works

**Triggers:**
- ✅ Push to `main` branch (only if `/websocket-server/**` files changed)
- ✅ Manual workflow dispatch

**Steps:**
1. Checkout code
2. Setup Node.js 18
3. Install dependencies
4. Run tests (if any)
5. Deploy to Railway
6. Verify deployment
7. Post summary

### Workflow Status

View in GitHub:
- Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
- See deployment history and logs

### Manual Trigger

1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
2. Select "Deploy WebSocket Bridge to Railway"
3. Click "Run workflow"
4. Choose environment (production/staging)
5. Click "Run workflow"

### Deployment Summary

After each deployment, GitHub Actions creates a summary:

```
### ✅ Deployment Complete!

**Branch:** `main`
**Commit:** `abc123def456`
**Deployed by:** @yourusername
**Environment:** production

🌐 Service should be live on Railway
```

---

## 🔑 Railway API Setup

### Get Your API Token

1. **Go to Railway Account Settings:**
   https://railway.app/account/tokens

2. **Create New Token:**
   - Click "Create Token"
   - Name: "mahSpeccy Automation"
   - Copy the token immediately (shown only once!)

3. **Add to .env:**
   ```env
   RAILWAY_TOKEN=your_token_here
   ```

### Permissions

The token has **full access** to your Railway account:
- ✅ Create/delete projects
- ✅ Deploy services
- ✅ Manage environment variables
- ✅ View logs and metrics
- ⚠️ **Keep it secret!** Never commit to GitHub

### Verify Token

```bash
cd websocket-server
npm install
node -e "import('./railway-api.js').then(m => new m.RailwayAPI(process.env.RAILWAY_TOKEN).getMe().then(console.log))"
```

Should output your Railway account info.

### Advanced Railway API Usage

For complete Railway API documentation, integration examples, and OpenAPI generation:

📚 **See: `/websocket-server/docs/`**

- **RAILWAY-API-REFERENCE.md** - Complete API reference with all endpoints
- **RAILWAY-INTEGRATION-GUIDE.md** - Practical examples and custom scripts
- **RAILWAY-OPENAPI-GENERATOR.md** - Generate OpenAPI specs and SDKs
- **README.md** - Documentation index and navigation

These docs include:
- ✅ Complete GraphQL API reference
- ✅ Advanced integration patterns
- ✅ OpenAPI/Swagger generation
- ✅ SDK generation (TypeScript, Python, Go)
- ✅ Custom automation examples
- ✅ Testing strategies
- ✅ Security best practices

---

## 📊 Complete Command Reference

| Command | Description |
|---------|-------------|
| `npm run start` | Start WebSocket server |
| `npm run dev` | Start with auto-reload |
| `npm run test` | Test connection |
| `npm run deploy` | **Deploy to Railway (automated)** |
| `npm run monitor` | **Monitor health continuously** |
| `npm run autoscale` | **Run auto-scaler** |
| `npm run logs` | **Fetch logs** |
| `npm run logs:follow` | **Follow logs in real-time** |
| `npm run logs:errors` | **Show only errors** |
| `npm run health-check` | Single health check |
| `npm run setup` | Initial setup |

---

## 🎯 Recommended Workflow

### 1. Initial Deployment

```bash
cd websocket-server
npm run setup
# Edit .env with your credentials
npm run deploy
```

### 2. Monitor After Deployment

```bash
# In one terminal: follow logs
npm run logs:follow

# In another terminal: monitor health
npm run monitor
```

### 3. Enable Auto-Deploy (Optional)

Push to GitHub → Automatic deployment via GitHub Actions

### 4. Scale When Needed

```bash
# Check session load
npm run monitor

# If high load, consider scaling manually in Railway dashboard
# Or run auto-scaler to get recommendations
npm run autoscale
```

---

## 🚨 Troubleshooting

### "Railway token invalid"

**Fix:**
1. Get new token from https://railway.app/account/tokens
2. Update `.env` file
3. Try again

### "Project not found"

**Fix:**
```bash
npm run deploy  # Will create project automatically
```

### "Deployment timeout"

**Fix:**
1. Check Railway status: https://railway.statuspage.io/
2. View logs: `npm run logs`
3. Check Railway dashboard for errors

### "Health check failed"

**Fix:**
1. Wait 2-3 minutes for deployment to complete
2. Check logs: `npm run logs:errors`
3. Verify environment variables are set

---

## 💡 Pro Tips

1. **Run monitor in background:**
   ```bash
   nohup npm run monitor > monitor.log 2>&1 &
   ```

2. **Scheduled health checks with cron:**
   ```bash
   */5 * * * * cd /path/to/websocket-server && npm run health-check >> health.log
   ```

3. **Alert on errors:**
   Add webhook notifications in `monitor-health.js` for Slack/Discord/Email

4. **Cost optimization:**
   Run `npm run autoscale` to get scaling recommendations and optimize costs

---

## 🎉 Summary

You now have:

✅ **One-command deployment** - `npm run deploy`  
✅ **24/7 health monitoring** - `npm run monitor`  
✅ **Auto-scaling recommendations** - `npm run autoscale`  
✅ **Real-time log streaming** - `npm run logs:follow`  
✅ **CI/CD pipeline** - Auto-deploy on push  

**Production-ready, enterprise-grade automation!** 🚀