/**
 * Automated Railway Deployment Script
 * Deploys the mahSpeccy WebSocket Bridge to Railway with full automation
 * 
 * Usage: RAILWAY_TOKEN=xxx npm run deploy
 */

import 'dotenv/config';
import { RailwayAPI } from './railway-api.js';
import readline from 'readline';

const PROJECT_NAME = 'mahspeccy-websocket';
const SERVICE_NAME = 'websocket-bridge';
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g., "username/repo"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const ROOT_DIRECTORY = 'websocket-server';

// Environment variables to set on Railway
const ENV_VARS = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  CTRADER_CLIENT_ID: process.env.CTRADER_CLIENT_ID,
  CTRADER_CLIENT_SECRET: process.env.CTRADER_CLIENT_SECRET,
  NODE_ENV: 'production',
  PORT: '3000',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');

  const missing = [];

  if (!process.env.RAILWAY_TOKEN) missing.push('RAILWAY_TOKEN');
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.CTRADER_CLIENT_ID) missing.push('CTRADER_CLIENT_ID');
  if (!process.env.CTRADER_CLIENT_SECRET) missing.push('CTRADER_CLIENT_SECRET');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set them in your .env file or environment.\n');
    process.exit(1);
  }

  console.log('✅ All required environment variables present\n');
}

async function deploy() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   🚀 mahSpeccy WebSocket Bridge - Automated Deployment      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Validate environment
  await validateEnvironment();

  // Initialize Railway API
  const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

  try {
    // Step 1: Get user info
    console.log('📋 Step 1: Authenticating with Railway...');
    const me = await railway.getMe();
    console.log(`✅ Authenticated as: ${me.name} (${me.email})\n`);

    // Step 2: Check if project exists
    console.log('📋 Step 2: Checking for existing project...');
    let project = await railway.getProjectByName(PROJECT_NAME);

    if (project) {
      console.log(`✅ Found existing project: ${project.name} (${project.id})\n`);
      
      const answer = await ask('⚠️  Project already exists. Redeploy? (y/n): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Deployment cancelled.');
        rl.close();
        return;
      }
    } else {
      console.log('📦 Project not found. Creating new project...');
      project = await railway.createProject(
        PROJECT_NAME,
        'mahSpeccy WebSocket Bridge - maintains persistent cTrader connections'
      );
      console.log(`✅ Created project: ${project.name} (${project.id})\n`);
    }

    // Step 3: Check if GitHub repo is configured
    if (!GITHUB_REPO) {
      console.log('⚠️  GITHUB_REPO not set in environment variables.');
      const repo = await ask('Enter GitHub repo (e.g., username/repo): ');
      process.env.GITHUB_REPO = repo.trim();
    }

    // Step 4: Check for existing service
    console.log('📋 Step 3: Checking for existing service...');
    let service = await railway.getService(project.id, SERVICE_NAME);

    if (!service) {
      console.log('📦 Service not found. Deploying from GitHub...');
      service = await railway.deployFromGitHub(
        project.id,
        process.env.GITHUB_REPO,
        GITHUB_BRANCH,
        ROOT_DIRECTORY
      );
      console.log(`✅ Created service: ${service.name} (${service.id})\n`);
    } else {
      console.log(`✅ Found existing service: ${service.name} (${service.id})\n`);
    }

    // Step 5: Set environment variables
    console.log('📋 Step 4: Setting environment variables...');
    await railway.setEnvironmentVariables(service.id, ENV_VARS);
    console.log('✅ Environment variables configured\n');

    // Step 6: Create/get domain
    console.log('📋 Step 5: Configuring domain...');
    const domains = await railway.getServiceDomains(service.id);

    let domain;
    if (domains.length === 0) {
      console.log('🌐 Generating Railway domain...');
      domain = await railway.createServiceDomain(service.id);
      console.log(`✅ Domain created: https://${domain.domain}\n`);
    } else {
      domain = domains[0];
      console.log(`✅ Domain found: https://${domain.domain}\n`);
    }

    // Step 7: Wait for deployment
    console.log('📋 Step 6: Waiting for deployment...');
    console.log('⏳ This may take 2-3 minutes...\n');

    let attempts = 0;
    const maxAttempts = 30;
    let deploymentSuccess = false;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

      const deployments = await railway.getDeployments(service.id, 1);
      
      if (deployments.length > 0) {
        const latest = deployments[0];
        console.log(`   Status: ${latest.status}`);

        if (latest.status === 'SUCCESS') {
          deploymentSuccess = true;
          console.log('\n✅ Deployment successful!\n');
          break;
        } else if (latest.status === 'FAILED' || latest.status === 'CRASHED') {
          console.log('\n❌ Deployment failed. Check Railway logs for details.\n');
          break;
        }
      }

      attempts++;
    }

    if (!deploymentSuccess && attempts >= maxAttempts) {
      console.log('⚠️  Deployment timeout. Check Railway dashboard for status.\n');
    }

    // Step 8: Test deployment
    if (deploymentSuccess) {
      console.log('📋 Step 7: Testing deployment...');
      const healthUrl = `https://${domain.domain}/health`;
      
      try {
        const response = await fetch(healthUrl);
        const data = await response.json();

        if (response.ok && data.status === 'ok') {
          console.log('✅ Health check passed!\n');
        } else {
          console.log('⚠️  Health check failed. Server may still be starting...\n');
        }
      } catch (error) {
        console.log('⚠️  Could not reach health endpoint. Server may still be starting...\n');
      }
    }

    // Step 9: Summary
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   🎉 Deployment Complete!                                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log(`📦 Project: ${project.name}`);
    console.log(`🚀 Service: ${service.name}`);
    console.log(`🌐 URL: https://${domain.domain}`);
    console.log(`\n✅ Next steps:`);
    console.log(`   1. Update /utils/websocket-bridge.ts with: https://${domain.domain}`);
    console.log(`   2. Test health: curl https://${domain.domain}/health`);
    console.log(`   3. Monitor logs: npm run logs`);
    console.log(`   4. Check health: npm run health\n`);

    console.log(`🔗 Railway Dashboard: https://railway.app/project/${project.id}\n`);

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('\nPlease check:');
    console.error('  - Railway token is valid');
    console.error('  - GitHub repo is accessible');
    console.error('  - Environment variables are correct\n');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run deployment
deploy().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
