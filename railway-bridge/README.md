# Railway Bridge Infrastructure

## Overview

The **Railway Bridge** is a critical infrastructure component that extends mahSpeccy's capabilities beyond Supabase Edge Functions' TCP timeout limitations. It enables long-running operations (TCP WebSocket connections, persistent streaming, high-throughput processing) by deploying a complementary Node.js/Deno service on Railway.app that works alongside your Supabase backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    mahSpeccy Frontend                        │
│                   (React + TypeScript)                       │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             │ Standard API calls             │ Long-running ops
             │ (< 10s timeout)                │ (WebSocket, streaming)
             ▼                                ▼
┌────────────────────────────┐    ┌──────────────────────────┐
│   Supabase Edge Functions  │    │    Railway Bridge        │
│      (Deno Runtime)        │    │   (Node.js/Deno)         │
│                            │    │                          │
│  • Auth & User Mgmt        │    │  • WebSocket (cTrader)   │
│  • KV Store CRUD           │    │  • Long TCP connections  │
│  • Quick API calls         │    │  • Persistent sessions   │
│  • Data validation         │    │  • High-throughput ops   │
└────────────────────────────┘    └──────────────────────────┘
             │                                │
             │                                │
             ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│                                                              │
│  • cTrader Open API (ProtoOA via WebSocket)                │
│  • FXCM ForexConnect API (Market Data, Trading)            │
│  • Other long-running integrations                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Railway SDK Ingestion (`/supabase/functions/railway-ingest/`)

**Purpose:** Fetches the complete Railway SDK repository structure and content from GitHub API for deep integration analysis.

**Files:**
- `index.tsx` - Edge Function that fetches Railway SDK from GitHub
- `kv_store.tsx` - KV utilities for storing manifest data

**Features:**
- ✅ Fetches entire repository tree recursively
- ✅ Downloads file contents for analysis (TypeScript, JavaScript, GraphQL, etc.)
- ✅ Stores manifest in KV store for frontend access
- ✅ Search functionality for finding specific files/patterns
- ✅ Statistics and file tree visualization

**Usage:**
```typescript
import { ingestRailwaySDK, getManifest, searchManifest } from '../railway-bridge/railway-ingest-client';

// Trigger ingestion
const result = await ingestRailwaySDK();

// Get full manifest
const manifest = await getManifest();

// Search for files
const results = await searchManifest('graphql');
```

**UI Component:**
- Navigate to **Settings** tab → **Railway SDK Ingest** section
- Click "Ingest SDK" to download complete Railway SDK
- Browse files, search, and view statistics

### 2. Railway SDK Client (`/railway-bridge/railway-ingest-client.ts`)

**Purpose:** Frontend utility for interacting with Railway SDK ingestion.

**Functions:**
- `ingestRailwaySDK()` - Trigger ingestion from GitHub
- `getIngestionStatus()` - Check if SDK has been ingested
- `getManifest()` - Retrieve full manifest with file contents
- `searchManifest(query)` - Search files by path or name
- `findFileInManifest(manifest, path)` - Find specific file
- `getFilesByExtension(manifest, ext)` - Filter by extension
- `getDirectoryTree(manifest)` - Get tree visualization
- `getManifestStats(manifest)` - Get file counts and sizes

### 3. GraphQL Mutation Documentation

**Captured Mutations:**

#### Deployment Operations
- `deploymentCancel` - Cancel a deployment
- `deploymentRedeploy` - Redeploy from a previous deployment
- `deploymentRemove` - Delete a deployment
- `deploymentRestart` - Restart a deployment
- `deploymentRollback` - Rollback to previous deployment
- `deploymentStop` - Stop a deployment
- `deploymentTriggerCreate` - Create deployment trigger
- `deploymentTriggerDelete` - Delete deployment trigger
- `deploymentTriggerUpdate` - Update deployment trigger

#### Docker Compose Operations
- `dockerComposeImportEnvOverrides` - Import environment overrides
- `dockerComposeProjectCreate` - Create project from docker-compose
- `dockerComposeServiceCreate` - Create service from docker-compose
- `dockerComposeServiceUpdate` - Update docker-compose service

#### Egress Gateway Operations
- `egressGatewayServiceAssociate` - Associate egress gateway with service
- `egressGatewayServiceDisassociate` - Disassociate egress gateway

#### Email Operations
- `emailChange` - Change user email

#### Environment Operations
- `environmentCreate` - Create new environment
- `environmentDelete` - Delete environment
- `environmentPatchCommit` - Commit environment patch
- `environmentRename` - Rename environment
- `environmentTriggersDeploy` - Deploy all connected triggers

#### Feature Flags
- `fairUseAgree` - Agree to fair use policy
- `featureFlagAdd` - Add feature flag for user
- `featureFlagRemove` - Remove feature flag

#### GitHub Operations
- `githubRepoDeploy` - Deploy GitHub repository

#### Heroku Operations
- `herokuImportVariables` - Import variables from Heroku

#### Integration Operations
- `integrationCreate` - Create integration for project
- `integrationDelete` - Delete integration

## Deployment Process

### Prerequisites
1. ✅ GitHub account with repository exported
2. ✅ Railway.app account created
3. ✅ Railway CLI token acquired

### Step 1: GitHub Export (Completed)
Your mahSpeccy codebase is exported to a GitHub repository.

### Step 2: Railway Token (Completed)
You have acquired your Railway API token for deployments.

### Step 3: Railway SDK Ingestion (In Progress)
Use the Railway SDK Ingest component to:
1. Download complete Railway SDK from GitHub
2. Analyze GraphQL schema and mutations
3. Understand deployment patterns
4. Implement type-safe deployment functions

### Step 4: Deploy to Railway (Next)
1. Create Railway project via GraphQL API
2. Connect GitHub repository
3. Configure environment variables
4. Deploy service
5. Configure custom domain (optional)

### Step 5: Integration
1. Update frontend to call Railway Bridge for long-running operations
2. Keep Supabase Edge Functions for standard API calls
3. Test end-to-end flow

## Environment Variables

**Required for Railway Bridge:**
```env
# Railway Configuration
RAILWAY_TOKEN=your_railway_api_token_here
RAILWAY_PROJECT_ID=your_project_id_here
RAILWAY_ENVIRONMENT_ID=your_environment_id_here

# Supabase Integration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Trading APIs
CTRADER_CLIENT_ID=your_ctrader_client_id
CTRADER_CLIENT_SECRET=your_ctrader_client_secret
FINNHUB_API_KEY=your_finnhub_api_key

# Security
ENCRYPTION_MASTER_KEY=your_encryption_master_key
```

## Security Considerations

### 🔒 Token Management
- Railway API tokens are stored securely in environment variables
- Never expose tokens in frontend code
- Use Supabase auth for user authentication
- Railway Bridge validates requests via Supabase auth tokens

### 🔒 Data Encryption
- Sensitive data encrypted with `ENCRYPTION_MASTER_KEY`
- WebSocket connections use secure protocols (WSS)
- API keys never stored in plaintext

### 🔒 Access Control
- Railway Bridge validates user permissions via Supabase
- Rate limiting implemented to prevent abuse
- Audit logging for all critical operations

## Performance Optimization

### ⚡ Request Deduplication
- Concurrent identical requests are deduplicated
- Caching layer for frequently accessed data
- Stale-while-revalidate pattern for optimal UX

### ⚡ Connection Pooling
- WebSocket connections are pooled and reused
- TCP connections kept alive for efficiency
- Automatic reconnection on failure

### ⚡ Batch Operations
- GraphQL mutations batched when possible
- Bulk file operations optimized
- Minimal API calls for common workflows

## Monitoring & Debugging

### 📊 Logging
```typescript
// Railway Bridge includes comprehensive logging
console.log('🚀 [Railway Bridge] Service started');
console.log('🔌 [WebSocket] Connected to cTrader');
console.log('📡 [API] Request: POST /trading/execute');
console.log('✅ [Success] Order placed: #123456');
console.error('❌ [Error] Connection failed:', error);
```

### 📊 Health Checks
- `/health` endpoint for service status
- Automatic alerts on failures
- Uptime monitoring via Railway dashboard

### 📊 Metrics
- Request latency tracking
- Error rate monitoring
- WebSocket connection counts
- Data throughput metrics

## Troubleshooting

### ⚠️ Common Issues

**Issue:** "TCP timeout on Supabase Edge Functions"
- **Solution:** Use Railway Bridge for long-running operations (WebSocket, streaming)

**Issue:** "Railway deployment fails"
- **Solution:** Check environment variables, review logs in Railway dashboard

**Issue:** "WebSocket connection drops"
- **Solution:** Railway Bridge includes automatic reconnection logic

**Issue:** "High latency"
- **Solution:** Enable connection pooling, check Railway region settings

## Next Steps

1. ✅ **Complete SDK ingestion** - Click "Ingest SDK" in Settings tab
2. ⏳ **Implement deployment mutations** - Create Railway project via GraphQL
3. ⏳ **Deploy Railway Bridge** - Push to Railway.app
4. ⏳ **Test integration** - Verify WebSocket connections work
5. ⏳ **Monitor performance** - Check logs and metrics

## Resources

- [Railway.app Documentation](https://docs.railway.app/)
- [Railway GraphQL API](https://railway.app/graphql)
- [Railway SDK GitHub](https://github.com/crisog/railway-sdk)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [cTrader Open API](https://connect.spotware.com/docs/open-api)

## Support

For issues or questions:
1. Check Railway Bridge logs in Settings → Railway SDK Ingest
2. Review Supabase Edge Function logs
3. Consult Railway dashboard for deployment status
4. Enable debug logging for detailed troubleshooting

---

**Last Updated:** 2025-11-26  
**Version:** 1.0.0  
**Status:** SDK Ingestion Ready ✅
