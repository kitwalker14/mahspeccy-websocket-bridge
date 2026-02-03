"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../.env') });
function getEnvVar(key, defaultValue) {
    const value = process.env[key];
    if (!value && !defaultValue) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || defaultValue;
}
function getEnvNumber(key, defaultValue) {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
}
exports.config = {
    server: {
        port: getEnvNumber('PORT', 8080),
        nodeEnv: getEnvVar('NODE_ENV', 'development'),
        logLevel: getEnvVar('LOG_LEVEL', 'info'),
    },
    supabase: {
        url: getEnvVar('SUPABASE_URL'),
        serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    },
    ctrader: {
        apiHost: getEnvVar('CTRADER_API_HOST', 'demo.ctraderapi.com'),
        apiPort: getEnvNumber('CTRADER_API_PORT', 5035),
    },
    security: {
        apiKey: getEnvVar('API_KEY'),
        allowedOrigins: getEnvVar('ALLOWED_ORIGINS', '').split(',').filter(Boolean),
    },
    connection: {
        maxReconnectAttempts: getEnvNumber('MAX_RECONNECT_ATTEMPTS', 10),
        reconnectIntervalMs: getEnvNumber('RECONNECT_INTERVAL_MS', 5000),
        pingIntervalMs: getEnvNumber('PING_INTERVAL_MS', 30000),
        pingTimeoutMs: getEnvNumber('PING_TIMEOUT_MS', 10000),
    },
    rateLimit: {
        maxConnectionsPerUser: getEnvNumber('MAX_CONNECTIONS_PER_USER', 5),
        messageRateLimit: getEnvNumber('MESSAGE_RATE_LIMIT', 100),
        rateLimitWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
    },
};
function validateConfig() {
    const required = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'API_KEY',
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    try {
        new URL(exports.config.supabase.url);
    }
    catch {
        throw new Error('SUPABASE_URL must be a valid URL');
    }
    if (exports.config.security.apiKey.length < 32) {
        throw new Error('API_KEY must be at least 32 characters long');
    }
    if (exports.config.server.port < 1 || exports.config.server.port > 65535) {
        throw new Error('PORT must be between 1 and 65535');
    }
}
//# sourceMappingURL=config.js.map