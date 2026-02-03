import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { config } from '../config'
import { logger } from '../logger'
import { MessageHandler } from './MessageHandler'
import { UserCredentials, CTraderAccount, Position } from '../types'

export interface ProtoOAClientEvents {
  connected: () => void
  authenticated: () => void
  accountAuthorized: (account: CTraderAccount) => void
  positionUpdate: (positions: Position[]) => void
  executionEvent: (event: any) => void
  spotEvent: (event: any) => void
  error: (error: Error) => void
  disconnected: (code: number, reason: string) => void
}

export declare interface ProtoOAClient {
  on<U extends keyof ProtoOAClientEvents>(
    event: U,
    listener: ProtoOAClientEvents[U]
  ): this
  emit<U extends keyof ProtoOAClientEvents>(
    event: U,
    ...args: Parameters<ProtoOAClientEvents[U]>
  ): boolean
}

export class ProtoOAClient extends EventEmitter {
  private ws: WebSocket | null = null
  private messageHandler: MessageHandler
  private credentials: UserCredentials
  private accountId: string | null = null
  private isApplicationAuthed = false
  private isAccountAuthed = false
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private pingTimer: NodeJS.Timeout | null = null
  private pingTimeout: NodeJS.Timeout | null = null
  private messageBuffer: Buffer = Buffer.allocUnsafe(0)
  private currentMessageLength: number | null = null

  constructor(messageHandler: MessageHandler, credentials: UserCredentials, accountId?: string) {
    super()
    this.messageHandler = messageHandler
    this.credentials = credentials
    this.accountId = accountId || null
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://${config.ctrader.apiHost}:${config.ctrader.apiPort}`
      logger.info({ url, userId: this.credentials.userId }, 'Connecting to cTrader API')

      this.ws = new WebSocket(url, {
        handshakeTimeout: 10000,
        perMessageDeflate: false,
      })

      this.ws.on('open', () => {
        logger.info({ userId: this.credentials.userId }, 'WebSocket connected')
        this.reconnectAttempts = 0
        this.emit('connected')
        this.startPing()
        this.sendVersionRequest()
        resolve()
      })

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data)
      })

      this.ws.on('error', (error: Error) => {
        logger.error({ error, userId: this.credentials.userId }, 'WebSocket error')
        this.emit('error', error)
        reject(error)
      })

      this.ws.on('close', (code: number, reason: Buffer) => {
        const reasonString = reason.toString()
        logger.warn({ code, reason: reasonString, userId: this.credentials.userId }, 'WebSocket closed')
        this.cleanup()
        this.emit('disconnected', code, reasonString)
        this.scheduleReconnect()
      })
    })
  }

  private handleMessage(data: Buffer): void {
    try {
      this.messageBuffer = Buffer.concat([this.messageBuffer, data])

      while (this.messageBuffer.length > 0) {
        if (this.currentMessageLength === null) {
          if (this.messageBuffer.length < 4) {
            break
          }
          this.currentMessageLength = this.messageBuffer.readUInt32BE(0)
        }

        const totalLength = 4 + this.currentMessageLength
        if (this.messageBuffer.length < totalLength) {
          break
        }

        const messageData = this.messageBuffer.slice(0, totalLength)
        this.messageBuffer = this.messageBuffer.slice(totalLength)
        this.currentMessageLength = null

        const decoded = this.messageHandler.decodeMessage(messageData)
        if (decoded) {
          this.processMessage(decoded.type, decoded.payload)
        }
      }
    } catch (error) {
      logger.error({ error, userId: this.credentials.userId }, 'Error handling message')
    }
  }

  private processMessage(type: string, payload: any): void {
    logger.debug({ type, userId: this.credentials.userId }, 'Processing message')

    switch (type) {
      case 'PROTO_OA_VERSION_RES':
        logger.info({ version: payload.version }, 'Version response received')
        this.sendApplicationAuth()
        break

      case 'PROTO_OA_APPLICATION_AUTH_RES':
        logger.info({ userId: this.credentials.userId }, 'Application authenticated')
        this.isApplicationAuthed = true
        this.emit('authenticated')
        if (this.accountId) {
          this.sendAccountAuth(this.accountId)
        }
        break

      case 'PROTO_OA_ACCOUNT_AUTH_RES':
        logger.info({ userId: this.credentials.userId, accountId: this.accountId }, 'Account authorized')
        this.isAccountAuthed = true
        this.requestReconcile()
        break

      case 'PROTO_OA_RECONCILE_RES':
        logger.info({ userId: this.credentials.userId }, 'Reconcile response received')
        const account = this.messageHandler.extractAccountInfo(payload)
        const positions = this.messageHandler.extractPositions(payload)
        
        if (account) {
          this.emit('accountAuthorized', account)
        }
        
        if (positions.length > 0) {
          this.emit('positionUpdate', positions)
        }
        break

      case 'PROTO_OA_EXECUTION_EVENT':
        logger.debug({ userId: this.credentials.userId }, 'Execution event received')
        this.emit('executionEvent', payload)
        break

      case 'PROTO_OA_SPOT_EVENT':
        this.emit('spotEvent', payload)
        break

      case 'PROTO_HEARTBEAT_EVENT':
        logger.debug({ userId: this.credentials.userId }, 'Heartbeat received')
        this.resetPingTimeout()
        break

      case 'PROTO_OA_ERROR_RES':
        logger.error({ error: payload, userId: this.credentials.userId }, 'Error response from cTrader')
        this.emit('error', new Error(payload.errorCode || 'Unknown error'))
        break

      default:
        logger.debug({ type, userId: this.credentials.userId }, 'Unhandled message type')
    }
  }

  private sendVersionRequest(): void {
    const message = this.messageHandler.createVersionRequest()
    this.send(message)
  }

  private sendApplicationAuth(): void {
    const message = this.messageHandler.createApplicationAuthRequest(
      this.credentials.clientId,
      this.credentials.clientSecret
    )
    this.send(message)
  }

  private sendAccountAuth(accountId: string): void {
    const message = this.messageHandler.createAccountAuthRequest(
      this.credentials.accessToken,
      accountId
    )
    this.send(message)
  }

  private requestReconcile(): void {
    if (!this.accountId) {
      logger.warn({ userId: this.credentials.userId }, 'Cannot request reconcile without account ID')
      return
    }

    const message = this.messageHandler.createReconcileRequest(this.accountId)
    this.send(message)
  }

  private send(data: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn({ userId: this.credentials.userId }, 'Cannot send message: WebSocket not open')
      return
    }

    this.ws.send(data, (error) => {
      if (error) {
        logger.error({ error, userId: this.credentials.userId }, 'Failed to send message')
      }
    })
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = this.messageHandler.createHeartbeatEvent()
        this.send(heartbeat)
        this.setPingTimeout()
      }
    }, config.connection.pingIntervalMs)
  }

  private setPingTimeout(): void {
    this.clearPingTimeout()
    this.pingTimeout = setTimeout(() => {
      logger.warn({ userId: this.credentials.userId }, 'Ping timeout - closing connection')
      this.ws?.close(1000, 'Ping timeout')
    }, config.connection.pingTimeoutMs)
  }

  private resetPingTimeout(): void {
    this.clearPingTimeout()
  }

  private clearPingTimeout(): void {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
      this.pingTimeout = null
    }
  }

  private cleanup(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.clearPingTimeout()
    this.isApplicationAuthed = false
    this.isAccountAuthed = false
    this.messageBuffer = Buffer.allocUnsafe(0)
    this.currentMessageLength = null
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= config.connection.maxReconnectAttempts) {
      logger.error({ userId: this.credentials.userId }, 'Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = config.connection.reconnectIntervalMs * this.reconnectAttempts

    logger.info(
      { userId: this.credentials.userId, attempt: this.reconnectAttempts, delay },
      'Scheduling reconnect'
    )

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error({ error, userId: this.credentials.userId }, 'Reconnect failed')
      })
    }, delay)
  }

  public authorizeAccount(accountId: string): void {
    this.accountId = accountId
    if (this.isApplicationAuthed) {
      this.sendAccountAuth(accountId)
    }
  }

  public sendOrder(
    symbolId: number,
    orderType: number,
    tradeSide: number,
    volume: number,
    stopLoss?: number,
    takeProfit?: number,
    comment?: string
  ): void {
    if (!this.isAccountAuthed || !this.accountId) {
      throw new Error('Account not authorized')
    }

    const message = this.messageHandler.createNewOrderRequest(
      this.accountId,
      symbolId,
      orderType,
      tradeSide,
      volume,
      stopLoss,
      takeProfit,
      comment
    )
    this.send(message)
  }

  public closePosition(positionId: string, volume: number): void {
    if (!this.isAccountAuthed || !this.accountId) {
      throw new Error('Account not authorized')
    }

    const message = this.messageHandler.createClosePositionRequest(
      this.accountId,
      positionId,
      volume
    )
    this.send(message)
  }

  public disconnect(): void {
    logger.info({ userId: this.credentials.userId }, 'Disconnecting client')
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.reconnectAttempts = config.connection.maxReconnectAttempts

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.cleanup()
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  public isAuthenticated(): boolean {
    return this.isApplicationAuthed && this.isAccountAuthed
  }
}
