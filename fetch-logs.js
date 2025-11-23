/**
 * Log Aggregation Script
 * Fetches and displays Railway deployment logs in real-time
 * 
 * Usage: RAILWAY_TOKEN=xxx npm run logs [--follow] [--limit=100]
 */

import 'dotenv/config';
import { RailwayAPI } from './railway-api.js';

const PROJECT_NAME = 'mahspeccy-websocket';
const SERVICE_NAME = 'websocket-bridge';

// Parse command line arguments
const args = process.argv.slice(2);
const followMode = args.includes('--follow') || args.includes('-f');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
const POLL_INTERVAL = 5000; // 5 seconds

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getSeverityIcon(severity) {
  switch (severity?.toLowerCase()) {
    case 'error':
    case 'fatal':
      return '❌';
    case 'warn':
    case 'warning':
      return '⚠️ ';
    case 'info':
      return 'ℹ️ ';
    case 'debug':
      return '🔍';
    default:
      return '📝';
  }
}

function getSeverityColor(severity) {
  switch (severity?.toLowerCase()) {
    case 'error':
    case 'fatal':
      return 'red';
    case 'warn':
    case 'warning':
      return 'yellow';
    case 'info':
      return 'cyan';
    case 'debug':
      return 'dim';
    default:
      return 'white';
  }
}

function formatLogEntry(log) {
  const timestamp = colorize(formatTimestamp(log.timestamp), 'dim');
  const severity = log.severity || 'INFO';
  const icon = getSeverityIcon(severity);
  const color = getSeverityColor(severity);
  const message = colorize(log.message, color);
  
  return `${timestamp} ${icon} ${message}`;
}

async function fetchLogs(railway, deploymentId, limit) {
  try {
    const logs = await railway.getDeploymentLogs(deploymentId, limit);
    return logs;
  } catch (error) {
    console.error('❌ Failed to fetch logs:', error.message);
    return [];
  }
}

async function displayLogs(railway, service, follow = false, limit = 100) {
  console.log(colorize('='.repeat(80), 'dim'));
  console.log(colorize('📋 Fetching deployment logs...', 'bright'));
  console.log(colorize('='.repeat(80), 'dim'));
  console.log('');

  // Get latest deployment
  const deployments = await railway.getDeployments(service.id, 1);
  
  if (deployments.length === 0) {
    console.log(colorize('⚠️  No deployments found', 'yellow'));
    return;
  }

  const deployment = deployments[0];
  console.log(colorize(`Deployment ID: ${deployment.id}`, 'cyan'));
  console.log(colorize(`Status: ${deployment.status}`, 'cyan'));
  console.log(colorize(`Created: ${new Date(deployment.createdAt).toLocaleString()}`, 'cyan'));
  console.log('');
  console.log(colorize('─'.repeat(80), 'dim'));
  console.log('');

  let lastLogTimestamp = null;

  const displayLogBatch = async () => {
    const logs = await fetchLogs(railway, deployment.id, limit);
    
    if (logs.length === 0) {
      console.log(colorize('ℹ️  No logs available yet', 'yellow'));
      return;
    }

    // Filter logs if following (only show new ones)
    const newLogs = follow && lastLogTimestamp
      ? logs.filter(log => new Date(log.timestamp) > new Date(lastLogTimestamp))
      : logs;

    if (newLogs.length > 0) {
      newLogs.forEach(log => {
        console.log(formatLogEntry(log));
      });

      lastLogTimestamp = newLogs[newLogs.length - 1].timestamp;
    }
  };

  // Display initial batch
  await displayLogBatch();

  // Follow mode: poll for new logs
  if (follow) {
    console.log('');
    console.log(colorize('─'.repeat(80), 'dim'));
    console.log(colorize('👀 Following logs... Press Ctrl+C to stop', 'cyan'));
    console.log(colorize('─'.repeat(80), 'dim'));
    console.log('');

    const interval = setInterval(async () => {
      await displayLogBatch();
    }, POLL_INTERVAL);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n' + colorize('🛑 Stopped following logs', 'yellow'));
      clearInterval(interval);
      process.exit(0);
    });
  }
}

async function searchLogs(railway, service, searchTerm, limit = 100) {
  console.log(colorize('='.repeat(80), 'dim'));
  console.log(colorize(`🔍 Searching logs for: "${searchTerm}"`, 'bright'));
  console.log(colorize('='.repeat(80), 'dim'));
  console.log('');

  // Get latest deployment
  const deployments = await railway.getDeployments(service.id, 1);
  
  if (deployments.length === 0) {
    console.log(colorize('⚠️  No deployments found', 'yellow'));
    return;
  }

  const deployment = deployments[0];
  const logs = await fetchLogs(railway, deployment.id, limit);
  
  if (logs.length === 0) {
    console.log(colorize('ℹ️  No logs available', 'yellow'));
    return;
  }

  const matchingLogs = logs.filter(log => 
    log.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (matchingLogs.length === 0) {
    console.log(colorize(`ℹ️  No logs matching "${searchTerm}"`, 'yellow'));
    return;
  }

  console.log(colorize(`Found ${matchingLogs.length} matching log entries:`, 'green'));
  console.log('');

  matchingLogs.forEach(log => {
    console.log(formatLogEntry(log));
  });
}

async function analyzeErrors(railway, service, limit = 100) {
  console.log(colorize('='.repeat(80), 'dim'));
  console.log(colorize('🔴 Error Analysis', 'bright'));
  console.log(colorize('='.repeat(80), 'dim'));
  console.log('');

  // Get latest deployment
  const deployments = await railway.getDeployments(service.id, 1);
  
  if (deployments.length === 0) {
    console.log(colorize('⚠️  No deployments found', 'yellow'));
    return;
  }

  const deployment = deployments[0];
  const logs = await fetchLogs(railway, deployment.id, limit);
  
  if (logs.length === 0) {
    console.log(colorize('ℹ️  No logs available', 'yellow'));
    return;
  }

  const errors = logs.filter(log => 
    log.severity?.toLowerCase() === 'error' || 
    log.severity?.toLowerCase() === 'fatal' ||
    log.message.toLowerCase().includes('error') ||
    log.message.toLowerCase().includes('failed')
  );

  if (errors.length === 0) {
    console.log(colorize('✅ No errors found in recent logs!', 'green'));
    return;
  }

  console.log(colorize(`Found ${errors.length} errors:`, 'red'));
  console.log('');

  errors.forEach(log => {
    console.log(formatLogEntry(log));
  });

  // Error summary
  console.log('');
  console.log(colorize('─'.repeat(80), 'dim'));
  console.log(colorize('📊 Error Summary:', 'bright'));
  console.log(colorize(`   Total Errors: ${errors.length}`, 'red'));
  console.log(colorize(`   Time Range: ${formatTimestamp(errors[0].timestamp)} - ${formatTimestamp(errors[errors.length - 1].timestamp)}`, 'dim'));
}

async function main() {
  // Validate token
  if (!process.env.RAILWAY_TOKEN) {
    console.error(colorize('❌ RAILWAY_TOKEN not set. Please set it in .env file.\n', 'red'));
    process.exit(1);
  }

  const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

  try {
    // Get project and service
    const project = await railway.getProjectByName(PROJECT_NAME);
    
    if (!project) {
      console.error(colorize(`❌ Project "${PROJECT_NAME}" not found.`, 'red'));
      console.error(colorize('   Please deploy first: npm run deploy\n', 'yellow'));
      process.exit(1);
    }

    const service = await railway.getService(project.id, SERVICE_NAME);
    
    if (!service) {
      console.error(colorize(`❌ Service "${SERVICE_NAME}" not found.`, 'red'));
      console.error(colorize('   Please deploy first: npm run deploy\n', 'yellow'));
      process.exit(1);
    }

    // Check for special commands
    const searchArg = args.find(arg => arg.startsWith('--search='));
    const errorsOnly = args.includes('--errors');

    if (searchArg) {
      const searchTerm = searchArg.split('=')[1];
      await searchLogs(railway, service, searchTerm, limit);
    } else if (errorsOnly) {
      await analyzeErrors(railway, service, limit);
    } else {
      await displayLogs(railway, service, followMode, limit);
    }

  } catch (error) {
    console.error(colorize('\n❌ Log fetch failed: ' + error.message, 'red'));
    console.error(colorize('\nPlease check:', 'yellow'));
    console.error(colorize('  - Railway token is valid', 'yellow'));
    console.error(colorize('  - Project and service exist', 'yellow'));
    console.error(colorize('  - Service has been deployed\n', 'yellow'));
    process.exit(1);
  }
}

// Show usage if help requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colorize('Usage:', 'bright')}
  npm run logs [options]

${colorize('Options:', 'bright')}
  --follow, -f          Follow logs in real-time
  --limit=N             Fetch last N log entries (default: 100)
  --search=TEXT         Search logs for specific text
  --errors              Show only errors
  --help, -h            Show this help message

${colorize('Examples:', 'bright')}
  npm run logs                    # Show last 100 logs
  npm run logs --follow           # Follow logs in real-time
  npm run logs --limit=500        # Show last 500 logs
  npm run logs --search=error     # Search for "error" in logs
  npm run logs --errors           # Show only error logs
  `);
  process.exit(0);
}

// Run main
main().catch(error => {
  console.error(colorize('Fatal error: ' + error.message, 'red'));
  process.exit(1);
});
