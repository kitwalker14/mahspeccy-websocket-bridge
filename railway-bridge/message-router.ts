/**
 * Message Router
 * Translates between WebSocket JSON and cTrader ProtoOA Protocol Buffers
 */

import type { CTraderTcpClient } from './ctrader/tcp-client.ts';
import { ProtoOAPayloadType } from './ctrader/protobuf.ts';

export interface WebSocketMessage {
  type: string;
  requestId?: string;
  payload?: any;
}

export interface WebSocketResponse {
  type: string;
  requestId?: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class MessageRouter {
  /**
   * Handle incoming WebSocket message and route to TCP
   */
  async handleWebSocketMessage(
    message: WebSocketMessage,
    tcpClient: CTraderTcpClient
  ): Promise<void> {
    const { type, requestId, payload } = message;
    
    try {
      switch (type) {
        case 'GET_ACCOUNT':
          const accountData = await tcpClient.getAccountInfo();
          // Response will be sent via TCP event listener
          break;
          
        case 'GET_POSITIONS':
          const positions = await tcpClient.getPositions();
          // Response will be sent via TCP event listener
          break;
          
        case 'PLACE_ORDER':
          // TODO: Implement order placement
          throw new Error('Order placement not yet implemented');
          
        case 'CLOSE_POSITION':
          // TODO: Implement position closing
          throw new Error('Position closing not yet implemented');
          
        case 'PING':
          // Simple ping/pong for connection testing
          // Will be handled by WebSocket directly
          break;
          
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ [MessageRouter] Error handling ${type}:`, error);
      throw error;
    }
  }
  
  /**
   * Convert ProtoOA message to JSON for WebSocket
   */
  protoToJson(protoData: any): WebSocketResponse {
    // This will be populated as we handle different ProtoOA message types
    // For now, pass through
    return {
      type: 'PROTO_MESSAGE',
      success: true,
      data: protoData,
    };
  }
  
  /**
   * Convert JSON to ProtoOA format
   */
  jsonToProto(jsonMessage: WebSocketMessage): any {
    // This will be populated as needed
    return jsonMessage.payload;
  }
  
  // ============================================================================
  // REST API HELPERS (for Supabase Edge Function integration)
  // ============================================================================
  
  /**
   * Request account info synchronously (for REST API)
   * Returns account balance, equity, margin, etc.
   */
  async requestAccountInfo(tcpClient: CTraderTcpClient, accountId: string): Promise<any> {
    console.log(`📊 [MessageRouter] Requesting account info for ${accountId}...`);
    
    try {
      const accountData = await tcpClient.getAccountInfo();
      
      console.log(`✅ [MessageRouter] Account data received:`, {
        balance: accountData.balance,
        equity: accountData.equity,
      });
      
      return accountData;
    } catch (error) {
      console.error(`❌ [MessageRouter] Failed to get account info:`, error);
      throw error;
    }
  }
  
  /**
   * Request positions/orders synchronously (for REST API)
   * Returns open positions, pending orders, and recent deals
   */
  async requestPositions(tcpClient: CTraderTcpClient, accountId: string): Promise<any> {
    console.log(`📍 [MessageRouter] Requesting positions for ${accountId}...`);
    
    try {
      const positionsData = await tcpClient.getPositions();
      
      console.log(`✅ [MessageRouter] Positions received:`, {
        positions: positionsData.positions?.length || 0,
        orders: positionsData.orders?.length || 0,
      });
      
      return positionsData;
    } catch (error) {
      console.error(`❌ [MessageRouter] Failed to get positions:`, error);
      throw error;
    }
  }
  
  /**
   * Request symbols synchronously (for REST API)
   * Returns list of tradeable instruments
   */
  async requestSymbols(tcpClient: CTraderTcpClient, accountId: string): Promise<any> {
    console.log(`📋 [MessageRouter] Requesting symbols for ${accountId}...`);
    
    try {
      const symbolsData = await tcpClient.getSymbols();
      
      console.log(`✅ [MessageRouter] Symbols received:`, {
        count: symbolsData.symbols?.length || 0,
      });
      
      return symbolsData;
    } catch (error) {
      console.error(`❌ [MessageRouter] Failed to get symbols:`, error);
      throw error;
    }
  }
}