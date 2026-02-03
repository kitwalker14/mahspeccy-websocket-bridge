interface Config {
    server: {
        port: number;
        nodeEnv: string;
        logLevel: string;
    };
    supabase: {
        url: string;
        serviceRoleKey: string;
    };
    ctrader: {
        apiHost: string;
        apiPort: number;
    };
    security: {
        apiKey: string;
        allowedOrigins: string[];
    };
    connection: {
        maxReconnectAttempts: number;
        reconnectIntervalMs: number;
        pingIntervalMs: number;
        pingTimeoutMs: number;
    };
    rateLimit: {
        maxConnectionsPerUser: number;
        messageRateLimit: number;
        rateLimitWindowMs: number;
    };
}
export declare const config: Config;
export declare function validateConfig(): void;
export {};
