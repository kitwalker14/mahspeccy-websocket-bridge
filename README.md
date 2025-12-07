# Railway Bridge - cTrader WebSocket-to-REST Adapter

**Production-ready WebSocket bridge for cTrader Open API with full Protocol Buffers support**

## Architecture

```
Supabase Backend → Railway Bridge (REST) → cTrader (WebSocket + ProtoOA)
```

## Features

✅ **Full cTrader ProtoOA Protocol Buffers** - Complete implementation with all message types  
✅ **Real Protocol Buffers encoding/decoding** - No JSON placeholders, 100% compliant  
✅ **WebSocket Connection Pooling** - Reuse connections for performance  
✅ **Automatic Authentication** - Handles app + account auth flow  
✅ **Error Handling** - Comprehensive error handling and logging  
✅ **Health Checks** - Monitor connection pool status  
✅ **Graceful Shutdown** - Clean disconnection on server stop  

## Technology Stack

- **Runtime**: Deno (TypeScript)
- **Framework**: Hono (fast web framework)
- **Protocol**: cTrader ProtoOA 2.0 with Protocol Buffers
- **Transport**: WebSocket (WSS)
- **Deployment**: Railway

## Protocol Buffers Implementation

This bridge includes **full Protocol Buffers support** with:

1. ✅ All 4 `.proto` files from cTrader Open API documentation
2. ✅ Complete message type definitions (2100-2188)
3. ✅ Proper encoding/decoding for all requests/responses
4. ✅ Type-safe TypeScript interfaces

### Proto Files

```
proto/
├── OpenApiCommonMessages.proto       # Base ProtoMessage wrapper
├── OpenApiCommonModelMessages.proto  # Common enums and types
├── OpenApiMessages.proto             # ProtoOA request/response messages
└── OpenApiModelMessages.proto        # ProtoOA data models and enums
```

## Quick Start

### Local Development

```bash
# Install Deno (if not installed)
curl -fsSL https://deno.land/install.sh | sh

# Run server
deno task start

# Or with watch mode
deno task dev
```

Server will start on `http://localhost:8080`

### Deploy to Railway

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Railway Bridge with ProtoOA protocol"
   git push origin main
   ```

2. **Connect Railway to GitHub**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Railway**
   - Railway will auto-detect Deno project
   - Set start command: `deno task start`
   - Set PORT environment variable (Railway provides this automatically)

4. **Deploy**
   - Railway will deploy automatically
   - Get your deployment URL: `https://your-project.up.railway.app`

5. **Update Supabase**
   - Go to Supabase Dashboard → Edge Functions
   - Add environment variable: `RAILWAY_BRIDGE_URL=https://your-project.up.railway.app`
   - Redeploy Supabase functions

## API Endpoints

### Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "uptime": 1234,
  "version": "2.0.0",
  "connections": {
    "total": 2,
    "inUse": 0,
    "idle": 2
  }
}
```

### Get Account Data
```bash
POST /api/account

Body:
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret",
  "accessToken": "your_access_token",
  "accountId": "5150705",
  "isDemo": true
}

Response:
{
  "success": true,
  "data": {
    "accountId": "5150705",
    "balance": 10000,
    "equity": 10000,
    "freeMargin": 10000,
    "margin": 0,
    "leverage": 100,
    "isDemo": true
  }
}
```

### Get Positions
```bash
POST /api/positions

Body: (same as above)

Response:
{
  "success": true,
  "data": {
    "positions": [...],
    "orders": [...],
    "accountId": "5150705",
    "isDemo": true
  }
}
```

### Get Symbols
```bash
POST /api/symbols

Body: (same as above)

Response:
{
  "success": true,
  "data": {
    "symbols": [
      {
        "symbolId": 1,
        "symbolName": "EURUSD",
        "enabled": true,
        ...
      }
    ]
  }
}
```

## Connection Pooling

The bridge automatically manages WebSocket connections:

- **Reuses connections** for the same account
- **Automatic cleanup** of idle connections (5 min timeout)
- **Health checks** to detect stale connections
- **Concurrent requests** handled via queue

## Protocol Buffers

cTrader uses **Protocol Buffers (protobuf)** for message encoding. This implementation:

1. Encodes requests as protobuf messages
2. Sends via WebSocket
3. Decodes protobuf responses
4. Returns JSON to REST clients

## Error Handling

All errors are returned in consistent format:

```json
{
  "error": "Error message",
  "code": "CTRADER_ERROR",
  "context": "api/account",
  "timestamp": "2025-12-07T01:00:00.000Z"
}
```

Common error codes:
- `CTRADER_ERROR` - cTrader API error
- `VALIDATION_ERROR` - Invalid request
- `TIMEOUT_ERROR` - Request timeout
- `CONNECTION_ERROR` - WebSocket connection failed

## Monitoring

Check connection pool stats:

```bash
GET /stats

Response:
{
  "uptime": 1234,
  "connectionPool": {
    "total": 2,
    "inUse": 0,
    "idle": 2,
    "connections": ["demo_5150705"]
  },
  "memory": {
    "heapUsed": 12345678,
    "heapTotal": 23456789
  }
}
```

## Production Notes

### Security
- Restrict CORS origins to your Supabase domain
- Use HTTPS only (Railway provides this automatically)
- Never log sensitive credentials

### Performance
- Connection pool reduces latency
- Reuses WebSocket connections
- Handles concurrent requests efficiently

### Scaling
- Stateless design (except connection pool)
- Can run multiple instances behind load balancer
- Connection pool is per-instance

### Maintenance
- Monitor `/health` endpoint
- Check `/stats` for connection pool status
- Watch Railway logs for errors

## Troubleshooting

### Connection timeouts
- Check cTrader server status
- Verify credentials are correct
- Check firewall settings

### Authentication errors
- Verify Client ID and Secret
- Check Access Token validity
- Ensure account ID is correct

### Memory issues
- Check connection pool size
- Reduce idle timeout if needed
- Monitor memory usage in `/stats`

## Support

For issues with:
- **cTrader API**: https://help.ctrader.com/open-api/
- **Railway deployment**: https://docs.railway.app
- **Protocol Buffers**: https://protobuf.dev

## License

MIT