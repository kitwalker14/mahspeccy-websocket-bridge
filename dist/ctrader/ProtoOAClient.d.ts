import { EventEmitter } from 'events';
import { MessageHandler } from './MessageHandler';
import { UserCredentials, CTraderAccount, Position } from '../types';
export interface ProtoOAClientEvents {
    connected: () => void;
    authenticated: () => void;
    accountAuthorized: (account: CTraderAccount) => void;
    positionUpdate: (positions: Position[]) => void;
    executionEvent: (event: any) => void;
    spotEvent: (event: any) => void;
    error: (error: Error) => void;
    disconnected: (code: number, reason: string) => void;
}
export declare interface ProtoOAClient {
    on<U extends keyof ProtoOAClientEvents>(event: U, listener: ProtoOAClientEvents[U]): this;
    emit<U extends keyof ProtoOAClientEvents>(event: U, ...args: Parameters<ProtoOAClientEvents[U]>): boolean;
}
export declare class ProtoOAClient extends EventEmitter {
    private ws;
    private messageHandler;
    private credentials;
    private accountId;
    private isApplicationAuthed;
    private isAccountAuthed;
    private reconnectAttempts;
    private reconnectTimer;
    private pingTimer;
    private pingTimeout;
    private messageBuffer;
    private currentMessageLength;
    constructor(messageHandler: MessageHandler, credentials: UserCredentials, accountId?: string);
    connect(): Promise<void>;
    private handleMessage;
    private processMessage;
    private sendVersionRequest;
    private sendApplicationAuth;
    private sendAccountAuth;
    private requestReconcile;
    private send;
    private startPing;
    private setPingTimeout;
    private resetPingTimeout;
    private clearPingTimeout;
    private cleanup;
    private scheduleReconnect;
    authorizeAccount(accountId: string): void;
    sendOrder(symbolId: number, orderType: number, tradeSide: number, volume: number, stopLoss?: number, takeProfit?: number, comment?: string): void;
    closePosition(positionId: string, volume: number): void;
    disconnect(): void;
    isConnected(): boolean;
    isAuthenticated(): boolean;
}
