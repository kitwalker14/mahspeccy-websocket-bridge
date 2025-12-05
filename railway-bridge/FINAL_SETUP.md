# Railway Bridge - Final Setup Steps

## 🎯 Current Status: 90% Complete!

### ✅ Completed Files (10/12):
- ✅ `main.ts` - Entry point
- ✅ `server.ts` - WebSocket server
- ✅ `connection-manager.ts` - Session management
- ✅ `message-router.ts` - Protocol translation
- ✅ `auth-middleware.ts` - Authentication
- ✅ `deno.json` - Configuration
- ✅ `ctrader/types.ts` - TypeScript interfaces
- ✅ `ctrader/constants.ts` - Configuration constants
- ✅ `ctrader/logger.ts` - Secure logging
- ✅ `ctrader/errors.ts` - Error classes

### ⏳ Remaining Files (2/12):
1. **`ctrader/protobuf.ts`** - ProtoOA Protocol Buffers encoder (copy from `/supabase/functions/server/ctrader-protobuf.ts`)
2. **`ctrader/tcp-client.ts`** - TCP client (copy from `/supabase/functions/server/ctrader-tcp-client.ts`)

---

## 🚀 Option 1: Quick Copy Command (RECOMMENDED)

Run these commands from your project root:

```bash
# Copy ProtoOA encoder
cp supabase/functions/server/ctrader-protobuf.ts railway-bridge/ctrader/protobuf.ts

# Copy TCP client
cp supabase/functions/server/ctrader-tcp-client.ts railway-bridge/ctrader/tcp-client.ts

# Fix import paths in TCP client
sed -i '' 's|from '"'"'./ctrader-types.ts'"'"'|from '"'"'./types.ts'"'"'|g' railway-bridge/ctrader/tcp-client.ts
sed -i '' 's|from '"'"'./ctrader-protobuf.ts'"'"'|from '"'"'./protobuf.ts'"'"'|g' railway-bridge/ctrader/tcp-client.ts
sed -i '' 's|from '"'"'./secure-logger.ts'"'"'|from '"'"'./logger.ts'"'"'|g' railway-bridge/ctrader/tcp-client.ts
sed -i '' 's|from '"'"'./ctrader-errors.ts'"'"'|from '"'"'./errors.ts'"'"'|g' railway-bridge/ctrader/tcp-client.ts
sed -i '' 's|from '"'"'./ctrader-constants.ts'"'"'|from '"'"'./constants.ts'"'"'|g' railway-bridge/ctrader/tcp-client.ts

# Also update protobuf.ts imports
sed -i '' 's|from '"'"'./secure-logger.ts'"'"'|from '"'"'./logger.ts'"'"'|g' railway-bridge/ctrader/protobuf.ts
```

**For Linux, remove the `''` after `-i`:**
```bash
sed -i 's|from '"'"'./ctrader-types.ts'"'"'|from '"'"'./types.ts'"'"'|g' railway-bridge/ctrader/tcp-client.ts
# ... etc
```

---

## 🧪 Option 2: Test Locally First

```bash
# Install Deno (if not already installed)
curl -fsSL https://deno.land/install.sh | sh

# Navigate to bridge directory
cd railway-bridge

# Copy files (see Option 1)
# Then run:
CTRADER_ENVIRONMENT=demo deno task dev

# In another terminal, test health endpoint:
curl http://localhost:8080/health

# Expected output:
# {
#   "status": "healthy",
#   "environment": "demo",
#   "connections": 0,
#   "uptime": 5,
#   "version": "1.0.0"
# }
```

---

## 📦 Option 3: Deploy to Railway Immediately

### Prerequisites:
- Railway CLI installed: `npm install -g @railway/cli`
- Railway account with payment method

### Steps:

1. **Login to Railway**
   ```bash
   railway login
   ```

2. **Create Project**
   ```bash
   railway init
   # Project name: mahspeccy-ctrader-bridge
   ```

3. **Deploy DEMO Service**
   ```bash
   cd railway-bridge
   
   # Create demo service
   railway up --service ctrader-demo
   
   # Set environment variables
   railway variables set CTRADER_ENVIRONMENT=demo
   railway variables set PORT=8080
   railway variables set LOG_LEVEL=info
   
   # Generate domain
   railway domain
   ```

4. **Deploy LIVE Service**
   ```bash
   # Create live service in same project
   railway up --service ctrader-live
   
   # Set environment variables
   railway variables set CTRADER_ENVIRONMENT=live
   railway variables set PORT=8080
   railway variables set LOG_LEVEL=info
   
   # Generate domain
   railway domain
   ```

5. **Note Your Domains**
   ```
   DEMO: https://ctrader-demo-xxx.railway.app
   LIVE: https://ctrader-live-xxx.railway.app
   ```

---

## 🔄 Frontend Integration

Once deployed, update your frontend in `/utils/ctraderBridgeConfig.ts`:

```typescript
export const CTRADER_BRIDGE_URLS = {
  demo: 'wss://ctrader-demo-xxx.railway.app',  // Replace with your domain
  live: 'wss://ctrader-live-xxx.railway.app',  // Replace with your domain
};
```

Then create `/utils/ctraderBridgeClient.ts`:

```typescript
import { CTRADER_BRIDGE_URLS } from './ctraderBridgeConfig';

export interface BridgeMessage {
  type: string;
  requestId?: string;
  payload?: any;
}

export class CTraderBridgeClient {
  private ws: WebSocket | null = null;
  private mode: 'demo' | 'live';
  private token: string;
  private messageHandlers: Map<string, Function> = new Map();
  
  constructor(mode: 'demo' | 'live', credentials: any) {
    this.mode = mode;
    this.token = this.createSessionToken(credentials);
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${CTRADER_BRIDGE_URLS[this.mode]}/ws?token=${this.token}`;
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
    });
  }
  
  send(message: BridgeMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(message));
  }
  
  private createSessionToken(credentials: any): string {
    // Simple base64 encoding (same as auth-middleware.ts)
    const sessionData = {
      userId: credentials.userId,
      credentials: credentials,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000),
    };
    return btoa(JSON.stringify(sessionData));
  }
  
  private handleMessage(message: any): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }
  
  on(messageType: string, handler: Function): void {
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

---

## ✅ Success Checklist

After setup, verify:

- [ ] Both files copied successfully
- [ ] Import paths updated in tcp-client.ts
- [ ] Local dev server starts without errors
- [ ] Health endpoint returns `status: healthy`
- [ ] Railway services deployed (DEMO + LIVE)
- [ ] Domains generated and accessible
- [ ] Frontend configured with correct URLs
- [ ] WebSocket connection successful
- [ ] TCP connection to cTrader established
- [ ] Account data loads in UI

---

## 🐛 Troubleshooting

### Issue: Import errors in Deno
**Solution:** Make sure all imports use `./` prefix and correct filenames

### Issue: TCP connection fails
**Solution:** Check cTrader credentials and environment variable

### Issue: WebSocket won't connect
**Solution:** Verify session token format and CORS settings

### Issue: Railway deployment fails
**Solution:** Check Railway logs: `railway logs`

---

## 📊 Monitoring

### View Logs:
```bash
# Railway CLI
railway logs --service ctrader-demo

# Or in Railway dashboard:
# Project → Service → Deployments → Latest → Logs
```

### Key Metrics:
- Active connections count
- WebSocket connection success rate
- TCP connection stability
- Message latency

---

## 🎯 Summary

**You're 90% done!** Just need to:
1. Copy 2 files (protobuf.ts + tcp-client.ts)
2. Update import paths
3. Test locally OR deploy directly
4. Update frontend configuration

**Estimated time: 5-10 minutes**

**Choose your path:**
- 🚀 **Fast Track:** Run copy commands → Deploy to Railway
- 🧪 **Safe Track:** Copy → Test locally → Deploy
- 🛠️ **Custom:** Let me know if you need specific adjustments

**What would you like to do next?**
