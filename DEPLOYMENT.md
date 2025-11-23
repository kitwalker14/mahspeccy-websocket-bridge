# 🚀 Deployment Guide - mahSpeccy WebSocket Bridge

## Quick Start: Deploy to Railway in 5 Minutes

### Step 1: Push to GitHub (if not already)

```bash
# From your project root
git add .
git commit -m "Add WebSocket Bridge server"
git push origin main
```

### Step 2: Deploy to Railway

1. **Go to Railway**: https://railway.app
2. **Click "Start a New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Choose your repository**
5. **Select the `websocket-server` folder** as the root directory
   - Click "Add variables" → "Root Directory" → Enter: `websocket-server`

### Step 3: Add Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```bash
SUPABASE_URL=https://zeyavgzsotipkxvscimp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste_your_service_role_key>
CTRADER_CLIENT_ID=<paste_your_client_id>
CTRADER_CLIENT_SECRET=<paste_your_client_secret>
NODE_ENV=production
```

**Where to get these values**:

- **SUPABASE_SERVICE_ROLE_KEY**: 
  1. Go to https://supabase.com/dashboard/project/zeyavgzsotipkxvscimp/settings/api
  2. Copy "service_role" key (NOT the anon key!)
  3. ⚠️ This is SECRET - never share or commit to GitHub

- **CTRADER_CLIENT_ID & SECRET**: 
  1. You already have these from your Edge Functions
  2. Go to https://openapi.ctrader.com/apps
  3. Copy from your app settings

### Step 4: Deploy!

1. Railway will auto-deploy when you add variables
2. Wait 1-2 minutes for build to complete
3. You'll see: **"Build successful" ✅**
4. Railway assigns a URL like: `https://mahspeccy-websocket-production.up.railway.app`

### Step 5: Test Your Deployment

```bash
# Replace with your Railway URL
curl https://your-app.up.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "uptime": 5.123,
  "activeSessions": 0,
  "timestamp": "2025-11-23T..."
}
```

### Step 6: Update Frontend

**Edit `/utils/websocket-bridge.ts`**:

```typescript
// Replace this line:
export const WEBSOCKET_BRIDGE_URL = process.env.WEBSOCKET_BRIDGE_URL || 'http://localhost:3000';

// With your Railway URL:
export const WEBSOCKET_BRIDGE_URL = 'https://your-app.up.railway.app';
```

**Or set as environment variable in Supabase Edge Functions**:

In your Supabase dashboard → Edge Functions → Environment Variables:
```
WEBSOCKET_BRIDGE_URL=https://your-app.up.railway.app
```

Then use in code:
```typescript
export const WEBSOCKET_BRIDGE_URL = Deno.env.get('WEBSOCKET_BRIDGE_URL') || 'http://localhost:3000';
```

### Step 7: Done! 🎉

Your WebSocket bridge is live! Now when users log into mahSpeccy:
1. App automatically starts WebSocket connection
2. External server connects to cTrader
3. Real-time data flows into Supabase cache
4. Your app displays fresh balance/positions automatically

---

## Alternative: Deploy to Render.com

### Step 1: Create Render Account

1. Go to https://render.com
2. Sign in with GitHub

### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `mahspeccy-websocket`
   - **Root Directory**: `websocket-server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: 
     - Free (sleeps after 15 mins) - NOT RECOMMENDED for 24/7
     - Starter ($7/month) - RECOMMENDED

### Step 3: Add Environment Variables

In Render dashboard, go to **Environment** tab:

```
SUPABASE_URL=https://zeyavgzsotipkxvscimp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
CTRADER_CLIENT_ID=<your_client_id>
CTRADER_CLIENT_SECRET=<your_client_secret>
NODE_ENV=production
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait 2-3 minutes for deployment
3. Your URL will be: `https://mahspeccy-websocket.onrender.com`

### Step 5: Test & Update Frontend

Same as Railway Step 5-6 above.

---

## Advanced: Deploy to Your Own VPS

### Prerequisites

- Linux server (Ubuntu 22.04 recommended)
- Domain name (optional but recommended)
- SSH access

### Step 1: Server Setup

```bash
# SSH into your server
ssh root@your-server.com

# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install nginx (for reverse proxy)
apt install -y nginx certbot python3-certbot-nginx
```

### Step 2: Clone & Configure

```bash
# Create app directory
mkdir -p /var/www/mahspeccy-websocket
cd /var/www/mahspeccy-websocket

# Clone your repo (or upload files via SCP)
git clone <your-repo-url> .
cd websocket-server

# Install dependencies
npm install --production

# Create .env file
nano .env
```

Paste your environment variables:
```env
SUPABASE_URL=https://zeyavgzsotipkxvscimp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
CTRADER_CLIENT_ID=your_id
CTRADER_CLIENT_SECRET=your_secret
NODE_ENV=production
PORT=3000
```

Save and exit (Ctrl+X, Y, Enter)

### Step 3: Start with PM2

```bash
# Start app
pm2 start server.js --name mahspeccy-websocket

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Check status
pm2 status
pm2 logs mahspeccy-websocket
```

### Step 4: Setup Nginx Reverse Proxy

```bash
# Create nginx config
nano /etc/nginx/sites-available/mahspeccy-websocket
```

Paste:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/mahspeccy-websocket /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 5: Setup SSL (Optional but Recommended)

```bash
# Get free SSL certificate from Let's Encrypt
certbot --nginx -d your-domain.com
```

Follow prompts. Your app will now be available at:
- `https://your-domain.com`

### Step 6: Firewall

```bash
# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp  # SSH
ufw enable
```

### Step 7: Monitoring

```bash
# View logs
pm2 logs mahspeccy-websocket

# Monitor resources
pm2 monit

# Restart if needed
pm2 restart mahspeccy-websocket

# Stop
pm2 stop mahspeccy-websocket
```

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SUPABASE_URL` | ✅ Yes | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Supabase service role key (SECRET!) | `eyJhbGc...` |
| `CTRADER_CLIENT_ID` | ✅ Yes | cTrader App Client ID | `5150705_...` |
| `CTRADER_CLIENT_SECRET` | ✅ Yes | cTrader App Client Secret | `abc123...` |
| `NODE_ENV` | ⚠️ Recommended | Environment mode | `production` |
| `PORT` | ❌ Optional | Server port (default: 3000) | `3000` |
| `LOG_LEVEL` | ❌ Optional | Logging level | `info` |

---

## Post-Deployment Checklist

✅ Server is running and accessible  
✅ `/health` endpoint returns 200 OK  
✅ All environment variables are set  
✅ SSL certificate installed (if using custom domain)  
✅ Firewall configured  
✅ PM2 set to restart on boot (VPS only)  
✅ Frontend `WEBSOCKET_BRIDGE_URL` updated  
✅ Test connection with `test-connection.js`  

---

## Troubleshooting

### Railway/Render shows "Application failed to respond"

**Check**:
1. Build logs for errors
2. Environment variables are set correctly
3. `package.json` has correct start command

**Fix**: Check logs in Railway/Render dashboard

### "Cannot connect to WebSocket Bridge"

**Check**:
1. Server is running: `curl https://your-url/health`
2. CORS is not blocking requests
3. Network connectivity

### "No cTrader configuration found"

**Fix**: User needs to connect cTrader in mahSpeccy Settings first

### Server keeps crashing

**Check PM2 logs**:
```bash
pm2 logs mahspeccy-websocket --lines 100
```

Common causes:
- Invalid Supabase credentials
- Invalid cTrader credentials
- Out of memory (upgrade instance)

### WebSocket disconnects frequently

**Check**:
1. cTrader server status: https://status.spotware.com
2. Network stability
3. Server resources (CPU/RAM)

**Auto-reconnect**: Server automatically retries up to 10 times

---

## Maintenance

### Update Code

**Railway/Render**: Push to GitHub, auto-deploys

**VPS**:
```bash
cd /var/www/mahspeccy-websocket/websocket-server
git pull
npm install
pm2 restart mahspeccy-websocket
```

### View Logs

**Railway**: Dashboard → Logs tab  
**Render**: Dashboard → Logs tab  
**VPS**: `pm2 logs mahspeccy-websocket`

### Restart Server

**Railway**: Dashboard → Deployments → Redeploy  
**Render**: Dashboard → Manual Deploy → Deploy latest commit  
**VPS**: `pm2 restart mahspeccy-websocket`

### Monitor Resources

**Railway/Render**: Dashboard → Metrics tab  
**VPS**: `pm2 monit` or `htop`

---

## Cost Comparison

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Railway** | $5 credit/month | $5/month (Hobby) | Beginners, auto-deploy |
| **Render** | Yes (sleeps) | $7/month (Starter) | Simple deployments |
| **VPS** | No | $4-5/month | Full control, advanced users |

**Recommendation**: Railway.app for easiest setup and deployment.

---

## Support

If you have issues:

1. Check logs (Railway/Render dashboard or `pm2 logs`)
2. Verify environment variables
3. Test health endpoint
4. Check cTrader status: https://status.spotware.com
5. Run `node test-connection.js` to diagnose

Need help? Check the main README.md for API documentation.
