import { EventEmitter } from 'events';
export declare class WebSocketServer extends EventEmitter {
    private httpServer;
    private wss;
    private supabaseClient;
    private authManager;
    private messageHandler;
    private clients;
    private healthCheckInterval;
    constructor();
    initialize(): Promise<void>;
    private setupWebSocketServer;
    private handleClientMessage;
    private handleAuthenticate;
    private handleConnect;
    private handleDisconnect;
    private handleSubscribe;
    private handleUnsubscribe;
    private handleOrder;
    private handleClosePosition;
    private handleClientDisconnect;
    private sendToClient;
    private sendError;
    private checkRateLimit;
    private performHealthCheck;
    private generateClientId;
    start(): Promise<void>;
    stop(): Promise<void>;
}
