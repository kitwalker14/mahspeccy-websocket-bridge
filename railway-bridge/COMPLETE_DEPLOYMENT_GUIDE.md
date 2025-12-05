# 🚀 Railway Bridge - Complete Deployment Guide

## ✅ STATUS: 100% COMPLETE - READY TO DEPLOY!

All files are now in place. Follow this guide to test and deploy.

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Deno installed (for local testing)
- ✅ Railway account (free tier works)
- ✅ cTrader demo account credentials
- ✅ Terminal/command line access

---

## 🎯 STEP-BY-STEP GUIDE

### 🧪 PART 1: Local Testing (Optional but Recommended)

**Time: 5 minutes**

#### Step 1.1: Install Deno (if needed)

```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# Add to PATH (follow terminal instructions)
```

#### Step 1.2: Navigate to Bridge Directory

```bash
cd railway-bridge
```

#### Step 1.3: Start Demo Server

```bash
CTRADER_ENVIRONMENT=demo deno task dev
```

You should see:
```
🚀 cTrader Railway Bridge Server starting...
📍 Environment: demo
🔌 Port: 8080
✅ Server listening on http://localhost:8080
```

#### Step 1.4: Test Health Endpoint

Open a **NEW terminal** window:

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "demo",
  "connections": 0,
  "uptime": 5,
  "version": "1.0.0"
}
```

✅ **If you see this, the server works!** Press `Ctrl+C` to stop it.

---

### 🚂 PART 2: Deploy to Railway

**Time: 10-15 minutes**

#### Step 2.1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub (easiest option)
3. Verify your email
4. Add payment method (required, but free tier available)

#### Step 2.2: Install Railway CLI

```bash
npm install -g @railway/cli
```

Or if you prefer without global install:
```bash
npx @railway/cli
```

#### Step 2.3: Login to Railway

```bash
railway login
```

This will open a browser window for authentication.

#### Step 2.4: Initialize Railway Project

```bash
# From project root (not inside railway-bridge)
cd ..

# Create new Railway project
railway init

# When prompted:
# Project name: mahspeccy-ctrader-bridge
# Press Enter
```

#### Step 2.5: Deploy DEMO Service

```bash
cd railway-bridge

# Deploy the code
railway up

# Set environment variables
railway variables set CTRADER_ENVIRONMENT=demo
railway variables set PORT=8080
railway variables set LOG_LEVEL=info

# Generate public domain
railway domain

# Note the domain (e.g., ctrader-demo-production-xyz.up.railway.app)
```

**Copy your domain URL!** You'll need it later.

#### Step 2.6: Test DEMO Deployment

```bash
# Replace with YOUR domain
curl https://YOUR-DOMAIN.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "demo",
  "connections": 0,
  "uptime": 1,
  "version": "1.0.0"
}
```

✅ **SUCCESS!** Your DEMO bridge is live!

#### Step 2.7: Create LIVE Service (Optional)

If you want a separate LIVE service:

```bash
# Create new service in same project
railway service create ctrader-live

# Switch to new service
railway service

# Select "ctrader-live" from list

# Deploy
railway up

# Set LIVE environment variables
railway variables set CTRADER_ENVIRONMENT=live
railway variables set PORT=8080
railway variables set LOG_LEVEL=info

# Generate domain
railway domain

# Note the LIVE domain
```

---

### 🔧 PART 3: Frontend Integration

**Time: 5 minutes**

#### Step 3.1: Create Bridge Config

Create `/utils/ctraderBridgeConfig.ts`:

```typescript
export const CTRADER_BRIDGE_URLS = {
  demo: 'wss://YOUR-DEMO-DOMAIN.railway.app',  // ⚠️ Replace with your domain
  live: 'wss://YOUR-LIVE-DOMAIN.railway.app',  // ⚠️ Replace with your domain (if created)
};

export const CTRADER_CREDENTIALS = {
  clientId: Deno.env.get('CTRADER_CLIENT_ID') || '',
  clientSecret: Deno.env.get('CTRADER_CLIENT_SECRET') || '',
};
```

#### Step 3.2: Create Bridge Client

Create `/utils/ctraderBridgeClient.ts`:

```typescript
import { CTRADER_BRIDGE_URLS } from './ctraderBridgeConfig';

export interface BridgeMessage {
  type: string;
  requestId?: string;
  payload?: any;
}

export interface BridgeCredentials {
  userId: string;
  clientId: string;
  clientSecret: string;
  accountId: string;
  accessToken: string;
  endpoint: string;
}

export class CTraderBridgeClient {
  private ws: WebSocket | null = null;
  private mode: 'demo' | 'live';
  private credentials: BridgeCredentials;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private requestCallbacks: Map<string, { resolve: Function; reject: Function }> = new Map();
  
  constructor(mode: 'demo' | 'live', credentials: BridgeCredentials) {
    this.mode = mode;
    this.credentials = credentials;
  }
  
  async connect(): Promise<void> {
    const token = this.createSessionToken();
    const url = `${CTRADER_BRIDGE_URLS[this.mode]}/ws?token=${token}`;
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to cTrader bridge');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ Bridge connection error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };
      
      this.ws.onclose = () => {
        console.log('🔌 Bridge connection closed');
      };
    });
  }
  
  async send(type: string, payload?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const requestId = `req_${Date.now()}_${Math.random()}`;
    const message: BridgeMessage = { type, requestId, payload };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, 30000); // 30 second timeout
      
      this.requestCallbacks.set(requestId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      
      this.ws!.send(JSON.stringify(message));
    });
  }
  
  private createSessionToken(): string {
    const sessionData = {
      userId: this.credentials.userId,
      credentials: this.credentials,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };
    return btoa(JSON.stringify(sessionData));
  }
  
  private handleMessage(message: any): void {
    // Handle request responses
    if (message.requestId && this.requestCallbacks.has(message.requestId)) {
      const callback = this.requestCallbacks.get(message.requestId)!;
      this.requestCallbacks.delete(message.requestId);
      
      if (message.success) {
        callback.resolve(message.data);
      } else {
        callback.reject(new Error(message.error || 'Request failed'));
      }
      return;
    }
    
    // Handle event messages
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data || message.payload);
    }
  }
  
  on(messageType: string, handler: (data: any) => void): void {
    this.messageHandlers.set(messageType, handler);
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

#### Step 3.3: Update Your Trading Hooks

Example usage in `/hooks/useCTrader.ts`:

```typescript
import { useEffect, useState } from 'react';
import { CTraderBridgeClient } from '../utils/ctraderBridgeClient';

export function useCTrader(mode: 'demo' | 'live') {
  const [client, setClient] = useState<CTraderBridgeClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [accountData, setAccountData] = useState<any>(null);

  useEffect(() => {
    // Load credentials from localStorage
    const credentials = {
      userId: 'user-id', // From your auth system
      clientId: Deno.env.get('CTRADER_CLIENT_ID')!,
      clientSecret: Deno.env.get('CTRADER_CLIENT_SECRET')!,
      accountId: '5150705', // Your account ID
      accessToken: localStorage.getItem('ctrader_access_token') || '',
      endpoint: mode === 'demo' ? 'https://demo.ctraderapi.com' : 'https://live.ctraderapi.com',
    };

    const bridgeClient = new CTraderBridgeClient(mode, credentials);
    
    bridgeClient.connect()
      .then(() => {
        console.log('✅ Bridge connected');
        setConnected(true);
        setClient(bridgeClient);
        
        // Fetch account data
        return bridgeClient.send('GET_ACCOUNT');
      })
      .then((data) => {
        console.log('📊 Account data:', data);
        setAccountData(data);
      })
      .catch((error) => {
        console.error('❌ Bridge connection failed:', error);
      });

    return () => {
      bridgeClient.disconnect();
    };
  }, [mode]);

  return { client, connected, accountData };
}
```

---

## 📊 PART 4: Verification & Testing

### Step 4.1: Test WebSocket Connection

```bash
# Create test session
curl -X POST https://YOUR-DOMAIN.railway.app/session/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "credentials": {
      "clientId": "YOUR_CLIENT_ID",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "accountId": "5150705",
      "accessToken": "YOUR_ACCESS_TOKEN",
      "endpoint": "https://demo.ctraderapi.com"
    }
  }'

# Response will include token
```

### Step 4.2: Monitor Logs

```bash
railway logs
```

Look for:
- ✅ WebSocket connections
- ✅ TCP connection established
- ✅ Authentication success
- ✅ Message routing

### Step 4.3: Check Stats

```bash
curl https://YOUR-DOMAIN.railway.app/stats
```

Expected:
```json
{
  "activeConnections": 1,
  "totalMessages": 5,
  "uptime": 120,
  "environment": "demo"
}
```

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] Local server runs without errors
- [ ] Health endpoint returns 200 OK
- [ ] Railway project created
- [ ] DEMO service deployed and running
- [ ] Domain generated and accessible
- [ ] Environment variables set correctly
- [ ] Frontend config updated with domain
- [ ] Bridge client created
- [ ] WebSocket connects successfully
- [ ] Account data loads in UI

---

## 🐛 Troubleshooting

### Issue: "Command not found: railway"

**Solution:**
```bash
# Try with npx
npx @railway/cli login
npx @railway/cli up
```

### Issue: "WebSocket connection failed"

**Solutions:**
1. Check domain URL is correct (wss:// not https://)
2. Verify session token is valid (not expired)
3. Check Railway logs for errors: `railway logs`

### Issue: "TCP connection timeout"

**Solutions:**
1. Verify cTrader credentials are correct
2. Check `CTRADER_ENVIRONMENT` is set to `demo`
3. Ensure access token is valid and not expired

### Issue: "Import errors in Deno"

**Solution:**
All files are already in place with correct imports. If you see errors, verify:
```bash
ls -la railway-bridge/ctrader/
# Should show: constants.ts, errors.ts, logger.ts, protobuf.ts, tcp-client.ts, types.ts
```

---

## 📞 Support

### View Logs:
```bash
# Railway CLI
railway logs

# Or Railway Dashboard:
# https://railway.app/project/YOUR-PROJECT/service/YOUR-SERVICE
```

### Common Log Patterns:

✅ **Success:**
```
✅ TLS connection established
✅ Application authenticated
✅ Account authenticated
💓 Heartbeat sent
```

❌ **Errors:**
```
❌ Connection timeout
❌ Authentication failed
❌ Invalid credentials
```

---

## 🎉 You're Done!

Your Railway Bridge is now:
- ✅ **Deployed** to Railway cloud
- ✅ **Connected** to cTrader API
- ✅ **Ready** for frontend integration
- ✅ **Monitoring** with logs and metrics

**Next Steps:**
1. Update your trading UI to use the bridge
2. Test with real trades (on demo first!)
3. Monitor performance and errors
4. Scale up if needed (Railway auto-scales)

**Questions? Check:**
- `/railway-bridge/README.md` - Architecture overview
- `/railway-bridge/DEPLOYMENT_STATUS.md` - Current status
- Railway logs - Real-time debugging

**Happy Trading! 📈**
