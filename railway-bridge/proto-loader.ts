/**
 * Protocol Buffers Loader for cTrader Open API
 * 
 * Loads and compiles all .proto files for cTrader ProtoOA protocol
 */

import protobuf from 'protobufjs';
import { ProtoOAPayloadType } from './proto-messages.ts';

// Proto file paths
const PROTO_DIR = new URL('./proto/', import.meta.url).pathname;

export class ProtoLoader {
  private root: protobuf.Root | null = null;
  private ProtoMessageType: protobuf.Type | null = null;
  
  /**
   * Load all proto files
   */
  async load(): Promise<void> {
    console.log('[ProtoLoader] Loading Protocol Buffer schemas...');
    
    try {
      // Create root
      this.root = new protobuf.Root();
      
      // Load proto files in correct order (dependencies first)
      await this.root.load([
        `${PROTO_DIR}OpenApiCommonModelMessages.proto`,
        `${PROTO_DIR}OpenApiCommonMessages.proto`,
        `${PROTO_DIR}OpenApiModelMessages.proto`,
        `${PROTO_DIR}OpenApiMessages.proto`,
      ], { keepCase: true });
      
      // Get ProtoMessage type (wrapper for all messages)
      this.ProtoMessageType = this.root.lookupType('ProtoMessage');
      
      console.log('[ProtoLoader] ✅ Protocol Buffers loaded successfully');
    } catch (error) {
      console.error('[ProtoLoader] ❌ Failed to load proto files:', error);
      throw error;
    }
  }
  
  /**
   * Encode a ProtoOA message
   */
  encodeMessage(payloadType: ProtoOAPayloadType, payload: any, clientMsgId?: string): Uint8Array {
    if (!this.root || !this.ProtoMessageType) {
      throw new Error('Proto files not loaded. Call load() first.');
    }
    
    // Get message type name from enum
    const messageTypeName = this.getMessageTypeName(payloadType);
    
    // Look up the message type
    const PayloadMessageType = this.root.lookupType(messageTypeName);
    
    // Create and encode payload
    const payloadMessage = PayloadMessageType.create(payload);
    const payloadBytes = PayloadMessageType.encode(payloadMessage).finish();
    
    // Create ProtoMessage wrapper
    const protoMessage = this.ProtoMessageType.create({
      payloadType,
      payload: payloadBytes,
      clientMsgId,
    });
    
    // Encode and return
    return this.ProtoMessageType.encode(protoMessage).finish();
  }
  
  /**
   * Decode a ProtoMessage
   */
  decodeMessage(buffer: Uint8Array): { payloadType: number; payload: any; clientMsgId?: string } {
    if (!this.root || !this.ProtoMessageType) {
      throw new Error('Proto files not loaded. Call load() first.');
    }
    
    // Decode ProtoMessage wrapper
    const protoMessage = this.ProtoMessageType.decode(buffer) as any;
    const payloadType = protoMessage.payloadType;
    const payloadBytes = protoMessage.payload;
    const clientMsgId = protoMessage.clientMsgId;
    
    // Get message type name
    const messageTypeName = this.getMessageTypeName(payloadType);
    
    // Decode payload
    let payload: any = {};
    try {
      const PayloadMessageType = this.root.lookupType(messageTypeName);
      payload = PayloadMessageType.decode(payloadBytes);
    } catch (error) {
      console.warn(`[ProtoLoader] Could not decode payload for type ${payloadType} (${messageTypeName}):`, error);
    }
    
    return {
      payloadType,
      payload: payload.toJSON ? payload.toJSON() : payload,
      clientMsgId,
    };
  }
  
  /**
   * Get message type name from payload type number
   */
  private getMessageTypeName(payloadType: number): string {
    // Map payload type numbers to message type names
    const typeMap: Record<number, string> = {
      // Application Auth
      [ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ]: 'ProtoOAApplicationAuthReq',
      [ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_RES]: 'ProtoOAApplicationAuthRes',
      
      // Account Auth
      [ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ]: 'ProtoOAAccountAuthReq',
      [ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_RES]: 'ProtoOAAccountAuthRes',
      
      // Trader (Account Info)
      [ProtoOAPayloadType.PROTO_OA_TRADER_REQ]: 'ProtoOATraderReq',
      [ProtoOAPayloadType.PROTO_OA_TRADER_RES]: 'ProtoOATraderRes',
      
      // Reconcile (Positions)
      [ProtoOAPayloadType.PROTO_OA_RECONCILE_REQ]: 'ProtoOAReconcileReq',
      [ProtoOAPayloadType.PROTO_OA_RECONCILE_RES]: 'ProtoOAReconcileRes',
      
      // Symbols
      [ProtoOAPayloadType.PROTO_OA_SYMBOLS_LIST_REQ]: 'ProtoOASymbolsListReq',
      [ProtoOAPayloadType.PROTO_OA_SYMBOLS_LIST_RES]: 'ProtoOASymbolsListRes',
      
      // Accounts by token
      [ProtoOAPayloadType.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ]: 'ProtoOAGetAccountListByAccessTokenReq',
      [ProtoOAPayloadType.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES]: 'ProtoOAGetAccountListByAccessTokenRes',
      
      // Error
      [ProtoOAPayloadType.PROTO_OA_ERROR_RES]: 'ProtoOAErrorRes',
      
      // Heartbeat (common)
      [51]: 'ProtoHeartbeatEvent',
    };
    
    const name = typeMap[payloadType];
    if (!name) {
      console.warn(`[ProtoLoader] Unknown payload type: ${payloadType}`);
      return 'UnknownMessage';
    }
    
    return name;
  }
}

// Global singleton instance
export const protoLoader = new ProtoLoader();
