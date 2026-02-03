import { config, validateConfig } from './config'
import { logger } from './logger'
import { WebSocketServer } from './websocket/WebSocketServer'

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ error }, 'Uncaught exception')
  process.exit(1)
})

process.on('unhandledRejection', (reason: any) => {
  logger.fatal({ reason }, 'Unhandled rejection')
  process.exit(1)
})

async function main() {
  try {
    logger.info('Starting mahSpeccy WebSocket Bridge')
    logger.info({ nodeEnv: config.server.nodeEnv, port: config.server.port }, 'Configuration loaded')

    validateConfig()
    logger.info('Configuration validated')

    const wsServer = new WebSocketServer()
    await wsServer.initialize()

    await wsServer.start()
    logger.info('WebSocket Bridge is ready')

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received')
      
      try {
        await wsServer.stop()
        logger.info('Shutdown completed successfully')
        process.exit(0)
      } catch (error) {
        logger.error({ error }, 'Error during shutdown')
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

  } catch (error) {
    logger.fatal({ error }, 'Failed to start server')
    process.exit(1)
  }
}

main()
