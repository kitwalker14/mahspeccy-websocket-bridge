import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'

dotenvConfig({ path: resolve(__dirname, '../.env') })

interface Config {
  server: {
    port: number
    nodeEnv: string
    logLevel: string
  }
  supabase: {
    url: string
    serviceRoleKey: string
  }
  ctrader: {
    apiHost: string
    apiPort: number
  }
  security: {
    apiKey: string
    allowedOrigins: string[]
  }
  connection: {
    maxReconnectAttempts: number
    reconnectIntervalMs: number
    pingIntervalMs: number
    pingTimeoutMs: number
  }
  rateLimit: {
    maxConnectionsPerUser: number
    messageRateLimit: number
    rateLimitWindowMs: number
  }
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value || defaultValue!
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  return value ? parseInt(value, 10) : defaultValue
}

export const config: Config = {
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
}

export function validateConfig(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'API_KEY',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  try {
    new URL(config.supabase.url)
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL')
  }

  if (config.security.apiKey.length < 32) {
    throw new Error('API_KEY must be at least 32 characters long')
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('PORT must be between 1 and 65535')
  }
}
