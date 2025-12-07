/**
 * cTrader WebSocket Client with ProtoOA Protocol Implementation
 * 
 * Handles:
 * - WebSocket connection management
 * - Protocol Buffers encoding/decoding
 * - Authentication flow (Application + Account)
 * - Message request/response correlation
 */

import protobuf from 'protobufjs';
import Long from 'long';
import { 
  ProtoOAPayloadType,
  type ApplicationAuthReq,
  type AccountAuthReq,
  type GetAccountsByAccessTokenReq,
  type TraderReq,
  type SymbolsListReq,
  type ReconcileReq,
} from './proto-messages.ts';

// Protocol Buffers schema for cTrader ProtoMessage wrapper
const protoMessageSchema = `
syntax = "proto2";

message ProtoMessage {
    optional uint32 payloadType = 1;
    optional bytes payload = 2;
    optional string clientMsgId = 3;
}
`;

export interface CTraderCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  accountId: string;
  isDemo: boolean;
}

export class CTraderClient {
  private ws: WebSocket | null = null;
  private host: string;
  private port: number;
  private appAuthenticated = false;
  private accountAuthenticated = false;
  private messageId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: number;
  }>();
  private ProtoMessageType: any;
  private heartbeatInterval: number | null = null;

  constructor(isDemo: boolean) {
    this.host = isDemo ? 'demo.ctraderapi.com' : 'live.ctraderapi.com';
    this.port = 5035;
    
    // Initialize Protocol Buffers
    const root = protobuf.parse(protoMessageSchema).root;
    this.ProtoMessageType = root.lookupType('ProtoMessage');
  }

  /**
   * Connect to cTrader WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://${this.host}:${this.port}/`;
      console.log(`[CTraderClient] Connecting to ${url}...`);
      
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout (10s)'));
      }, 10000);

      this.ws = new WebSocket(url);
      
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        clearTimeout(timeout);
        console.log('[CTraderClient] ✅ Connected');
        
        // Start heartbeat
        this.startHeartbeat();
        
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onerror = (error) => {
        console.error('[CTraderClient] ❌ WebSocket error:', error);
        clearTimeout(timeout);
        reject(new Error('WebSocket connection error'));
      };
      
      this.ws.onclose = () => {
        console.log('[CTraderClient] Connection closed');
        this.cleanup();
      };
    });
  }

  /**
   * Disconnect from cTrader
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.appAuthenticated = false;
    this.accountAuthenticated = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Reject all pending requests
    for (const [msgId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
      this.pendingRequests.delete(msgId);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send heartbeat
        const heartbeat = this.encodeMessage(ProtoOAPayloadType.HEARTBEAT_EVENT, {});
        this.ws.send(heartbeat);
      }
    }, 25000); // Every 25 seconds
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: ArrayBuffer): void {
    try {
      // Decode ProtoMessage wrapper
      const buffer = new Uint8Array(data);
      const message = this.ProtoMessageType.decode(buffer);
      const payloadType = message.payloadType;
      const clientMsgId = message.clientMsgId;
      
      console.log(`[CTraderClient] ← Received: ${this.getMessageTypeName(payloadType)} (msgId: ${clientMsgId})`);
      
      // Handle heartbeat
      if (payloadType === ProtoOAPayloadType.HEARTBEAT_EVENT) {
        return; // Ignore heartbeat responses
      }
      
      // Find pending request
      if (clientMsgId && this.pendingRequests.has(clientMsgId)) {
        const request = this.pendingRequests.get(clientMsgId)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(clientMsgId);
        
        // Decode payload based on message type
        const payload = this.decodePayload(payloadType, message.payload);
        
        // Check for errors
        if (payloadType === ProtoOAPayloadType.PROTO_OA_ERROR_RES) {
          request.reject(new Error(`cTrader Error: ${payload.errorCode} - ${payload.description}`));
        } else {
          request.resolve(payload);
        }
      }
    } catch (error) {
      console.error('[CTraderClient] Failed to handle message:', error);
    }
  }

  /**
   * Send request and wait for response
   */
  private async sendRequest<T>(payloadType: number, payload: any, timeoutMs = 30000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const msgId = `msg_${++this.messageId}_${Date.now()}`;
      const encodedMessage = this.encodeMessage(payloadType, payload, msgId);
      
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(msgId);
        reject(new Error(`Request timeout (${timeoutMs}ms): ${this.getMessageTypeName(payloadType)}`));
      }, timeoutMs);
      
      // Store pending request
      this.pendingRequests.set(msgId, { resolve, reject, timeout });
      
      // Send message
      console.log(`[CTraderClient] → Sending: ${this.getMessageTypeName(payloadType)} (msgId: ${msgId})`);
      this.ws!.send(encodedMessage);
    });
  }

  /**
   * Encode message with Protocol Buffers
   */
  private encodeMessage(payloadType: number, payload: any, clientMsgId?: string): Uint8Array {
    // Encode payload (simplified - in production, use proper protobuf schemas for each message type)
    const payloadBytes = this.encodePayload(payloadType, payload);
    
    // Encode ProtoMessage wrapper
    const message = {
      payloadType,
      payload: payloadBytes,
      clientMsgId,
    };
    
    const errMsg = this.ProtoMessageType.verify(message);
    if (errMsg) {
      throw new Error('Invalid ProtoMessage: ' + errMsg);
    }
    
    const protoMessage = this.ProtoMessageType.create(message);
    return this.ProtoMessageType.encode(protoMessage).finish();
  }

  /**
   * Encode payload (simplified JSON encoding - in production, use proper protobuf schemas)
   */
  private encodePayload(payloadType: number, payload: any): Uint8Array {
    // For simplicity, we're using JSON encoding
    // In production, use proper Protocol Buffers schemas for each message type
    const json = JSON.stringify(payload);
    return new TextEncoder().encode(json);
  }

  /**
   * Decode payload (simplified JSON decoding - in production, use proper protobuf schemas)
   */
  private decodePayload(payloadType: number, payloadBytes: Uint8Array): any {
    // For simplicity, we're using JSON decoding
    // In production, use proper Protocol Buffers schemas for each message type
    try {
      const json = new TextDecoder().decode(payloadBytes);
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  /**
   * Get message type name for logging
   */
  private getMessageTypeName(payloadType: number): string {
    return ProtoOAPayloadType[payloadType] || `UNKNOWN_${payloadType}`;
  }

  /**
   * Authenticate application
   */
  async authenticateApp(clientId: string, clientSecret: string): Promise<void> {
    if (this.appAuthenticated) {
      return; // Already authenticated
    }

    console.log('[CTraderClient] Authenticating application...');
    
    const request: ApplicationAuthReq = {
      clientId,
      clientSecret,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ,
      request
    );
    
    this.appAuthenticated = true;
    console.log('[CTraderClient] ✅ Application authenticated');
  }

  /**
   * Authenticate account
   */
  async authenticateAccount(accountId: string, accessToken: string): Promise<void> {
    if (!this.appAuthenticated) {
      throw new Error('Application not authenticated');
    }
    
    if (this.accountAuthenticated) {
      return; // Already authenticated
    }

    console.log('[CTraderClient] Authenticating account...');
    
    const request: AccountAuthReq = {
      ctidTraderAccountId: parseInt(accountId),
      accessToken,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ,
      request
    );
    
    this.accountAuthenticated = true;
    console.log('[CTraderClient] ✅ Account authenticated');
  }

  /**
   * Get accounts by access token
   */
  async getAccounts(accessToken: string): Promise<any> {
    if (!this.appAuthenticated) {
      throw new Error('Application not authenticated');
    }

    console.log('[CTraderClient] Fetching accounts...');
    
    const request: GetAccountsByAccessTokenReq = {
      accessToken,
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
      request
    );
    
    return response;
  }

  /**
   * Get trader (account) info
   */
  async getTrader(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Fetching trader info...');
    
    const request: TraderReq = {
      ctidTraderAccountId: parseInt(accountId),
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_TRADER_REQ,
      request
    );
    
    return response;
  }

  /**
   * Get symbols list
   */
  async getSymbols(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Fetching symbols...');
    
    const request: SymbolsListReq = {
      ctidTraderAccountId: parseInt(accountId),
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_SYMBOLS_LIST_REQ,
      request,
      60000 // 60s timeout for symbols (large response)
    );
    
    return response;
  }

  /**
   * Get positions (via reconcile)
   */
  async getPositions(accountId: string): Promise<any> {
    if (!this.accountAuthenticated) {
      throw new Error('Account not authenticated');
    }

    console.log('[CTraderClient] Fetching positions...');
    
    const request: ReconcileReq = {
      ctidTraderAccountId: parseInt(accountId),
    };
    
    const response = await this.sendRequest(
      ProtoOAPayloadType.PROTO_OA_RECONCILE_REQ,
      request,
      45000 // 45s timeout for positions
    );
    
    return response;
  }

  /**
   * Full authentication flow
   */
  async fullAuth(credentials: CTraderCredentials): Promise<void> {
    await this.authenticateApp(credentials.clientId, credentials.clientSecret);
    await this.authenticateAccount(credentials.accountId, credentials.accessToken);
  }
}
