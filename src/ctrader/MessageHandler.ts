import * as protobuf from 'protobufjs'
import { resolve } from 'path'
import { logger } from '../logger'
import { CTraderAccount, Position } from '../types'

export class MessageHandler {
  private root: protobuf.Root | null = null
  private ProtoOAPayloadType: any
  private ProtoPayloadType: any
  private ProtoMessage: any
  private ProtoOAApplicationAuthReq: any
  private ProtoOAApplicationAuthRes: any
  private ProtoOAAccountAuthReq: any
  private ProtoOAAccountAuthRes: any
  private ProtoOAVersionReq: any
  private ProtoOAVersionRes: any
  private ProtoOAExecutionEvent: any
  private ProtoOASpotEvent: any
  private ProtoHeartbeatEvent: any
  private ProtoErrorRes: any
  private ProtoOAErrorRes: any
  private ProtoOANewOrderReq: any
  private ProtoOAClosePositionReq: any
  private ProtoOAReconcileReq: any
  private ProtoOAReconcileRes: any

  async initialize(): Promise<void> {
    try {
      const protoPath = resolve(__dirname, './proto')
      
      this.root = new protobuf.Root()
      
      // Load proto files in correct dependency order
      await this.root.load([
        resolve(protoPath, 'OpenApiCommonModelMessages.proto'),
        resolve(protoPath, 'OpenApiModelMessages.proto'),
        resolve(protoPath, 'OpenApiCommonMessages.proto'),
        resolve(protoPath, 'OpenApiMessages.proto'),
      ])

      this.ProtoPayloadType = this.root.lookupEnum('ProtoPayloadType')
      this.ProtoOAPayloadType = this.root.lookupEnum('ProtoOAPayloadType')
      this.ProtoMessage = this.root.lookupType('ProtoMessage')
      this.ProtoOAApplicationAuthReq = this.root.lookupType('ProtoOAApplicationAuthReq')
      this.ProtoOAApplicationAuthRes = this.root.lookupType('ProtoOAApplicationAuthRes')
      this.ProtoOAAccountAuthReq = this.root.lookupType('ProtoOAAccountAuthReq')
      this.ProtoOAAccountAuthRes = this.root.lookupType('ProtoOAAccountAuthRes')
      this.ProtoOAVersionReq = this.root.lookupType('ProtoOAVersionReq')
      this.ProtoOAVersionRes = this.root.lookupType('ProtoOAVersionRes')
      this.ProtoOAExecutionEvent = this.root.lookupType('ProtoOAExecutionEvent')
      this.ProtoOASpotEvent = this.root.lookupType('ProtoOASpotEvent')
      this.ProtoHeartbeatEvent = this.root.lookupType('ProtoHeartbeatEvent')
      this.ProtoErrorRes = this.root.lookupType('ProtoErrorRes')
      this.ProtoOAErrorRes = this.root.lookupType('ProtoOAErrorRes')
      this.ProtoOANewOrderReq = this.root.lookupType('ProtoOANewOrderReq')
      this.ProtoOAClosePositionReq = this.root.lookupType('ProtoOAClosePositionReq')
      this.ProtoOAReconcileReq = this.root.lookupType('ProtoOAReconcileReq')
      this.ProtoOAReconcileRes = this.root.lookupType('ProtoOAReconcileRes')

      logger.info('Protobuf messages initialized successfully')
    } catch (error) {
      logger.error({ error }, 'Failed to initialize protobuf messages')
      throw new Error('Protobuf initialization failed')
    }
  }

  createApplicationAuthRequest(clientId: string, clientSecret: string): Buffer {
    const payload = this.ProtoOAApplicationAuthReq.create({
      clientId,
      clientSecret,
    })

    const payloadBytes = this.ProtoOAApplicationAuthReq.encode(payload).finish()

    const message = this.ProtoMessage.create({
      payloadType: this.ProtoOAPayloadType.values.PROTO_OA_APPLICATION_AUTH_REQ,
      payload: payloadBytes,
    })

    const messageBytes = this.ProtoMessage.encode(message).finish()
    
    const lengthBuffer = Buffer.allocUnsafe(4)
    lengthBuffer.writeUInt32BE(messageBytes.length, 0)
    
    return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)])
  }

  createAccountAuthRequest(accessToken: string, ctidTraderAccountId: string): Buffer {
    const payload = this.ProtoOAAccountAuthReq.create({
      accessToken,
      ctidTraderAccountId,
    })

    const payloadBytes = this.ProtoOAAccountAuthReq.encode(payload).finish()

    const message = this.ProtoMessage.create({
      payloadType: this.ProtoOAPayloadType.values.PROTO_OA_ACCOUNT_AUTH_REQ,
      payload: payloadBytes,
    })

    const messageBytes = this.ProtoMessage.encode(message).finish()
    
    const lengthBuffer = Buffer.allocUnsafe(4)
    lengthBuffer.writeUInt32BE(messageBytes.length, 0)
    
    return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)])
  }

  createVersionRequest(): Buffer {
    const payload = this.ProtoOAVersionReq.create({})
    const payloadBytes = this.ProtoOAVersionReq.encode(payload).finish()

    const message = this.ProtoMessage.create({
      payloadType: this.ProtoOAPayloadType.values.PROTO_OA_VERSION_REQ,
      payload: payloadBytes,
    })

    const messageBytes = this.ProtoMessage.encode(message).finish()
    
    const lengthBuffer = Buffer.allocUnsafe(4)
    lengthBuffer.writeUInt32BE(messageBytes.length, 0)
    
    return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)])
  }

  createHeartbeatEvent(): Buffer {
    const payload = this.ProtoHeartbeatEvent.create({})
    const payloadBytes = this.ProtoHeartbeatEvent.encode(payload).finish()

    const message = this.ProtoMessage.create({
      payloadType: this.ProtoPayloadType.values.HEARTBEAT_EVENT,
      payload: payloadBytes,
    })

    const messageBytes = this.ProtoMessage.encode(message).finish()
    
    const lengthBuffer = Buffer.allocUnsafe(4)
    lengthBuffer.writeUInt32BE(messageBytes.length, 0)
    
    return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)])
  }

  createReconcileRequest(ctidTraderAccountId: string): Buffer {
    const payload = this.ProtoOAReconcileReq.create({
      ctidTraderAccountId,
    })

    const payloadBytes = this.ProtoOAReconcileReq.encode(payload).finish()

    const message = this.ProtoMessage.create({
      payloadType: this.ProtoOAPayloadType.values.PROTO_OA_RECONCILE_REQ,
      payload: payloadBytes,
    })

    const messageBytes = this.ProtoMessage.encode(message).finish()
    
    const lengthBuffer = Buffer.allocUnsafe(4)
    lengthBuffer.writeUInt32BE(messageBytes.length, 0)
    
    return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)])
  }

  createNewOrderRequest(
    ctidTraderAccountId: string,
    symbolId: number,
    orderType: number,
    tradeSide: number,
    volume: number,
    stopLoss?: number,
    takeProfit?: number,
    comment?: string
  ): Buffer {
    const payload = this.ProtoOANewOrderReq.create({
      ctidTraderAccountId,
      symbolId,
      orderType,
      tradeSide,
      volume,
      stopLoss,
      takeProfit,
      comment,
    })

    const payloadBytes = this.ProtoOANewOrderReq.encode(payload).finish()

    const message = this.ProtoMessage.create({
      payloadType: this.ProtoOAPayloadType.values.PROTO_OA_NEW_ORDER_REQ,
      payload: payloadBytes,
    })

    const messageBytes = this.ProtoMessage.encode(message).finish()
    
    const lengthBuffer = Buffer.allocUnsafe(4)
    lengthBuffer.writeUInt32BE(messageBytes.length, 0)
    
    return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)])
  }

  createClosePositionRequest(
    ctidTraderAccountId: string,
    positionId: string,
    volume: number
  ): Buffer {
    const payload = this.ProtoOAClosePositionReq.create({
      ctidTraderAccountId,
      positionId,
      volume,
    })

    const payloadBytes = this.ProtoOAClosePositionReq.encode(payload).finish()

    const message = this.ProtoMessage.create({
      payloadType: this.ProtoOAPayloadType.values.PROTO_OA_CLOSE_POSITION_REQ,
      payload: payloadBytes,
    })

    const messageBytes = this.ProtoMessage.encode(message).finish()
    
    const lengthBuffer = Buffer.allocUnsafe(4)
    lengthBuffer.writeUInt32BE(messageBytes.length, 0)
    
    return Buffer.concat([lengthBuffer, Buffer.from(messageBytes)])
  }

  decodeMessage(data: Buffer): { type: string; payload: any } | null {
    try {
      const messageBytes = data.length > 4 ? data.slice(4) : data

      const message = this.ProtoMessage.decode(messageBytes)
      const payloadTypeName = this.getPayloadTypeName(message.payloadType)

      if (!payloadTypeName) {
        logger.warn({ payloadType: message.payloadType }, 'Unknown payload type')
        return null
      }

      let decodedPayload: any = null

      switch (payloadTypeName) {
        case 'PROTO_OA_APPLICATION_AUTH_RES':
          decodedPayload = this.ProtoOAApplicationAuthRes.decode(message.payload)
          break
        case 'PROTO_OA_ACCOUNT_AUTH_RES':
          decodedPayload = this.ProtoOAAccountAuthRes.decode(message.payload)
          break
        case 'PROTO_OA_VERSION_RES':
          decodedPayload = this.ProtoOAVersionRes.decode(message.payload)
          break
        case 'PROTO_OA_EXECUTION_EVENT':
          decodedPayload = this.ProtoOAExecutionEvent.decode(message.payload)
          break
        case 'PROTO_OA_SPOT_EVENT':
          decodedPayload = this.ProtoOASpotEvent.decode(message.payload)
          break
        case 'HEARTBEAT_EVENT':
          decodedPayload = this.ProtoHeartbeatEvent.decode(message.payload)
          break
        case 'ERROR_RES':
          decodedPayload = this.ProtoErrorRes.decode(message.payload)
          break
        case 'PROTO_OA_ERROR_RES':
          decodedPayload = this.ProtoOAErrorRes.decode(message.payload)
          break
        case 'PROTO_OA_RECONCILE_RES':
          decodedPayload = this.ProtoOAReconcileRes.decode(message.payload)
          break
        default:
          logger.debug({ payloadTypeName }, 'Unhandled message type')
          return { type: payloadTypeName, payload: message.payload }
      }

      return {
        type: payloadTypeName,
        payload: decodedPayload ? decodedPayload.toJSON() : null,
      }
    } catch (error) {
      logger.error({ error }, 'Failed to decode message')
      return null
    }
  }

  private getPayloadTypeName(payloadType: number): string | null {
    // Check ProtoOAPayloadType first
    let entry = Object.entries(this.ProtoOAPayloadType.values).find(
      ([_, value]) => value === payloadType
    )
    
    if (entry) return entry[0]
    
    // Then check ProtoPayloadType
    entry = Object.entries(this.ProtoPayloadType.values).find(
      ([_, value]) => value === payloadType
    )
    
    return entry ? entry[0] : null
  }

  extractAccountInfo(reconcileRes: any): CTraderAccount | null {
    try {
      if (!reconcileRes.trader) {
        return null
      }

      const trader = reconcileRes.trader
      
      return {
        accountId: trader.ctidTraderAccountId?.toString() || '',
        balance: trader.balance / 100,
        equity: trader.balance / 100,
        margin: 0,
        freeMargin: trader.balance / 100,
        marginLevel: 0,
        currency: 'USD',
        leverage: trader.leverageInCents ? trader.leverageInCents / 100 : 100,
        broker: 'ctrader',
        environment: trader.isLive ? 'live' : 'demo',
      }
    } catch (error) {
      logger.error({ error }, 'Failed to extract account info')
      return null
    }
  }

  extractPositions(reconcileRes: any): Position[] {
    try {
      if (!reconcileRes.position || reconcileRes.position.length === 0) {
        return []
      }

      return reconcileRes.position.map((pos: any) => ({
        positionId: pos.positionId?.toString() || '',
        symbol: pos.tradeData?.symbolId?.toString() || '',
        volume: pos.tradeData?.volume || 0,
        entryPrice: pos.price / 100000,
        currentPrice: pos.price / 100000,
        profit: (pos.grossProfit || 0) / 100,
        swap: (pos.swap || 0) / 100,
        commission: (pos.commission || 0) / 100,
        side: pos.tradeData?.tradeSide === 1 ? 'buy' : 'sell',
        openTime: new Date(pos.tradeData?.openTimestamp || Date.now()),
        stopLoss: pos.stopLoss ? pos.stopLoss / 100000 : undefined,
        takeProfit: pos.takeProfit ? pos.takeProfit / 100000 : undefined,
      }))
    } catch (error) {
      logger.error({ error }, 'Failed to extract positions')
      return []
    }
  }
}
