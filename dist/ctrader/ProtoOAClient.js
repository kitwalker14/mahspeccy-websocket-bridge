"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtoOAClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const config_1 = require("../config");
const logger_1 = require("../logger");
class ProtoOAClient extends events_1.EventEmitter {
    ws = null;
    messageHandler;
    credentials;
    accountId = null;
    isApplicationAuthed = false;
    isAccountAuthed = false;
    reconnectAttempts = 0;
    reconnectTimer = null;
    pingTimer = null;
    pingTimeout = null;
    messageBuffer = Buffer.allocUnsafe(0);
    currentMessageLength = null;
    constructor(messageHandler, credentials, accountId) {
        super();
        this.messageHandler = messageHandler;
        this.credentials = credentials;
        this.accountId = accountId || null;
    }
    async connect() {
        return new Promise((resolve, reject) => {
            const url = `wss://${config_1.config.ctrader.apiHost}:${config_1.config.ctrader.apiPort}`;
            logger_1.logger.info({ url, userId: this.credentials.userId }, 'Connecting to cTrader API');
            this.ws = new ws_1.default(url, {
                handshakeTimeout: 10000,
                perMessageDeflate: false,
            });
            this.ws.on('open', () => {
                logger_1.logger.info({ userId: this.credentials.userId }, 'WebSocket connected');
                this.reconnectAttempts = 0;
                this.emit('connected');
                this.startPing();
                this.sendVersionRequest();
                resolve();
            });
            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
            this.ws.on('error', (error) => {
                logger_1.logger.error({ error, userId: this.credentials.userId }, 'WebSocket error');
                this.emit('error', error);
                reject(error);
            });
            this.ws.on('close', (code, reason) => {
                const reasonString = reason.toString();
                logger_1.logger.warn({ code, reason: reasonString, userId: this.credentials.userId }, 'WebSocket closed');
                this.cleanup();
                this.emit('disconnected', code, reasonString);
                this.scheduleReconnect();
            });
        });
    }
    handleMessage(data) {
        try {
            this.messageBuffer = Buffer.concat([this.messageBuffer, data]);
            while (this.messageBuffer.length > 0) {
                if (this.currentMessageLength === null) {
                    if (this.messageBuffer.length < 4) {
                        break;
                    }
                    this.currentMessageLength = this.messageBuffer.readUInt32BE(0);
                }
                const totalLength = 4 + this.currentMessageLength;
                if (this.messageBuffer.length < totalLength) {
                    break;
                }
                const messageData = this.messageBuffer.slice(0, totalLength);
                this.messageBuffer = this.messageBuffer.slice(totalLength);
                this.currentMessageLength = null;
                const decoded = this.messageHandler.decodeMessage(messageData);
                if (decoded) {
                    this.processMessage(decoded.type, decoded.payload);
                }
            }
        }
        catch (error) {
            logger_1.logger.error({ error, userId: this.credentials.userId }, 'Error handling message');
        }
    }
    processMessage(type, payload) {
        logger_1.logger.debug({ type, userId: this.credentials.userId }, 'Processing message');
        switch (type) {
            case 'PROTO_OA_VERSION_RES':
                logger_1.logger.info({ version: payload.version }, 'Version response received');
                this.sendApplicationAuth();
                break;
            case 'PROTO_OA_APPLICATION_AUTH_RES':
                logger_1.logger.info({ userId: this.credentials.userId }, 'Application authenticated');
                this.isApplicationAuthed = true;
                this.emit('authenticated');
                if (this.accountId) {
                    this.sendAccountAuth(this.accountId);
                }
                break;
            case 'PROTO_OA_ACCOUNT_AUTH_RES':
                logger_1.logger.info({ userId: this.credentials.userId, accountId: this.accountId }, 'Account authorized');
                this.isAccountAuthed = true;
                this.requestReconcile();
                break;
            case 'PROTO_OA_RECONCILE_RES':
                logger_1.logger.info({ userId: this.credentials.userId }, 'Reconcile response received');
                const account = this.messageHandler.extractAccountInfo(payload);
                const positions = this.messageHandler.extractPositions(payload);
                if (account) {
                    this.emit('accountAuthorized', account);
                }
                if (positions.length > 0) {
                    this.emit('positionUpdate', positions);
                }
                break;
            case 'PROTO_OA_EXECUTION_EVENT':
                logger_1.logger.debug({ userId: this.credentials.userId }, 'Execution event received');
                this.emit('executionEvent', payload);
                break;
            case 'PROTO_OA_SPOT_EVENT':
                this.emit('spotEvent', payload);
                break;
            case 'PROTO_HEARTBEAT_EVENT':
                logger_1.logger.debug({ userId: this.credentials.userId }, 'Heartbeat received');
                this.resetPingTimeout();
                break;
            case 'PROTO_OA_ERROR_RES':
                logger_1.logger.error({ error: payload, userId: this.credentials.userId }, 'Error response from cTrader');
                this.emit('error', new Error(payload.errorCode || 'Unknown error'));
                break;
            default:
                logger_1.logger.debug({ type, userId: this.credentials.userId }, 'Unhandled message type');
        }
    }
    sendVersionRequest() {
        const message = this.messageHandler.createVersionRequest();
        this.send(message);
    }
    sendApplicationAuth() {
        const message = this.messageHandler.createApplicationAuthRequest(this.credentials.clientId, this.credentials.clientSecret);
        this.send(message);
    }
    sendAccountAuth(accountId) {
        const message = this.messageHandler.createAccountAuthRequest(this.credentials.accessToken, accountId);
        this.send(message);
    }
    requestReconcile() {
        if (!this.accountId) {
            logger_1.logger.warn({ userId: this.credentials.userId }, 'Cannot request reconcile without account ID');
            return;
        }
        const message = this.messageHandler.createReconcileRequest(this.accountId);
        this.send(message);
    }
    send(data) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            logger_1.logger.warn({ userId: this.credentials.userId }, 'Cannot send message: WebSocket not open');
            return;
        }
        this.ws.send(data, (error) => {
            if (error) {
                logger_1.logger.error({ error, userId: this.credentials.userId }, 'Failed to send message');
            }
        });
    }
    startPing() {
        this.pingTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                const heartbeat = this.messageHandler.createHeartbeatEvent();
                this.send(heartbeat);
                this.setPingTimeout();
            }
        }, config_1.config.connection.pingIntervalMs);
    }
    setPingTimeout() {
        this.clearPingTimeout();
        this.pingTimeout = setTimeout(() => {
            logger_1.logger.warn({ userId: this.credentials.userId }, 'Ping timeout - closing connection');
            this.ws?.close(1000, 'Ping timeout');
        }, config_1.config.connection.pingTimeoutMs);
    }
    resetPingTimeout() {
        this.clearPingTimeout();
    }
    clearPingTimeout() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
    }
    cleanup() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        this.clearPingTimeout();
        this.isApplicationAuthed = false;
        this.isAccountAuthed = false;
        this.messageBuffer = Buffer.allocUnsafe(0);
        this.currentMessageLength = null;
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= config_1.config.connection.maxReconnectAttempts) {
            logger_1.logger.error({ userId: this.credentials.userId }, 'Max reconnect attempts reached');
            return;
        }
        this.reconnectAttempts++;
        const delay = config_1.config.connection.reconnectIntervalMs * this.reconnectAttempts;
        logger_1.logger.info({ userId: this.credentials.userId, attempt: this.reconnectAttempts, delay }, 'Scheduling reconnect');
        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((error) => {
                logger_1.logger.error({ error, userId: this.credentials.userId }, 'Reconnect failed');
            });
        }, delay);
    }
    authorizeAccount(accountId) {
        this.accountId = accountId;
        if (this.isApplicationAuthed) {
            this.sendAccountAuth(accountId);
        }
    }
    sendOrder(symbolId, orderType, tradeSide, volume, stopLoss, takeProfit, comment) {
        if (!this.isAccountAuthed || !this.accountId) {
            throw new Error('Account not authorized');
        }
        const message = this.messageHandler.createNewOrderRequest(this.accountId, symbolId, orderType, tradeSide, volume, stopLoss, takeProfit, comment);
        this.send(message);
    }
    closePosition(positionId, volume) {
        if (!this.isAccountAuthed || !this.accountId) {
            throw new Error('Account not authorized');
        }
        const message = this.messageHandler.createClosePositionRequest(this.accountId, positionId, volume);
        this.send(message);
    }
    disconnect() {
        logger_1.logger.info({ userId: this.credentials.userId }, 'Disconnecting client');
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = config_1.config.connection.maxReconnectAttempts;
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.cleanup();
    }
    isConnected() {
        return this.ws !== null && this.ws.readyState === ws_1.default.OPEN;
    }
    isAuthenticated() {
        return this.isApplicationAuthed && this.isAccountAuthed;
    }
}
exports.ProtoOAClient = ProtoOAClient;
//# sourceMappingURL=ProtoOAClient.js.map