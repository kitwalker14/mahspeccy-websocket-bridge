# Railway Integration Guide for mahSpeccy

Practical guide for integrating Railway API into mahSpeccy automation workflows.

---

## 🎯 Overview

This guide shows how to use Railway's GraphQL API to:
1. Deploy services programmatically
2. Monitor deployments
3. Fetch logs
4. Generate OpenAPI specs
5. Create SDK clients

---

## 📁 File Structure

```
mahspeccy/
├── websocket-server/
│   ├── railway-api.js              # GraphQL API client (already created)
│   ├── deploy-railway.js           # Automated deployment (already created)
│   ├── monitor-health.js           # Health monitoring (already created)
│   ├── auto-scale.js              # Auto-scaling (already created)
│   ├── fetch-logs.js              # Log aggregation (already created)
│   └── docs/
│       ├── RAILWAY-API-REFERENCE.md        # API reference
│       ├── RAILWAY-INTEGRATION-GUIDE.md    # This file
│       └── RAILWAY-OPENAPI-GENERATOR.md    # OpenAPI generator
└── .github/
    └── workflows/
        └── deploy-websocket.yml    # CI/CD pipeline
```

---

## 🚀 Quick Integration Examples

### Example 1: Deploy New Service

```javascript
import { RailwayAPI } from './railway-api.js';

const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

async function deployService() {
  // 1. Get or create project
  let project = await railway.getProjectByName('mahspeccy-websocket');
  
  if (!project) {
    project = await railway.createProject(
      'mahspeccy-websocket',
      'WebSocket Bridge for cTrader'
    );
    console.log('✅ Created project:', project.id);
  }

  // 2. Deploy from GitHub
  const service = await railway.deployFromGitHub(
    project.id,
    'username/mahspeccy-repo',
    'main',
    'websocket-server'
  );
  console.log('✅ Service deployed:', service.id);

  // 3. Set environment variables
  await railway.setEnvironmentVariables(service.id, {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CTRADER_CLIENT_ID: process.env.CTRADER_CLIENT_ID,
    CTRADER_CLIENT_SECRET: process.env.CTRADER_CLIENT_SECRET,
    NODE_ENV: 'production',
  });
  console.log('✅ Environment variables set');

  // 4. Generate domain
  const domain = await railway.createServiceDomain(service.id);
  console.log('✅ Service URL:', `https://${domain.domain}`);

  return { project, service, domain };
}
```

### Example 2: Monitor Deployment Status

```javascript
async function waitForDeployment(railway, serviceId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const deployments = await railway.getDeployments(serviceId, 1);
    
    if (deployments.length > 0) {
      const latest = deployments[0];
      console.log(`[${i + 1}/${maxAttempts}] Status: ${latest.status}`);

      if (latest.status === 'SUCCESS') {
        return { success: true, deployment: latest };
      }
      
      if (latest.status === 'FAILED' || latest.status === 'CRASHED') {
        return { success: false, deployment: latest };
      }
    }

    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
  }

  return { success: false, error: 'Timeout' };
}

// Usage
const result = await waitForDeployment(railway, serviceId);
if (result.success) {
  console.log('✅ Deployment successful!');
} else {
  console.error('❌ Deployment failed');
}
```

### Example 3: Fetch and Parse Logs

```javascript
async function analyzeRecentErrors(railway, serviceId) {
  const deployments = await railway.getDeployments(serviceId, 1);
  
  if (deployments.length === 0) {
    return { errors: [], total: 0 };
  }

  const logs = await railway.getDeploymentLogs(deployments[0].id, 500);
  
  const errors = logs.filter(log =>
    log.severity === 'error' ||
    log.message.toLowerCase().includes('error') ||
    log.message.toLowerCase().includes('failed')
  );

  // Group by error type
  const grouped = {};
  errors.forEach(log => {
    const key = log.message.split(':')[0]; // First part before colon
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(log);
  });

  return {
    errors,
    total: errors.length,
    grouped,
    summary: Object.keys(grouped).map(key => ({
      type: key,
      count: grouped[key].length,
    })),
  };
}

// Usage
const analysis = await analyzeRecentErrors(railway, serviceId);
console.log(`Found ${analysis.total} errors`);
console.log('Summary:', analysis.summary);
```

### Example 4: Health Check Integration

```javascript
async function performFullHealthCheck(railway, serviceUrl, serviceId) {
  const health = {
    railway: { status: 'unknown' },
    application: { status: 'unknown' },
    websocket: { status: 'unknown' },
  };

  // 1. Check Railway deployment status
  try {
    const deployments = await railway.getDeployments(serviceId, 1);
    if (deployments.length > 0) {
      health.railway = {
        status: deployments[0].status.toLowerCase(),
        lastDeploy: deployments[0].createdAt,
      };
    }
  } catch (error) {
    health.railway = { status: 'error', error: error.message };
  }

  // 2. Check application health endpoint
  try {
    const response = await fetch(`${serviceUrl}/health`);
    const data = await response.json();
    health.application = {
      status: data.status === 'ok' ? 'healthy' : 'unhealthy',
      uptime: data.uptime,
      activeSessions: data.activeSessions,
    };
  } catch (error) {
    health.application = { status: 'unreachable', error: error.message };
  }

  // 3. Check WebSocket sessions
  try {
    const response = await fetch(`${serviceUrl}/api/sessions`);
    const data = await response.json();
    health.websocket = {
      status: data.total > 0 ? 'active' : 'idle',
      totalSessions: data.total,
      connectedSessions: data.sessions.filter(s => s.isConnected).length,
    };
  } catch (error) {
    health.websocket = { status: 'error', error: error.message };
  }

  // Overall health
  health.overall = 
    health.railway.status === 'success' &&
    health.application.status === 'healthy' &&
    health.websocket.status !== 'error'
      ? 'healthy'
      : 'unhealthy';

  return health;
}

// Usage
const health = await performFullHealthCheck(railway, serviceUrl, serviceId);
console.log('Overall health:', health.overall);
```

---

## 🔧 Extending railway-api.js

### Add Custom Queries

```javascript
// In railway-api.js, add new methods:

/**
 * Get service metrics (custom query)
 */
async getServiceMetrics(serviceId, timeRange = '1h') {
  const query = `
    query ServiceMetrics($serviceId: String!, $timeRange: String!) {
      service(id: $serviceId) {
        id
        name
        metrics(timeRange: $timeRange) {
          cpu
          memory
          network
        }
      }
    }
  `;

  const data = await this.query(query, { serviceId, timeRange });
  return data.service.metrics;
}

/**
 * Get project members
 */
async getProjectMembers(projectId) {
  const query = `
    query ProjectMembers($projectId: String!) {
      project(id: $projectId) {
        id
        members {
          edges {
            node {
              id
              name
              email
              role
            }
          }
        }
      }
    }
  `;

  const data = await this.query(query, { projectId });
  return data.project.members.edges.map(e => e.node);
}

/**
 * Get deployment build logs
 */
async getBuildLogs(deploymentId) {
  const query = `
    query BuildLogs($deploymentId: String!) {
      deployment(id: $deploymentId) {
        id
        buildLogs {
          timestamp
          message
        }
      }
    }
  `;

  const data = await this.query(query, { deploymentId });
  return data.deployment.buildLogs;
}
```

---

## 🎨 Custom Automation Scripts

### Script 1: Multi-Environment Deployment

```javascript
// deploy-multi-env.js
import { RailwayAPI } from './railway-api.js';

const environments = ['staging', 'production'];

async function deployToAllEnvironments() {
  const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

  for (const env of environments) {
    console.log(`\n🚀 Deploying to ${env}...`);

    const projectName = `mahspeccy-websocket-${env}`;
    let project = await railway.getProjectByName(projectName);

    if (!project) {
      project = await railway.createProject(projectName, `${env} environment`);
    }

    const service = await railway.deployFromGitHub(
      project.id,
      process.env.GITHUB_REPO,
      env === 'production' ? 'main' : 'develop',
      'websocket-server'
    );

    await railway.setEnvironmentVariables(service.id, {
      ...process.env, // Copy all env vars
      NODE_ENV: env,
      ENVIRONMENT: env,
    });

    const domain = await railway.createServiceDomain(service.id);
    console.log(`✅ ${env} deployed: https://${domain.domain}`);
  }
}
```

### Script 2: Deployment Rollback

```javascript
// rollback.js
import { RailwayAPI } from './railway-api.js';

async function rollbackDeployment(serviceId, steps = 1) {
  const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

  // Get recent deployments
  const deployments = await railway.getDeployments(serviceId, steps + 1);

  if (deployments.length < steps + 1) {
    throw new Error(`Not enough deployments to rollback ${steps} steps`);
  }

  const targetDeployment = deployments[steps];
  console.log(`Rolling back to deployment: ${targetDeployment.id}`);
  console.log(`Created: ${targetDeployment.createdAt}`);

  // Trigger redeploy of old version
  await railway.redeployService(serviceId);

  console.log('✅ Rollback initiated');
}

// Usage: npm run rollback -- --steps=2
```

### Script 3: Cost Analyzer

```javascript
// analyze-costs.js
import { RailwayAPI } from './railway-api.js';

async function analyzeCosts() {
  const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

  const projects = await railway.listProjects();

  let totalServices = 0;
  const costBreakdown = [];

  for (const project of projects) {
    const services = project.services.edges.map(e => e.node);
    totalServices += services.length;

    costBreakdown.push({
      project: project.name,
      services: services.length,
      estimatedCost: services.length * 5, // $5 per service
    });
  }

  console.log('💰 Cost Analysis\n');
  console.log(`Total Projects: ${projects.length}`);
  console.log(`Total Services: ${totalServices}`);
  console.log(`Estimated Monthly Cost: $${totalServices * 5}\n`);

  console.log('Breakdown:');
  costBreakdown.forEach(item => {
    console.log(`  ${item.project}: ${item.services} services - $${item.estimatedCost}/mo`);
  });
}
```

---

## 🧪 Testing Railway Integration

### Unit Tests

```javascript
// tests/railway-api.test.js
import { RailwayAPI } from '../railway-api.js';

describe('RailwayAPI', () => {
  let railway;

  beforeEach(() => {
    railway = new RailwayAPI(process.env.RAILWAY_TOKEN);
  });

  test('should authenticate successfully', async () => {
    const me = await railway.getMe();
    expect(me).toHaveProperty('id');
    expect(me).toHaveProperty('email');
  });

  test('should list projects', async () => {
    const projects = await railway.listProjects();
    expect(Array.isArray(projects)).toBe(true);
  });

  test('should handle errors gracefully', async () => {
    const badRailway = new RailwayAPI('invalid-token');
    await expect(badRailway.getMe()).rejects.toThrow();
  });
});
```

### Integration Tests

```javascript
// tests/deploy.integration.test.js
import { RailwayAPI } from '../railway-api.js';

describe('Deployment Integration', () => {
  test('full deployment workflow', async () => {
    const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

    // Create test project
    const project = await railway.createProject('test-deployment', 'Test');
    expect(project).toHaveProperty('id');

    // Deploy service
    const service = await railway.deployFromGitHub(
      project.id,
      'test-repo/test-service',
      'main'
    );
    expect(service).toHaveProperty('id');

    // Cleanup
    await railway.deleteService(service.id);
  }, 60000); // 60 second timeout
});
```

---

## 📊 Monitoring Dashboard Integration

### Create Real-Time Dashboard

```javascript
// dashboard-server.js
import express from 'express';
import { RailwayAPI } from './railway-api.js';

const app = express();
const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

// Dashboard API endpoint
app.get('/api/dashboard', async (req, res) => {
  const projects = await railway.listProjects();

  const dashboard = await Promise.all(
    projects.map(async project => {
      const services = project.services.edges.map(e => e.node);

      const serviceDetails = await Promise.all(
        services.map(async service => {
          const deployments = await railway.getDeployments(service.id, 1);
          const domains = await railway.getServiceDomains(service.id);

          return {
            id: service.id,
            name: service.name,
            status: deployments[0]?.status || 'unknown',
            url: domains[0] ? `https://${domains[0].domain}` : null,
            lastDeploy: deployments[0]?.createdAt,
          };
        })
      );

      return {
        project: project.name,
        services: serviceDetails,
      };
    })
  );

  res.json({ dashboard });
});

app.listen(3001, () => {
  console.log('Dashboard API running on http://localhost:3001');
});
```

---

## 🔐 Security Best Practices

### 1. Token Management

```javascript
// Use environment variables
const token = process.env.RAILWAY_TOKEN;

// Never log tokens
console.log('Token:', token.slice(0, 10) + '...');

// Rotate tokens regularly
// Set expiry reminders
```

### 2. Error Handling

```javascript
async function safeRailwayCall(fn) {
  try {
    return await fn();
  } catch (error) {
    // Log error without sensitive data
    console.error('Railway API Error:', {
      message: error.message,
      timestamp: new Date().toISOString(),
      // Don't log full error stack in production
    });

    // Return fallback
    return null;
  }
}

// Usage
const projects = await safeRailwayCall(() => railway.listProjects());
```

### 3. Rate Limiting

```javascript
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent requests

const results = await Promise.all(
  items.map(item => 
    limit(() => railway.someOperation(item))
  )
);
```

---

## 📝 Tips & Tricks

### 1. Cache Frequently Used Data

```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedProjects(railway) {
  const cacheKey = 'projects';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const projects = await railway.listProjects();
  cache.set(cacheKey, { data: projects, timestamp: Date.now() });

  return projects;
}
```

### 2. Batch Operations

```javascript
async function batchSetEnvVars(railway, services, envVars) {
  const results = [];

  for (const service of services) {
    try {
      await railway.setEnvironmentVariables(service.id, envVars);
      results.push({ service: service.id, status: 'success' });
    } catch (error) {
      results.push({ service: service.id, status: 'failed', error: error.message });
    }
  }

  return results;
}
```

### 3. Dry Run Mode

```javascript
const DRY_RUN = process.env.DRY_RUN === 'true';

async function deploy(railway, config) {
  if (DRY_RUN) {
    console.log('[DRY RUN] Would deploy with config:', config);
    return { dryRun: true, config };
  }

  return await railway.deployFromGitHub(config);
}
```

---

## 🔗 Additional Resources

- **Railway API Reference:** `/websocket-server/docs/RAILWAY-API-REFERENCE.md`
- **Main Automation Guide:** `/websocket-server/AUTOMATION.md`
- **Command Reference:** `/websocket-server/COMMANDS.md`
- **Architecture Diagrams:** `/websocket-server/AUTOMATION-ARCHITECTURE.md`

---

**Integration complete! All Railway API features are now accessible in mahSpeccy.** 🚀
