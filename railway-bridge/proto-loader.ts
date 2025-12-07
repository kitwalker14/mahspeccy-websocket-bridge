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
  private protoMessages: Record<string, protobuf.Type> = {};
  
  /**
   * Load all proto files
   */
  async load(): Promise<void> {
    console.log('[ProtoLoader] Loading Protocol Buffer schemas...');
    
    try {
      // Create root
      this.root = new protobuf.Root();
      
      // Read and parse proto files (Deno-compatible way)
      const protoFiles = [
        'OpenApiCommonModelMessages.proto',
        'OpenApiCommonMessages.proto',
        'OpenApiModelMessages.proto',
        'OpenApiMessages.proto',
      ];
      
      for (const filename of protoFiles) {
        const filepath = `${PROTO_DIR}${filename}`;
        const content = await Deno.readTextFile(filepath);
        protobuf.parse(content, this.root, { keepCase: true });
      }
      
      // Get ProtoMessage type (wrapper for all messages)
      const ProtoMessageType = this.root.lookupType('ProtoMessage');
      
      console.log('[ProtoLoader] ✅ Protocol Buffers loaded successfully');
      
      // Populate protoMessages map
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
      
      for (const [payloadType, messageTypeName] of Object.entries(typeMap)) {
        const MessageType = this.root.lookupType(messageTypeName);
        if (MessageType) {
          this.protoMessages[messageTypeName] = MessageType;
        } else {
          console.warn(`[ProtoLoader] Message type not found: ${messageTypeName}`);
        }
      }
    } catch (error) {
      console.error('[ProtoLoader] ❌ Failed to load proto files:', error);
      throw error;
    }
  }
  
  /**
   * Encode message with Protocol Buffers
   */
  encodeMessage(payloadType: number, payload: any, clientMsgId?: string): Uint8Array {
    if (!this.protoMessages) {
      throw new Error('Protocol Buffers not loaded');
    }

    // Get payload type name
    const payloadTypeName = this.getPayloadTypeName(payloadType);
    console.log(`[ProtoLoader] 🔧 Encoding ${payloadTypeName}...`);
    console.log(`[ProtoLoader] 📦 Payload:`, JSON.stringify(payload, null, 2));
    
    // Get message type
    const MessageType = this.protoMessages[payloadTypeName];
    if (!MessageType) {
      throw new Error(`Message type not found: ${payloadTypeName}`);
    }

    // Log the message schema
    console.log(`[ProtoLoader] 📋 Message schema fields:`, Object.keys(MessageType.fields || {}));
    
    // Verify the message
    const errMsg = MessageType.verify(payload);
    if (errMsg) {
      console.error(`[ProtoLoader] ❌ Verification failed: ${errMsg}`);
      throw new Error(`Message verification failed: ${errMsg}`);
    }
    
    // Create and encode the payload message
    const payloadMessage = MessageType.create(payload);
    console.log(`[ProtoLoader] ✅ Created message:`, JSON.stringify(MessageType.toObject(payloadMessage), null, 2));
    
    const payloadBytes = MessageType.encode(payloadMessage).finish();
    console.log(`[ProtoLoader] 📊 Encoded payload size: ${payloadBytes.length} bytes`);
    console.log(`[ProtoLoader] 🔍 Encoded payload (hex):`, Array.from(payloadBytes.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));

    // Create ProtoMessage wrapper
    const ProtoMessage = this.root?.lookupType('ProtoMessage');
    if (!ProtoMessage) {
      throw new Error('ProtoMessage type not found');
    }

    const wrapper = {
      payloadType,
      payload: payloadBytes,
      clientMsgId: clientMsgId || `msg_${Date.now()}`,
    };

    const message = ProtoMessage.create(wrapper);
    const encoded = ProtoMessage.encode(message).finish();
    
    console.log(`[ProtoLoader] ✅ Final message size: ${encoded.length} bytes`);
    return encoded;
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
  
  /**
   * Get payload type name from payload type number
   */
  private getPayloadTypeName(payloadType: number): string {
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