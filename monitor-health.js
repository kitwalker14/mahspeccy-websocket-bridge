/**
 * Health Monitoring Script
 * Continuously monitors WebSocket Bridge health via Railway API
 * 
 * Usage: RAILWAY_TOKEN=xxx npm run monitor
 */

import 'dotenv/config';
import { RailwayAPI } from './railway-api.js';
import fetch from 'node-fetch';

const PROJECT_NAME = 'mahspeccy-websocket';
const SERVICE_NAME = 'websocket-bridge';
const CHECK_INTERVAL = 30000; // 30 seconds
const ALERT_THRESHOLD = 3; // Alert after 3 consecutive failures

let consecutiveFailures = 0;
let isMonitoring = true;

async function getServiceUrl(railway, projectId, serviceId) {
  try {
    const domains = await railway.getServiceDomains(serviceId);
    if (domains.length > 0) {
      return `https://${domains[0].domain}`;
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to get service URL:', error.message);
    return null;
  }
}

async function checkApplicationHealth(url) {
  try {
    const response = await fetch(`${url}/health`, {
      timeout: 10000, // 10 second timeout
    });

    if (!response.ok) {
      return {
        healthy: false,
        reason: `HTTP ${response.status}`,
        data: null,
      };
    }

    const data = await response.json();

    return {
      healthy: data.status === 'ok',
      reason: data.status === 'ok' ? 'OK' : 'Status not ok',
      data,
    };
  } catch (error) {
    return {
      healthy: false,
      reason: error.message,
      data: null,
    };
  }
}

async function checkWebSocketSessions(url) {
  try {
    const response = await fetch(`${url}/api/sessions`, {
      timeout: 10000,
    });

    if (!response.ok) {
      return {
        total: 0,
        sessions: [],
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      total: 0,
      sessions: [],
      error: error.message,
    };
  }
}

async function getDeploymentStatus(railway, serviceId) {
  try {
    const deployments = await railway.getDeployments(serviceId, 1);
    
    if (deployments.length === 0) {
      return {
        status: 'UNKNOWN',
        url: null,
      };
    }

    return {
      status: deployments[0].status,
      url: deployments[0].url,
      createdAt: deployments[0].createdAt,
    };
  } catch (error) {
    return {
      status: 'ERROR',
      error: error.message,
    };
  }
}

async function performHealthCheck(railway, project, service, serviceUrl) {
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Health Check @ ${timestamp}`);
  console.log('='.repeat(80));

  // 1. Check deployment status via Railway API
  console.log('\n📋 Railway Deployment Status:');
  const deployment = await getDeploymentStatus(railway, service.id);
  
  const statusIcon = deployment.status === 'SUCCESS' ? '✅' : 
                     deployment.status === 'BUILDING' ? '🔨' :
                     deployment.status === 'DEPLOYING' ? '🚀' :
                     deployment.status === 'FAILED' ? '❌' : '⚠️';
  
  console.log(`   ${statusIcon} Status: ${deployment.status}`);
  if (deployment.createdAt) {
    console.log(`   📅 Deployed: ${new Date(deployment.createdAt).toLocaleString()}`);
  }

  // 2. Check application health endpoint
  console.log('\n💓 Application Health:');
  if (!serviceUrl) {
    console.log('   ❌ No service URL available');
    consecutiveFailures++;
    return false;
  }

  const health = await checkApplicationHealth(serviceUrl);
  
  if (health.healthy) {
    console.log(`   ✅ Status: Healthy`);
    console.log(`   ⏱️  Uptime: ${health.data.uptime.toFixed(2)}s`);
    console.log(`   👥 Active Sessions: ${health.data.activeSessions}`);
    consecutiveFailures = 0;
  } else {
    console.log(`   ❌ Status: Unhealthy`);
    console.log(`   🔴 Reason: ${health.reason}`);
    consecutiveFailures++;
  }

  // 3. Check WebSocket sessions
  console.log('\n🔌 WebSocket Sessions:');
  const sessions = await checkWebSocketSessions(serviceUrl);
  
  if (sessions.error) {
    console.log(`   ⚠️  Error fetching sessions: ${sessions.error}`);
  } else {
    console.log(`   📊 Total Sessions: ${sessions.total}`);
    
    if (sessions.sessions && sessions.sessions.length > 0) {
      sessions.sessions.forEach((session, i) => {
        const connIcon = session.isConnected ? '✅' : '❌';
        console.log(`   ${connIcon} Session ${i + 1}:`);
        console.log(`      👤 User: ${session.userId}`);
        console.log(`      🏦 Account: ${session.accountId}`);
        console.log(`      💰 Balance: $${session.balance?.toLocaleString() || '0'}`);
        console.log(`      📊 Positions: ${session.positions || 0}`);
        console.log(`      🕐 Last Update: ${session.lastUpdate || 'Never'}`);
      });
    } else {
      console.log('   ℹ️  No active sessions');
    }
  }

  // 4. Check for alerts
  if (consecutiveFailures >= ALERT_THRESHOLD) {
    console.log('\n🚨 ALERT: Service unhealthy for multiple checks!');
    console.log(`   Consecutive failures: ${consecutiveFailures}`);
    console.log(`   Recommended action: Check Railway logs`);
    
    // Could integrate with alerting services here:
    // - Send email
    // - Slack notification
    // - PagerDuty alert
    // - SMS via Twilio
  }

  console.log(`\n${'='.repeat(80)}\n`);
  
  return health.healthy;
}

async function monitor() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   💓 mahSpeccy WebSocket Bridge - Health Monitor            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Validate token
  if (!process.env.RAILWAY_TOKEN) {
    console.error('❌ RAILWAY_TOKEN not set. Please set it in .env file.\n');
    process.exit(1);
  }

  const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

  try {
    // Get project and service
    console.log('🔍 Finding Railway project...');
    const project = await railway.getProjectByName(PROJECT_NAME);
    
    if (!project) {
      console.error(`❌ Project "${PROJECT_NAME}" not found.`);
      console.error('   Please deploy first: npm run deploy\n');
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.name} (${project.id})`);

    const service = await railway.getService(project.id, SERVICE_NAME);
    
    if (!service) {
      console.error(`❌ Service "${SERVICE_NAME}" not found in project.`);
      console.error('   Please deploy first: npm run deploy\n');
      process.exit(1);
    }

    console.log(`✅ Found service: ${service.name} (${service.id})`);

    // Get service URL
    const serviceUrl = await getServiceUrl(railway, project.id, service.id);
    
    if (serviceUrl) {
      console.log(`🌐 Service URL: ${serviceUrl}`);
    } else {
      console.log('⚠️  No domain configured yet');
    }

    console.log(`⏱️  Check interval: ${CHECK_INTERVAL / 1000}s`);
    console.log(`🚨 Alert threshold: ${ALERT_THRESHOLD} consecutive failures`);
    console.log('\n▶️  Monitoring started. Press Ctrl+C to stop.\n');

    // Perform initial check
    await performHealthCheck(railway, project, service, serviceUrl);

    // Set up periodic checks
    const interval = setInterval(async () => {
      if (!isMonitoring) {
        clearInterval(interval);
        return;
      }

      await performHealthCheck(railway, project, service, serviceUrl);
    }, CHECK_INTERVAL);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping health monitor...');
      isMonitoring = false;
      clearInterval(interval);
      console.log('✅ Monitor stopped.\n');
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Monitor failed:', error.message);
    console.error('\nPlease check:');
    console.error('  - Railway token is valid');
    console.error('  - Project and service exist');
    console.error('  - Network connectivity\n');
    process.exit(1);
  }
}

// Run monitor
monitor().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
