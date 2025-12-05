/**
 * cTrader Protocol Buffers Encoder/Decoder
 * 
 * This module provides utilities for encoding and decoding Protocol Buffers messages
 * used by cTrader Open API (ProtoOA protocol).
 * 
 * SPECIFICATION:
 * - Protocol: Protocol Buffers (protobuf) version 2
 * - Encoding: Binary
 * - Wire types: varint, fixed64, length-delimited, fixed32
 * - Message framing: 4-byte length prefix (big-endian) + protobuf message
 * 
 * WIRE TYPES:
 * - 0: Varint (int32, int64, uint32, uint64, bool, enum)
 * - 1: Fixed64 (fixed64, sfixed64, double)
 * - 2: Length-delimited (string, bytes, nested messages)
 * - 5: Fixed32 (fixed32, sfixed32, float)
 */

// ✅ Import secure logger
import { createLogger, LogLevel } from './logger.ts';

// Create logger for this module
const logger = createLogger('[Protobuf]');

/**
 * ProtoOA Message Types
 */
export const ProtoOAPayloadType = {
  // Application messages
  PROTO_OA_APPLICATION_AUTH_REQ: 2100,
  PROTO_OA_APPLICATION_AUTH_RES: 2101,
  
  // Account messages
  PROTO_OA_ACCOUNT_AUTH_REQ: 2102,
  PROTO_OA_ACCOUNT_AUTH_RES: 2103,
  
  // Trading messages
  PROTO_OA_NEW_ORDER_REQ: 2126,
  PROTO_OA_EXECUTION_EVENT: 2127,
  PROTO_OA_CANCEL_ORDER_REQ: 2131,
  PROTO_OA_AMEND_POSITION_SLTP_REQ: 2138,
  PROTO_OA_AMEND_POSITION_SLTP_RES: 2139,
  PROTO_OA_CLOSE_POSITION_REQ: 2140,
  PROTO_OA_CLOSE_POSITION_RES: 2141,
  
  // Account data
  PROTO_OA_TRADER_REQ: 2121,
  PROTO_OA_TRADER_RES: 2122,
  PROTO_OA_RECONCILE_REQ: 2124,
  PROTO_OA_RECONCILE_RES: 2125,
  
  // Symbol data
  PROTO_OA_SYMBOLS_LIST_REQ: 2113,
  PROTO_OA_SYMBOLS_LIST_RES: 2114,
  
  // Heartbeat
  PROTO_OA_HEARTBEAT_EVENT: 2051,
  
  // Error
  PROTO_OA_ERROR_RES: 2050,
  
  // Version
  PROTO_OA_VERSION_REQ: 2116,
  PROTO_OA_VERSION_RES: 2117,
};

/**
 * ProtoMessage structure
 */
export interface ProtoMessage {
  payloadType: number;
  payload: any;
}

/**
 * Simplified Protocol Buffers Encoder
 */
export class SimpleProtoEncoder {
  /**
   * Encode a ProtoOA message
   * 
   * MESSAGE STRUCTURE:
   * [4 bytes: length] [protobuf message]
   * 
   * Protobuf message:
   * - Field 1 (varint): payloadType
   * - Field 2 (length-delimited): payload
   * 
   * @param payloadType - ProtoOA message type
   * @param payload - Field number to value map
   * @returns Encoded message as Uint8Array
   */
  static encodeMessage(payloadType: number, payload: any): Uint8Array {
    const payloadBytes = this.encodePayload(payload);
    
    // Create ProtoMessage wrapper
    const messageBytes: number[] = [];
    
    // Field 1: payloadType (wire type 0 = varint)
    messageBytes.push((1 << 3) | 0);
    messageBytes.push(...this.encodeVarint(payloadType));
    
    // Field 2: payload (wire type 2 = length-delimited)
    messageBytes.push((2 << 3) | 2);
    messageBytes.push(...this.encodeVarint(payloadBytes.length));
    messageBytes.push(...payloadBytes);
    
    // Prepend with total message length (4 bytes, big-endian)
    const lengthPrefix = new Uint8Array(4);
    new DataView(lengthPrefix.buffer).setUint32(0, messageBytes.length, false);
    
    return new Uint8Array([...lengthPrefix, ...messageBytes]);
  }
  
  /**
   * Encode payload (field number → value map)
   */
  private static encodePayload(obj: any): number[] {
    const bytes: number[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      
      const fieldNum = parseInt(key);
      if (isNaN(fieldNum)) continue;
      
      if (typeof value === 'string') {
        // Wire type 2: length-delimited
        bytes.push((fieldNum << 3) | 2);
        const strBytes = new TextEncoder().encode(value);
        bytes.push(...this.encodeVarint(strBytes.length));
        bytes.push(...strBytes);
        
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          // Wire type 0: varint
          bytes.push((fieldNum << 3) | 0);
          // Use varint64 for large numbers (account IDs)
          bytes.push(...this.encodeVarint64(value));
        } else {
          // Wire type 1: fixed64 (double)
          bytes.push((fieldNum << 3) | 1);
          const buf = new ArrayBuffer(8);
          new DataView(buf).setFloat64(0, value, true);
          bytes.push(...new Uint8Array(buf));
        }
        
      } else if (typeof value === 'boolean') {
        // Wire type 0: varint (0 or 1)
        bytes.push((fieldNum << 3) | 0);
        bytes.push(value ? 1 : 0);
        
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Wire type 2: nested message
        bytes.push((fieldNum << 3) | 2);
        const nestedBytes = this.encodePayload(value);
        bytes.push(...this.encodeVarint(nestedBytes.length));
        bytes.push(...nestedBytes);
      }
    }
    
    return bytes;
  }
  
  /**
   * Encode varint (variable-length integer)
   */
  private static encodeVarint(value: number): number[] {
    const bytes: number[] = [];
    let v = value >>> 0; // Convert to unsigned 32-bit
    
    while (v > 127) {
      bytes.push((v & 0x7f) | 0x80); // Set continuation bit
      v >>>= 7;
    }
    bytes.push(v & 0x7f); // Last byte, no continuation bit
    
    return bytes;
  }
  
  /**
   * Encode varint64 (variable-length 64-bit integer)
   * 
   * CRITICAL FOR: Account IDs, position IDs, large numbers
   */
  private static encodeVarint64(value: number): number[] {
    const bytes: number[] = [];
    
    if (value > Number.MAX_SAFE_INTEGER) {
      logger.warn(`⚠️ Number ${value} exceeds MAX_SAFE_INTEGER, may lose precision`);
    }
    
    if (value < 0) {
      logger.warn(`⚠️ Negative number ${value} - using absolute value`);
      value = Math.abs(value);
    }
    
    if (value === 0) {
      return [0];
    }
    
    let remaining = value;
    
    while (remaining > 0) {
      // Take lower 7 bits
      let byte = remaining & 0x7F;
      
      // Shift right by 7 bits
      remaining = Math.floor(remaining / 128);
      
      // Set continuation bit if more bytes remain
      if (remaining > 0) {
        byte |= 0x80;
      }
      
      bytes.push(byte);
    }
    
    return bytes;
  }
  
  /**
   * Decode a ProtoOA message
   */
  static decodeMessage(data: Uint8Array): ProtoMessage | null {
    try {
      // Skip length prefix (first 4 bytes)
      const messageData = data.slice(4);
      
      let offset = 0;
      let payloadType = 0;
      let payloadBytes: Uint8Array | null = null;
      
      while (offset < messageData.length) {
        const tag = messageData[offset++];
        const fieldNum = tag >> 3;
        const wireType = tag & 0x7;
        
        if (fieldNum === 1 && wireType === 0) {
          // Field 1: payloadType (varint)
          const { value, bytesRead } = this.decodeVarint(messageData, offset);
          payloadType = value;
          offset += bytesRead;
          
        } else if (fieldNum === 2 && wireType === 2) {
          // Field 2: payload (length-delimited)
          const { value: length, bytesRead } = this.decodeVarint(messageData, offset);
          offset += bytesRead;
          payloadBytes = messageData.slice(offset, offset + length);
          offset += length;
          
        } else {
          // Skip unknown field
          offset = this.skipField(messageData, offset, wireType);
        }
      }
      
      const payload = payloadBytes ? this.decodePayload(payloadBytes) : {};
      
      return { payloadType, payload };
      
    } catch (error) {
      console.error('Failed to decode protobuf message:', error);
      return null;
    }
  }
  
  /**
   * Decode payload bytes into object
   */
  private static decodePayload(data: Uint8Array): any {
    const obj: any = {};
    let offset = 0;
    
    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 0) {
        // Varint
        const { value, bytesRead } = this.decodeVarint(data, offset);
        obj[fieldNum] = value;
        offset += bytesRead;
        
      } else if (wireType === 1) {
        // Fixed64
        const buf = data.slice(offset, offset + 8);
        obj[fieldNum] = new DataView(buf.buffer, buf.byteOffset).getFloat64(0, true);
        offset += 8;
        
      } else if (wireType === 2) {
        // Length-delimited
        const { value: length, bytesRead } = this.decodeVarint(data, offset);
        offset += bytesRead;
        const bytes = data.slice(offset, offset + length);
        
        // Try to decode as string, otherwise as nested message
        try {
          obj[fieldNum] = new TextDecoder().decode(bytes);
        } catch {
          obj[fieldNum] = this.decodePayload(bytes);
        }
        
        offset += length;
        
      } else if (wireType === 5) {
        // Fixed32
        const buf = data.slice(offset, offset + 4);
        obj[fieldNum] = new DataView(buf.buffer, buf.byteOffset).getFloat32(0, true);
        offset += 4;
        
      } else {
        // Unknown wire type, skip
        offset = this.skipField(data, offset, wireType);
      }
    }
    
    return obj;
  }
  
  /**
   * Decode varint from data at offset
   */
  private static decodeVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
    let value = 0;
    let shift = 0;
    let bytesRead = 0;
    
    while (offset + bytesRead < data.length) {
      const byte = data[offset + bytesRead];
      bytesRead++;
      
      value |= (byte & 0x7f) << shift;
      
      if ((byte & 0x80) === 0) {
        // Last byte
        break;
      }
      
      shift += 7;
      
      // Safety: prevent infinite loop
      if (bytesRead > 10) {
        throw new Error('Varint too long');
      }
    }
    
    return { value, bytesRead };
  }
  
  /**
   * Skip field based on wire type
   */
  private static skipField(data: Uint8Array, offset: number, wireType: number): number {
    if (wireType === 0) {
      // Varint: read until MSB is 0
      while (offset < data.length && (data[offset] & 0x80) !== 0) {
        offset++;
      }
      return offset + 1;
      
    } else if (wireType === 1) {
      // Fixed64
      return offset + 8;
      
    } else if (wireType === 2) {
      // Length-delimited
      const { value: length, bytesRead } = this.decodeVarint(data, offset);
      return offset + bytesRead + length;
      
    } else if (wireType === 5) {
      // Fixed32
      return offset + 4;
    }
    
    return offset;
  }
  
  /**
   * Generate hex dump of message (for debugging)
   */
  static hexDump(data: Uint8Array, maxBytes: number = 100): string {
    const bytes = Array.from(data.slice(0, maxBytes));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
  }
}
