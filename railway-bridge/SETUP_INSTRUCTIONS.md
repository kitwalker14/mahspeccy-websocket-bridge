# Railway Bridge Setup Instructions

## 🎯 Current Status: 70% Complete

### ✅ What's Done:
- Core server infrastructure (Hono WebSocket server)
- Connection manager (session pooling)
- Message router (JSON ↔ ProtoOA translation)
- Auth middleware (session tokens)
- Project configuration (deno.json)
- Documentation

### ⏳ What's Needed:
Copy these 5 files from `/supabase/functions/server/` to `/railway-bridge/ctrader/`:
1. `ctrader-tcp-client.ts` → `tcp-client.ts`
2. `ctrader-protobuf.ts` → `protobuf.ts`
3. `ctrader-errors.ts` → `errors.ts`
4. `ctrader-constants.ts` → `constants.ts`
5. `secure-logger.ts` → `logger.ts`

---

## 🚀 Quick Setup (Option A - Automated)

Run this command to copy all necessary files:

```bash
# From project root
cp supabase/functions/server/ctrader-tcp-client.ts railway-bridge/ctrader/tcp-client.ts
cp supabase/functions/server/ctrader-protobuf.ts railway-bridge/ctrader/protobuf.ts
cp supabase/functions/server/ctrader-errors.ts railway-bridge/ctrader/errors.ts
cp supabase/functions/server/ctrader-constants.ts railway-bridge/ctrader/constants.ts
cp supabase/functions/server/secure-logger.ts railway-bridge/ctrader/logger.ts

# Fix import paths in tcp-client.ts
sed -i 's|from \\'\''\\./ctrader-|from \\'\''\\./|g' railway-bridge/ctrader/tcp-client.ts
sed -i 's|from \\'\''\\./secure-logger|from \\'\''\\./logger|g' railway-bridge/ctrader/tcp-client.ts
```

---

## 🔧 Manual Setup (Option B)

### Step 1: Copy Files

Create `/railway-bridge/ctrader/` directory and copy:

1. **tcp-client.ts** - Main TCP connection handler
   - Source: `/supabase/functions/server/ctrader-tcp-client.ts`
   - Update imports: `'./ctrader-types.ts'` → `'./types.ts'`
   - Update imports: `'./ctrader-protobuf.ts'` → `'./protobuf.ts'`
   - Update imports: `'./secure-logger.ts'` → `'./logger.ts'`

2. **protobuf.ts** - Protocol Buffers encoder
   - Source: `/supabase/functions/server/ctrader-protobuf.ts`
   - Update import: `'./secure-logger.ts'` → `'./logger.ts'`

3. **errors.ts** - Error classes
   - Source: `/supabase/functions/server/ctrader-errors.ts`
   - No changes needed

4. **constants.ts** - Configuration constants
   - Source: `/supabase/functions/server/ctrader-constants.ts`
   - No changes needed

5. **logger.ts** - Secure logging
   - Source: `/supabase/functions/server/secure-logger.ts`
   - No changes needed

### Step 2: Test Locally

```bash
cd railway-bridge

# Run DEMO mode
CTRADER_ENVIRONMENT=demo deno task dev

# In another terminal, test health endpoint
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

---

## 📦 Railway Deployment

### Prerequisites:
1. Railway account with payment method added
2. Railway API token
3. GitHub repository with code

### Deploy via Railway Dashboard:

1. **Create New Project**
   ```
   Name: mahspeccy-ctrader-bridge
   ```

2. **Create DEMO Service**
   ```
   Name: ctrader-demo
   Source: GitHub (this repo)
   Root Directory: /railway-bridge
   Build Command: (leave empty - Deno doesn't need build)
   Start Command: deno task start
   ```

3. **Set DEMO Environment Variables**
   ```
   CTRADER_ENVIRONMENT=demo
   PORT=8080
   LOG_LEVEL=info
   ```

4. **Create LIVE Service**
   ```
   Name: ctrader-live
   Source: GitHub (this repo)
   Root Directory: /railway-bridge
   Build Command: (leave empty)
   Start Command: deno task start
   ```

5. **Set LIVE Environment Variables**
   ```
   CTRADER_ENVIRONMENT=live
   PORT=8080
   LOG_LEVEL=info
   ```

6. **Generate Domains**
   - Railway will auto-generate:
     - `ctrader-demo-xxx.railway.app`
     - `ctrader-live-xxx.railway.app`

---

## 🧪 Testing the Deployment

### 1. Health Check
```bash
curl https://ctrader-demo-xxx.railway.app/health
```

### 2. Create Session Token
```bash
curl -X POST https://ctrader-demo-xxx.railway.app/session/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "credentials": {
      "clientId": "YOUR_CLIENT_ID",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "accountId": "YOUR_ACCOUNT_ID",
      "accessToken": "YOUR_ACCESS_TOKEN",
      "endpoint": "https://demo.ctraderapi.com"
    }
  }'
```

### 3. Test WebSocket Connection
```javascript
const ws = new WebSocket('wss://ctrader-demo-xxx.railway.app/ws?token=YOUR_TOKEN');

ws.onopen = () => {
  console.log('Connected!');
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

---

## 🔄 Frontend Integration

Update your frontend to use Railway bridge:

```typescript
// /utils/ctraderBridgeClient.ts
const BRIDGE_URL = {
  demo: 'wss://ctrader-demo-xxx.railway.app',
  live: 'wss://ctrader-live-xxx.railway.app',
};

export function connectToBridge(mode: 'demo' | 'live', credentials: any) {
  const token = await createSessionToken(credentials);
  const ws = new WebSocket(`${BRIDGE_URL[mode]}/ws?token=${token}`);
  return ws;
}
```

---

## 📊 Monitoring

### View Logs in Railway Dashboard:
1. Go to Project → Service → Deployments
2. Click on latest deployment
3. View logs in real-time

### Key Metrics to Monitor:
- ✅ Active connections count
- ✅ TCP connection success rate
- ✅ Message latency
- ✅ Error rate

---

## 🐛 Troubleshooting

### WebSocket Connection Fails
- ✅ Check session token is valid
- ✅ Verify CORS settings
- ✅ Check Railway service is running

### TCP Connection Fails
- ✅ Verify cTrader credentials
- ✅ Check `CTRADER_ENVIRONMENT` variable
- ✅ Review server logs for auth errors

### Messages Not Routing
- ✅ Check message format matches protocol
- ✅ Verify TCP connection is established
- ✅ Review message router logs

---

## ✅ Success Criteria

Bridge is working when:
1. ✅ Health endpoint returns `status: healthy`
2. ✅ WebSocket connects successfully
3. ✅ TCP connection to cTrader established
4. ✅ Messages route bidirectionally
5. ✅ Account data loads in frontend

---

## 🎯 Next Steps

After deployment:
1. Update frontend to use bridge URLs
2. Test with real trading account
3. Monitor performance and errors
4. Scale if needed (Railway auto-scales)
5. Set up alerts for downtime

**Questions? Issues? Check Railway logs first!**
