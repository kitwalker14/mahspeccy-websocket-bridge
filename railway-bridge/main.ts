/**
 * cTrader TCP/WebSocket Bridge - Main Entry Point
 * 
 * This server maintains persistent TCP connections to cTrader Open API
 * and exposes WebSocket endpoints for browser clients.
 * 
 * Environment Variables:
 * - CTRADER_ENVIRONMENT: 'demo' or 'live'
 * - PORT: Server port (default: 8080)
 * - LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' (default: 'info')
 * - SESSION_TOKEN_SECRET: Secret for session token encryption
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createServer } from './server.ts';

const environment = Deno.env.get('CTRADER_ENVIRONMENT') || 'demo';
const port = parseInt(Deno.env.get('PORT') || '8080');
const logLevel = Deno.env.get('LOG_LEVEL') || 'info';

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  cTrader TCP/WebSocket Bridge Server                         ║
║  Environment: ${environment.toUpperCase().padEnd(48)}║
║  Port: ${String(port).padEnd(52)}║
║  Log Level: ${logLevel.padEnd(48)}║
╚══════════════════════════════════════════════════════════════╝
`);

// Create and start server
const app = createServer(environment as 'demo' | 'live');

console.log(`🚀 Server starting on port ${port}...`);
console.log(`🔌 WebSocket endpoint: ws://localhost:${port}/ws`);
console.log(`❤️  Health check: http://localhost:${port}/health`);
console.log(`\n✅ Ready to accept connections!`);

serve(app.fetch, { port });
