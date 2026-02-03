"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const logger_1 = require("./logger");
const WebSocketServer_1 = require("./websocket/WebSocketServer");
process.on('uncaughtException', (error) => {
    logger_1.logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
});
async function main() {
    try {
        logger_1.logger.info('Starting mahSpeccy WebSocket Bridge');
        logger_1.logger.info({ nodeEnv: config_1.config.server.nodeEnv, port: config_1.config.server.port }, 'Configuration loaded');
        (0, config_1.validateConfig)();
        logger_1.logger.info('Configuration validated');
        const wsServer = new WebSocketServer_1.WebSocketServer();
        await wsServer.initialize();
        await wsServer.start();
        logger_1.logger.info('WebSocket Bridge is ready');
        const shutdown = async (signal) => {
            logger_1.logger.info({ signal }, 'Shutdown signal received');
            try {
                await wsServer.stop();
                logger_1.logger.info('Shutdown completed successfully');
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error({ error }, 'Error during shutdown');
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        logger_1.logger.fatal({ error }, 'Failed to start server');
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map