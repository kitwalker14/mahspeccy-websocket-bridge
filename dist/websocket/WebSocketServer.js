"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketServer = void 0;
const ws_1 = __importDefault(require("ws"));
const http_1 = require("http");
const events_1 = require("events");
const config_1 = require("../config");
const logger_1 = require("../logger");
const SupabaseClient_1 = require("../supabase/SupabaseClient");
const AuthManager_1 = require("../ctrader/AuthManager");
const ProtoOAClient_1 = require("../ctrader/ProtoOAClient");
const MessageHandler_1 = require("../ctrader/MessageHandler");
class WebSocketServer extends events_1.EventEmitter {
    httpServer;
    wss;
    supabaseClient;
    authManager;
    messageHandler;
    clients = new Map();
    healthCheckInterval = null;
    constructor() {
        super();
        this.httpServer = (0, http_1.createServer)((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    clients: this.clients.size,
                    timestamp: Date.now(),
                }));
                return;
            }
            if (req.url === '/metrics') {
                const metrics = {
                    totalConnections: this.clients.size,
                    authenticatedConnections: Array.from(this.clients.values()).filter(c => c.state.isAuthenticated).length,
                    ctraderConnections: Array.from(this.clients.values()).filter(c => c.state.isConnectedToCTrader).length,
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(metrics));
                return;
            }
            res.writeHead(404);
            res.end('Not Found');
        });
        this.wss = new ws_1.default.Server({
            server: this.httpServer,
            maxPayload: 1024 * 1024,
            clientTracking: true,
        });
        this.supabaseClient = new SupabaseClient_1.SupabaseClient();
        this.authManager = new AuthManager_1.AuthManager(this.supabaseClient);
        this.messageHandler = new MessageHandler_1.MessageHandler();
        this.setupWebSocketServer();
    }
    async initialize() {
        await this.messageHandler.initialize();
        logger_1.logger.info('WebSocket server initialized');
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            logger_1.logger.info({ clientId, ip: req.socket.remoteAddress }, 'New WebSocket connection');
            const connection = {
                ws,
                userId: '',
                ctraderClient: null,
                state: {
                    userId: '',
                    isAuthenticated: false,
                    isConnectedToCTrader: false,
                    lastActivity: new Date(),
                    reconnectAttempts: 0,
                },
                rateLimits: new Map(),
                lastPing: new Date(),
            };
            this.clients.set(clientId, connection);
            ws.on('message', (data) => {
                this.handleClientMessage(clientId, data);
            });
            ws.on('pong', () => {
                connection.lastPing = new Date();
            });
            ws.on('close', (code, reason) => {
                logger_1.logger.info({ clientId, code, reason: reason.toString() }, 'Client disconnected');
                this.handleClientDisconnect(clientId);
            });
            ws.on('error', (error) => {
                logger_1.logger.error({ error, clientId }, 'WebSocket error');
                this.handleClientDisconnect(clientId);
            });
            this.sendToClient(clientId, {
                type: 'connected',
                payload: { clientId },
                timestamp: Date.now(),
            });
        });
        this.wss.on('error', (error) => {
            logger_1.logger.error({ error }, 'WebSocket Server error');
        });
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000);
    }
    async handleClientMessage(clientId, data) {
        const connection = this.clients.get(clientId);
        if (!connection)
            return;
        connection.state.lastActivity = new Date();
        try {
            const message = JSON.parse(data.toString());
            if (!this.checkRateLimit(clientId, message.type)) {
                this.sendError(clientId, 'Rate limit exceeded');
                return;
            }
            switch (message.type) {
                case 'authenticate':
                    await this.handleAuthenticate(clientId, message.payload);
                    break;
                case 'connect':
                    await this.handleConnect(clientId, message.payload);
                    break;
                case 'disconnect':
                    this.handleDisconnect(clientId);
                    break;
                case 'subscribe':
                    await this.handleSubscribe(clientId, message.payload);
                    break;
                case 'unsubscribe':
                    await this.handleUnsubscribe(clientId, message.payload);
                    break;
                case 'order':
                    await this.handleOrder(clientId, message.payload);
                    break;
                case 'closePosition':
                    await this.handleClosePosition(clientId, message.payload);
                    break;
                case 'ping':
                    this.sendToClient(clientId, {
                        type: 'pong',
                        payload: {},
                        timestamp: Date.now(),
                    });
                    break;
                default:
                    this.sendError(clientId, `Unknown message type: ${message.type}`);
            }
        }
        catch (error) {
            logger_1.logger.error({ error, clientId }, 'Error handling client message');
            this.sendError(clientId, 'Invalid message format');
        }
    }
    async handleAuthenticate(clientId, payload) {
        const connection = this.clients.get(clientId);
        if (!connection)
            return;
        try {
            const { userId, token } = payload;
            if (!userId || !token) {
                this.sendError(clientId, 'Missing userId or token');
                return;
            }
            const isValid = await this.authManager.validateToken(userId);
            if (!isValid) {
                this.sendError(clientId, 'Invalid or expired token');
                return;
            }
            const userConnections = Array.from(this.clients.values()).filter(c => c.userId === userId && c.state.isAuthenticated);
            if (userConnections.length >= config_1.config.rateLimit.maxConnectionsPerUser) {
                this.sendError(clientId, 'Maximum connections per user exceeded');
                return;
            }
            connection.userId = userId;
            connection.state.userId = userId;
            connection.state.isAuthenticated = true;
            logger_1.logger.info({ clientId, userId }, 'Client authenticated');
            this.sendToClient(clientId, {
                type: 'authenticated',
                payload: { userId },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            logger_1.logger.error({ error, clientId }, 'Authentication failed');
            this.sendError(clientId, 'Authentication failed');
        }
    }
    async handleConnect(clientId, payload) {
        const connection = this.clients.get(clientId);
        if (!connection)
            return;
        if (!connection.state.isAuthenticated) {
            this.sendError(clientId, 'Not authenticated');
            return;
        }
        try {
            const { accountId } = payload;
            if (!accountId) {
                this.sendError(clientId, 'Missing accountId');
                return;
            }
            const credentials = await this.authManager.getCredentials(connection.userId);
            if (!credentials) {
                this.sendError(clientId, 'No credentials found');
                return;
            }
            const ctraderClient = new ProtoOAClient_1.ProtoOAClient(this.messageHandler, credentials, accountId);
            ctraderClient.on('connected', () => {
                logger_1.logger.info({ clientId, userId: connection.userId }, 'cTrader client connected');
            });
            ctraderClient.on('authenticated', () => {
                logger_1.logger.info({ clientId, userId: connection.userId }, 'cTrader client authenticated');
            });
            ctraderClient.on('accountAuthorized', (account) => {
                logger_1.logger.info({ clientId, userId: connection.userId, accountId: account.accountId }, 'Account authorized');
                connection.state.isConnectedToCTrader = true;
                connection.state.accountId = account.accountId;
                this.supabaseClient.setConnectionStatus(connection.userId, true);
                this.supabaseClient.updateAccountInfo(connection.userId, account);
                this.sendToClient(clientId, {
                    type: 'accountUpdate',
                    payload: account,
                    timestamp: Date.now(),
                });
            });
            ctraderClient.on('positionUpdate', (positions) => {
                this.sendToClient(clientId, {
                    type: 'positionUpdate',
                    payload: positions,
                    timestamp: Date.now(),
                });
            });
            ctraderClient.on('executionEvent', (event) => {
                this.sendToClient(clientId, {
                    type: 'executionEvent',
                    payload: event,
                    timestamp: Date.now(),
                });
            });
            ctraderClient.on('spotEvent', (event) => {
                this.sendToClient(clientId, {
                    type: 'spotEvent',
                    payload: event,
                    timestamp: Date.now(),
                });
            });
            ctraderClient.on('error', (error) => {
                logger_1.logger.error({ error, clientId, userId: connection.userId }, 'cTrader client error');
                this.sendError(clientId, error.message);
            });
            ctraderClient.on('disconnected', (code, reason) => {
                logger_1.logger.warn({ clientId, userId: connection.userId, code, reason }, 'cTrader client disconnected');
                connection.state.isConnectedToCTrader = false;
                this.supabaseClient.setConnectionStatus(connection.userId, false);
                this.sendToClient(clientId, {
                    type: 'disconnected',
                    payload: { code, reason },
                    timestamp: Date.now(),
                });
            });
            connection.ctraderClient = ctraderClient;
            await ctraderClient.connect();
            logger_1.logger.info({ clientId, userId: connection.userId, accountId }, 'Connecting to cTrader');
        }
        catch (error) {
            logger_1.logger.error({ error, clientId }, 'Failed to connect to cTrader');
            this.sendError(clientId, 'Failed to connect to cTrader');
        }
    }
    handleDisconnect(clientId) {
        const connection = this.clients.get(clientId);
        if (!connection)
            return;
        if (connection.ctraderClient) {
            connection.ctraderClient.disconnect();
            connection.ctraderClient = null;
            connection.state.isConnectedToCTrader = false;
            if (connection.userId) {
                this.supabaseClient.setConnectionStatus(connection.userId, false);
            }
            logger_1.logger.info({ clientId, userId: connection.userId }, 'Disconnected from cTrader');
        }
    }
    async handleSubscribe(clientId, payload) {
        const connection = this.clients.get(clientId);
        if (!connection || !connection.ctraderClient?.isAuthenticated()) {
            this.sendError(clientId, 'Not connected to cTrader');
            return;
        }
        logger_1.logger.info({ clientId, payload }, 'Subscribe request');
    }
    async handleUnsubscribe(clientId, payload) {
        const connection = this.clients.get(clientId);
        if (!connection || !connection.ctraderClient?.isAuthenticated()) {
            this.sendError(clientId, 'Not connected to cTrader');
            return;
        }
        logger_1.logger.info({ clientId, payload }, 'Unsubscribe request');
    }
    async handleOrder(clientId, payload) {
        const connection = this.clients.get(clientId);
        if (!connection || !connection.ctraderClient?.isAuthenticated()) {
            this.sendError(clientId, 'Not connected to cTrader');
            return;
        }
        try {
            const { symbolId, orderType, tradeSide, volume, stopLoss, takeProfit, comment } = payload;
            if (!symbolId || !orderType || !tradeSide || !volume) {
                this.sendError(clientId, 'Missing required order parameters');
                return;
            }
            connection.ctraderClient.sendOrder(symbolId, orderType, tradeSide, volume, stopLoss, takeProfit, comment);
            logger_1.logger.info({ clientId, userId: connection.userId, payload }, 'Order sent');
        }
        catch (error) {
            logger_1.logger.error({ error, clientId }, 'Failed to send order');
            this.sendError(clientId, 'Failed to send order');
        }
    }
    async handleClosePosition(clientId, payload) {
        const connection = this.clients.get(clientId);
        if (!connection || !connection.ctraderClient?.isAuthenticated()) {
            this.sendError(clientId, 'Not connected to cTrader');
            return;
        }
        try {
            const { positionId, volume } = payload;
            if (!positionId || !volume) {
                this.sendError(clientId, 'Missing positionId or volume');
                return;
            }
            connection.ctraderClient.closePosition(positionId, volume);
            logger_1.logger.info({ clientId, userId: connection.userId, payload }, 'Close position sent');
        }
        catch (error) {
            logger_1.logger.error({ error, clientId }, 'Failed to close position');
            this.sendError(clientId, 'Failed to close position');
        }
    }
    handleClientDisconnect(clientId) {
        const connection = this.clients.get(clientId);
        if (!connection)
            return;
        if (connection.ctraderClient) {
            connection.ctraderClient.disconnect();
        }
        if (connection.userId) {
            this.supabaseClient.setConnectionStatus(connection.userId, false);
        }
        this.clients.delete(clientId);
        logger_1.logger.info({ clientId, userId: connection.userId }, 'Client removed');
    }
    sendToClient(clientId, message) {
        const connection = this.clients.get(clientId);
        if (!connection || connection.ws.readyState !== ws_1.default.OPEN) {
            return;
        }
        try {
            connection.ws.send(JSON.stringify(message));
        }
        catch (error) {
            logger_1.logger.error({ error, clientId }, 'Failed to send message to client');
        }
    }
    sendError(clientId, errorMessage) {
        this.sendToClient(clientId, {
            type: 'error',
            payload: { message: errorMessage },
            timestamp: Date.now(),
        });
    }
    checkRateLimit(clientId, messageType) {
        const connection = this.clients.get(clientId);
        if (!connection)
            return false;
        const key = `${messageType}_${Date.now()}`;
        const now = Date.now();
        for (const [k, entry] of connection.rateLimits.entries()) {
            if (entry.resetAt < now) {
                connection.rateLimits.delete(k);
            }
        }
        const messageCount = Array.from(connection.rateLimits.values()).filter(entry => entry.resetAt > now).length;
        if (messageCount >= config_1.config.rateLimit.messageRateLimit) {
            logger_1.logger.warn({ clientId, messageType }, 'Rate limit exceeded');
            return false;
        }
        connection.rateLimits.set(key, {
            count: 1,
            resetAt: now + config_1.config.rateLimit.rateLimitWindowMs,
        });
        return true;
    }
    performHealthCheck() {
        const now = Date.now();
        for (const [clientId, connection] of this.clients.entries()) {
            if (connection.ws.readyState === ws_1.default.OPEN) {
                connection.ws.ping();
                const timeSinceLastPing = now - connection.lastPing.getTime();
                if (timeSinceLastPing > config_1.config.connection.pingTimeoutMs * 2) {
                    logger_1.logger.warn({ clientId }, 'Client not responding to pings, terminating');
                    connection.ws.terminate();
                    this.handleClientDisconnect(clientId);
                }
            }
            else {
                this.handleClientDisconnect(clientId);
            }
        }
        logger_1.logger.debug({ activeClients: this.clients.size }, 'Health check completed');
    }
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    start() {
        return new Promise((resolve) => {
            this.httpServer.listen(config_1.config.server.port, () => {
                logger_1.logger.info({ port: config_1.config.server.port }, 'WebSocket server started');
                resolve();
            });
        });
    }
    async stop() {
        logger_1.logger.info('Stopping WebSocket server');
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        for (const [clientId, connection] of this.clients.entries()) {
            if (connection.ctraderClient) {
                connection.ctraderClient.disconnect();
            }
            connection.ws.close(1000, 'Server shutdown');
        }
        this.clients.clear();
        await new Promise((resolve, reject) => {
            this.wss.close((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
        await new Promise((resolve, reject) => {
            this.httpServer.close((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
        logger_1.logger.info('WebSocket server stopped');
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=WebSocketServer.js.map