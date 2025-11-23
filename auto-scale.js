/**
 * Auto-Scaling Script
 * Automatically scales Railway instances based on active WebSocket sessions
 * 
 * Usage: RAILWAY_TOKEN=xxx npm run autoscale
 */

import 'dotenv/config';
import { RailwayAPI } from './railway-api.js';
import fetch from 'node-fetch';

const PROJECT_NAME = 'mahspeccy-websocket';
const SERVICE_NAME = 'websocket-bridge';
const CHECK_INTERVAL = 60000; // 60 seconds

// Scaling thresholds
const SCALE_UP_THRESHOLD = 50; // Scale up when > 50 sessions
const SCALE_DOWN_THRESHOLD = 20; // Scale down when < 20 sessions
const MIN_INSTANCES = 1;
const MAX_INSTANCES = 5;

let currentInstances = 1;
let isScaling = false;

async function getServiceUrl(railway, serviceId) {
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

async function getActiveSessions(serviceUrl) {
  try {
    const response = await fetch(`${serviceUrl}/api/sessions`, {
      timeout: 10000,
    });

    if (!response.ok) {
      return {
        total: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      total: 0,
      error: error.message,
    };
  }
}

async function getResourceMetrics(serviceUrl) {
  try {
    const response = await fetch(`${serviceUrl}/health`, {
      timeout: 10000,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      uptime: data.uptime,
      activeSessions: data.activeSessions,
    };
  } catch (error) {
    return null;
  }
}

function calculateDesiredInstances(sessionCount) {
  // Calculate desired instances based on session count
  // Rule: ~50 sessions per instance
  
  if (sessionCount === 0) {
    return MIN_INSTANCES;
  }

  const desired = Math.ceil(sessionCount / 50);
  return Math.max(MIN_INSTANCES, Math.min(desired, MAX_INSTANCES));
}

async function scaleService(railway, serviceId, targetInstances) {
  try {
    console.log(`\n📈 Scaling to ${targetInstances} instance(s)...`);
    
    // Note: Railway API doesn't directly support scaling via GraphQL yet
    // This is a placeholder for when they add support
    // For now, we'll simulate the decision-making logic
    
    console.log(`⚠️  Automatic instance scaling not yet supported by Railway API`);
    console.log(`   Recommended: Manually scale to ${targetInstances} instances in Railway dashboard`);
    console.log(`   Dashboard: https://railway.app`);
    
    // In the future, this would call something like:
    // await railway.scaleService(serviceId, { instances: targetInstances });
    
    return false;
  } catch (error) {
    console.error('❌ Scaling failed:', error.message);
    return false;
  }
}

async function checkAndScale(railway, service, serviceUrl) {
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`⚖️  Auto-Scale Check @ ${timestamp}`);
  console.log('='.repeat(80));

  // Get current metrics
  console.log('\n📊 Current Metrics:');
  
  const sessions = await getActiveSessions(serviceUrl);
  
  if (sessions.error) {
    console.log(`   ❌ Error fetching sessions: ${sessions.error}`);
    return;
  }

  const metrics = await getResourceMetrics(serviceUrl);
  
  if (metrics) {
    console.log(`   👥 Active Sessions: ${metrics.activeSessions}`);
    console.log(`   ⏱️  Uptime: ${metrics.uptime.toFixed(2)}s`);
  }

  // Calculate scaling decision
  const sessionCount = sessions.total;
  const desiredInstances = calculateDesiredInstances(sessionCount);

  console.log('\n📈 Scaling Analysis:');
  console.log(`   Current Sessions: ${sessionCount}`);
  console.log(`   Current Instances: ${currentInstances}`);
  console.log(`   Desired Instances: ${desiredInstances}`);
  console.log(`   Sessions/Instance: ${sessionCount > 0 ? (sessionCount / currentInstances).toFixed(1) : '0'}`);

  // Determine scaling action
  let action = 'MAINTAIN';
  let recommendation = '';

  if (desiredInstances > currentInstances && sessionCount >= SCALE_UP_THRESHOLD) {
    action = 'SCALE UP';
    recommendation = `High session count (${sessionCount}). Recommend scaling up for better performance.`;
  } else if (desiredInstances < currentInstances && sessionCount <= SCALE_DOWN_THRESHOLD) {
    action = 'SCALE DOWN';
    recommendation = `Low session count (${sessionCount}). Can scale down to reduce costs.`;
  } else {
    recommendation = `Session count (${sessionCount}) is within acceptable range for ${currentInstances} instance(s).`;
  }

  console.log(`\n🎯 Decision: ${action}`);
  console.log(`   ${recommendation}`);

  // Execute scaling (if needed)
  if (action !== 'MAINTAIN' && !isScaling) {
    isScaling = true;
    
    const scaled = await scaleService(railway, service.id, desiredInstances);
    
    if (scaled) {
      currentInstances = desiredInstances;
      console.log(`✅ Successfully scaled to ${desiredInstances} instance(s)`);
    } else {
      console.log(`⚠️  Scaling action required but not executed (see above)`);
    }
    
    isScaling = false;
  } else if (isScaling) {
    console.log(`⏳ Scaling operation already in progress...`);
  }

  // Session breakdown
  if (sessions.sessions && sessions.sessions.length > 0) {
    console.log('\n📋 Active Sessions:');
    sessions.sessions.forEach((session, i) => {
      console.log(`   ${i + 1}. ${session.userId} - Account: ${session.accountId} - Connected: ${session.isConnected ? '✅' : '❌'}`);
    });
  }

  // Cost estimate
  const estimatedCost = desiredInstances * 5; // $5 per instance per month
  console.log(`\n💰 Estimated Monthly Cost: $${estimatedCost}`);

  console.log(`\n${'='.repeat(80)}\n`);
}

async function autoScale() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   ⚖️  mahSpeccy WebSocket Bridge - Auto Scaler              ║');
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

    console.log(`✅ Found project: ${project.name}`);

    const service = await railway.getService(project.id, SERVICE_NAME);
    
    if (!service) {
      console.error(`❌ Service "${SERVICE_NAME}" not found.`);
      console.error('   Please deploy first: npm run deploy\n');
      process.exit(1);
    }

    console.log(`✅ Found service: ${service.name}`);

    // Get service URL
    const serviceUrl = await getServiceUrl(railway, service.id);
    
    if (!serviceUrl) {
      console.error('❌ No service URL available. Service may not be deployed yet.\n');
      process.exit(1);
    }

    console.log(`🌐 Service URL: ${serviceUrl}`);
    console.log(`\n📊 Scaling Configuration:`);
    console.log(`   Scale Up Threshold: ${SCALE_UP_THRESHOLD} sessions`);
    console.log(`   Scale Down Threshold: ${SCALE_DOWN_THRESHOLD} sessions`);
    console.log(`   Min Instances: ${MIN_INSTANCES}`);
    console.log(`   Max Instances: ${MAX_INSTANCES}`);
    console.log(`   Check Interval: ${CHECK_INTERVAL / 1000}s`);
    console.log('\n▶️  Auto-scaler started. Press Ctrl+C to stop.\n');

    // Perform initial check
    await checkAndScale(railway, service, serviceUrl);

    // Set up periodic checks
    const interval = setInterval(async () => {
      await checkAndScale(railway, service, serviceUrl);
    }, CHECK_INTERVAL);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping auto-scaler...');
      clearInterval(interval);
      console.log('✅ Auto-scaler stopped.\n');
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Auto-scaler failed:', error.message);
    console.error('\nPlease check:');
    console.error('  - Railway token is valid');
    console.error('  - Project and service exist');
    console.error('  - Service is deployed and running\n');
    process.exit(1);
  }
}

// Run auto-scaler
autoScale().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
