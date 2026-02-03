import WebSocket from 'ws'
import { createServer, Server as HttpServer } from 'http'
import { EventEmitter } from 'events'
import { config } from '../config'
import { logger } from '../logger'
import { SupabaseClient } from '../supabase/SupabaseClient'
import { AuthManager } from '../ctrader/AuthManager'
import { ProtoOAClient } from '../ctrader/ProtoOAClient'
import { MessageHandler } from '../ctrader/MessageHandler'
import { ClientMessage, ServerMessage, RateLimitEntry, ConnectionState } from '../types'

interface ClientConnection {
  ws: WebSocket
  userId: string
  ctraderClient: ProtoOAClient | null
  state: ConnectionState
  rateLimits: Map<string, RateLimitEntry>
  lastPing: Date
}

export class WebSocketServer extends EventEmitter {
  private httpServer: HttpServer
  private wss: WebSocket.Server
  private supabaseClient: SupabaseClient
  private authManager: AuthManager
  private messageHandler: MessageHandler
  private clients: Map<string, ClientConnection> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    
    this.httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'ok',
          clients: this.clients.size,
          timestamp: Date.now(),
        }))
        return
      }

      if (req.url === '/metrics') {
        const metrics = {
          totalConnections: this.clients.size,
          authenticatedConnections: Array.from(this.clients.values()).filter(
            c => c.state.isAuthenticated
          ).length,
          ctraderConnections: Array.from(this.clients.values()).filter(
            c => c.state.isConnectedToCTrader
          ).length,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(metrics))
        return
      }

      res.writeHead(404)
      res.end('Not Found')
    })

    this.wss = new WebSocket.Server({ 
      server: this.httpServer,
      maxPayload: 1024 * 1024,
      clientTracking: true,
    })

    this.supabaseClient = new SupabaseClient()
    this.authManager = new AuthManager(this.supabaseClient)
    this.messageHandler = new MessageHandler()

    this.setupWebSocketServer()
  }

  async initialize(): Promise<void> {
    await this.messageHandler.initialize()
    logger.info('WebSocket server initialized')
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId()
      logger.info({ clientId, ip: req.socket.remoteAddress }, 'New WebSocket connection')

      const connection: ClientConnection = {
        ws,
        userId: '',
        ctraderClient: null,
        state: {
          userId: '',
          isAuthenticated: false,
          isConnectedToCTrader: false,
          lastActivity: new Date(),
          reconnectAttempts: 0,
        },
        rateLimits: new Map(),
        lastPing: new Date(),
      }

      this.clients.set(clientId, connection)

      ws.on('message', (data: Buffer) => {
        this.handleClientMessage(clientId, data)
      })

      ws.on('pong', () => {
        connection.lastPing = new Date()
      })

      ws.on('close', (code: number, reason: Buffer) => {
        logger.info({ clientId, code, reason: reason.toString() }, 'Client disconnected')
        this.handleClientDisconnect(clientId)
      })

      ws.on('error', (error: Error) => {
        logger.error({ error, clientId }, 'WebSocket error')
        this.handleClientDisconnect(clientId)
      })

      this.sendToClient(clientId, {
        type: 'connected',
        payload: { clientId },
        timestamp: Date.now(),
      })
    })

    this.wss.on('error', (error: Error) => {
      logger.error({ error }, 'WebSocket Server error')
    })

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, 30000)
  }

  private async handleClientMessage(clientId: string, data: Buffer): Promise<void> {
    const connection = this.clients.get(clientId)
    if (!connection) return

    connection.state.lastActivity = new Date()

    try {
      const message: ClientMessage = JSON.parse(data.toString())

      if (!this.checkRateLimit(clientId, message.type)) {
        this.sendError(clientId, 'Rate limit exceeded')
        return
      }

      switch (message.type) {
        case 'authenticate':
          await this.handleAuthenticate(clientId, message.payload)
          break
        case 'connect':
          await this.handleConnect(clientId, message.payload)
          break
        case 'disconnect':
          this.handleDisconnect(clientId)
          break
        case 'subscribe':
          await this.handleSubscribe(clientId, message.payload)
          break
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message.payload)
          break
        case 'order':
          await this.handleOrder(clientId, message.payload)
          break
        case 'closePosition':
          await this.handleClosePosition(clientId, message.payload)
          break
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            payload: {},
            timestamp: Date.now(),
          })
          break
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`)
      }
    } catch (error) {
      logger.error({ error, clientId }, 'Error handling client message')
      this.sendError(clientId, 'Invalid message format')
    }
  }

  private async handleAuthenticate(clientId: string, payload: any): Promise<void> {
    const connection = this.clients.get(clientId)
    if (!connection) return

    try {
      const { userId, token } = payload

      if (!userId || !token) {
        this.sendError(clientId, 'Missing userId or token')
        return
      }

      const isValid = await this.authManager.validateToken(userId)
      
      if (!isValid) {
        this.sendError(clientId, 'Invalid or expired token')
        return
      }

      const userConnections = Array.from(this.clients.values()).filter(
        c => c.userId === userId && c.state.isAuthenticated
      )

      if (userConnections.length >= config.rateLimit.maxConnectionsPerUser) {
        this.sendError(clientId, 'Maximum connections per user exceeded')
        return
      }

      connection.userId = userId
      connection.state.userId = userId
      connection.state.isAuthenticated = true

      logger.info({ clientId, userId }, 'Client authenticated')

      this.sendToClient(clientId, {
        type: 'authenticated',
        payload: { userId },
        timestamp: Date.now(),
      })
    } catch (error) {
      logger.error({ error, clientId }, 'Authentication failed')
      this.sendError(clientId, 'Authentication failed')
    }
  }

  private async handleConnect(clientId: string, payload: any): Promise<void> {
    const connection = this.clients.get(clientId)
    if (!connection) return

    if (!connection.state.isAuthenticated) {
      this.sendError(clientId, 'Not authenticated')
      return
    }

    try {
      const { accountId } = payload

      if (!accountId) {
        this.sendError(clientId, 'Missing accountId')
        return
      }

      const credentials = await this.authManager.getCredentials(connection.userId)
      
      if (!credentials) {
        this.sendError(clientId, 'No credentials found')
        return
      }

      const ctraderClient = new ProtoOAClient(this.messageHandler, credentials, accountId)

      ctraderClient.on('connected', () => {
        logger.info({ clientId, userId: connection.userId }, 'cTrader client connected')
      })

      ctraderClient.on('authenticated', () => {
        logger.info({ clientId, userId: connection.userId }, 'cTrader client authenticated')
      })

      ctraderClient.on('accountAuthorized', (account) => {
        logger.info({ clientId, userId: connection.userId, accountId: account.accountId }, 'Account authorized')
        connection.state.isConnectedToCTrader = true
        connection.state.accountId = account.accountId

        this.supabaseClient.setConnectionStatus(connection.userId, true)
        this.supabaseClient.updateAccountInfo(connection.userId, account)

        this.sendToClient(clientId, {
          type: 'accountUpdate',
          payload: account,
          timestamp: Date.now(),
        })
      })

      ctraderClient.on('positionUpdate', (positions) => {
        this.sendToClient(clientId, {
          type: 'positionUpdate',
          payload: positions,
          timestamp: Date.now(),
        })
      })

      ctraderClient.on('executionEvent', (event) => {
        this.sendToClient(clientId, {
          type: 'executionEvent',
          payload: event,
          timestamp: Date.now(),
        })
      })

      ctraderClient.on('spotEvent', (event) => {
        this.sendToClient(clientId, {
          type: 'spotEvent',
          payload: event,
          timestamp: Date.now(),
        })
      })

      ctraderClient.on('error', (error) => {
        logger.error({ error, clientId, userId: connection.userId }, 'cTrader client error')
        this.sendError(clientId, error.message)
      })

      ctraderClient.on('disconnected', (code, reason) => {
        logger.warn({ clientId, userId: connection.userId, code, reason }, 'cTrader client disconnected')
        connection.state.isConnectedToCTrader = false
        this.supabaseClient.setConnectionStatus(connection.userId, false)

        this.sendToClient(clientId, {
          type: 'disconnected',
          payload: { code, reason },
          timestamp: Date.now(),
        })
      })

      connection.ctraderClient = ctraderClient
      await ctraderClient.connect()

      logger.info({ clientId, userId: connection.userId, accountId }, 'Connecting to cTrader')

    } catch (error) {
      logger.error({ error, clientId }, 'Failed to connect to cTrader')
      this.sendError(clientId, 'Failed to connect to cTrader')
    }
  }

  private handleDisconnect(clientId: string): void {
    const connection = this.clients.get(clientId)
    if (!connection) return

    if (connection.ctraderClient) {
      connection.ctraderClient.disconnect()
      connection.ctraderClient = null
      connection.state.isConnectedToCTrader = false

      if (connection.userId) {
        this.supabaseClient.setConnectionStatus(connection.userId, false)
      }

      logger.info({ clientId, userId: connection.userId }, 'Disconnected from cTrader')
    }
  }

  private async handleSubscribe(clientId: string, payload: any): Promise<void> {
    const connection = this.clients.get(clientId)
    if (!connection || !connection.ctraderClient?.isAuthenticated()) {
      this.sendError(clientId, 'Not connected to cTrader')
      return
    }
    logger.info({ clientId, payload }, 'Subscribe request')
  }

  private async handleUnsubscribe(clientId: string, payload: any): Promise<void> {
    const connection = this.clients.get(clientId)
    if (!connection || !connection.ctraderClient?.isAuthenticated()) {
      this.sendError(clientId, 'Not connected to cTrader')
      return
    }
    logger.info({ clientId, payload }, 'Unsubscribe request')
  }

  private async handleOrder(clientId: string, payload: any): Promise<void> {
    const connection = this.clients.get(clientId)
    if (!connection || !connection.ctraderClient?.isAuthenticated()) {
      this.sendError(clientId, 'Not connected to cTrader')
      return
    }

    try {
      const { symbolId, orderType, tradeSide, volume, stopLoss, takeProfit, comment } = payload

      if (!symbolId || !orderType || !tradeSide || !volume) {
        this.sendError(clientId, 'Missing required order parameters')
        return
      }

      connection.ctraderClient.sendOrder(
        symbolId,
        orderType,
        tradeSide,
        volume,
        stopLoss,
        takeProfit,
        comment
      )

      logger.info({ clientId, userId: connection.userId, payload }, 'Order sent')
    } catch (error) {
      logger.error({ error, clientId }, 'Failed to send order')
      this.sendError(clientId, 'Failed to send order')
    }
  }

  private async handleClosePosition(clientId: string, payload: any): Promise<void> {
    const connection = this.clients.get(clientId)
    if (!connection || !connection.ctraderClient?.isAuthenticated()) {
      this.sendError(clientId, 'Not connected to cTrader')
      return
    }

    try {
      const { positionId, volume } = payload

      if (!positionId || !volume) {
        this.sendError(clientId, 'Missing positionId or volume')
        return
      }

      connection.ctraderClient.closePosition(positionId, volume)

      logger.info({ clientId, userId: connection.userId, payload }, 'Close position sent')
    } catch (error) {
      logger.error({ error, clientId }, 'Failed to close position')
      this.sendError(clientId, 'Failed to close position')
    }
  }

  private handleClientDisconnect(clientId: string): void {
    const connection = this.clients.get(clientId)
    if (!connection) return

    if (connection.ctraderClient) {
      connection.ctraderClient.disconnect()
    }

    if (connection.userId) {
      this.supabaseClient.setConnectionStatus(connection.userId, false)
    }

    this.clients.delete(clientId)
    logger.info({ clientId, userId: connection.userId }, 'Client removed')
  }

  private sendToClient(clientId: string, message: ServerMessage): void {
    const connection = this.clients.get(clientId)
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      connection.ws.send(JSON.stringify(message))
    } catch (error) {
      logger.error({ error, clientId }, 'Failed to send message to client')
    }
  }

  private sendError(clientId: string, errorMessage: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      payload: { message: errorMessage },
      timestamp: Date.now(),
    })
  }

  private checkRateLimit(clientId: string, messageType: string): boolean {
    const connection = this.clients.get(clientId)
    if (!connection) return false

    const key = `${messageType}_${Date.now()}`
    const now = Date.now()

    for (const [k, entry] of connection.rateLimits.entries()) {
      if (entry.resetAt < now) {
        connection.rateLimits.delete(k)
      }
    }

    const messageCount = Array.from(connection.rateLimits.values()).filter(
      entry => entry.resetAt > now
    ).length

    if (messageCount >= config.rateLimit.messageRateLimit) {
      logger.warn({ clientId, messageType }, 'Rate limit exceeded')
      return false
    }

    connection.rateLimits.set(key, {
      count: 1,
      resetAt: now + config.rateLimit.rateLimitWindowMs,
    })

    return true
  }

  private performHealthCheck(): void {
    const now = Date.now()

    for (const [clientId, connection] of this.clients.entries()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.ping()

        const timeSinceLastPing = now - connection.lastPing.getTime()
        if (timeSinceLastPing > config.connection.pingTimeoutMs * 2) {
          logger.warn({ clientId }, 'Client not responding to pings, terminating')
          connection.ws.terminate()
          this.handleClientDisconnect(clientId)
        }
      } else {
        this.handleClientDisconnect(clientId)
      }
    }

    logger.debug({ activeClients: this.clients.size }, 'Health check completed')
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(config.server.port, () => {
        logger.info({ port: config.server.port }, 'WebSocket server started')
        resolve()
      })
    })
  }

  public async stop(): Promise<void> {
    logger.info('Stopping WebSocket server')

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    for (const [clientId, connection] of this.clients.entries()) {
      if (connection.ctraderClient) {
        connection.ctraderClient.disconnect()
      }
      connection.ws.close(1000, 'Server shutdown')
    }

    this.clients.clear()

    await new Promise<void>((resolve, reject) => {
      this.wss.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

    logger.info('WebSocket server stopped')
  }
}
