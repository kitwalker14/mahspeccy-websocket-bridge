import { createClient, SupabaseClient as SupabaseClientType } from '@supabase/supabase-js'
import { config } from '../config'
import { logger } from '../logger'
import { UserCredentials } from '../types'

export class SupabaseClient {
  private client: SupabaseClientType

  constructor() {
    this.client = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    logger.info('Supabase client initialized')
  }

  async getUserCredentials(userId: string): Promise<UserCredentials | null> {
    try {
      const { data, error } = await this.client
        .from('ctrader_credentials')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          logger.warn({ userId }, 'No credentials found for user')
          return null
        }
        throw error
      }

      if (!data) {
        return null
      }

      return {
        userId: data.user_id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        clientId: data.client_id,
        clientSecret: data.client_secret,
        tokenExpiresAt: new Date(data.token_expires_at),
      }
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user credentials')
      throw new Error('Failed to retrieve credentials')
    }
  }

  async updateTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      const { error } = await this.client
        .from('ctrader_credentials')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      logger.info({ userId }, 'Tokens updated successfully')
    } catch (error) {
      logger.error({ error, userId }, 'Failed to update tokens')
      throw new Error('Failed to update tokens')
    }
  }

  async updateAccountInfo(userId: string, accountInfo: any): Promise<void> {
    try {
      const { error } = await this.client
        .from('ctrader_credentials')
        .update({
          account_info: JSON.stringify(accountInfo),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      logger.debug({ userId }, 'Account info updated')
    } catch (error) {
      logger.error({ error, userId }, 'Failed to update account info')
    }
  }

  async setConnectionStatus(userId: string, isConnected: boolean): Promise<void> {
    try {
      const { error } = await this.client
        .from('ctrader_credentials')
        .update({
          is_connected: isConnected,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      logger.info({ userId, isConnected }, 'Connection status updated')
    } catch (error) {
      logger.error({ error, userId }, 'Failed to update connection status')
    }
  }

  async refreshAccessToken(credentials: UserCredentials): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
    try {
      logger.info({ userId: credentials.userId }, 'Refreshing access token')

      const response = await fetch('https://openapi.ctrader.com/apps/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken || '',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ userId: credentials.userId, error: errorText }, 'Token refresh failed')
        return null
      }

      const data: any = await response.json()

      await this.updateTokens(
        credentials.userId,
        data.access_token as string,
        data.refresh_token as string,
        data.expires_in as number
      )

      return {
        accessToken: data.access_token as string,
        refreshToken: data.refresh_token as string,
        expiresIn: data.expires_in as number,
      }
    } catch (error) {
      logger.error({ error, userId: credentials.userId }, 'Failed to refresh token')
      return null
    }
  }

  async validateToken(userId: string): Promise<boolean> {
    try {
      const credentials = await this.getUserCredentials(userId)
      
      if (!credentials) {
        return false
      }

      if (credentials.tokenExpiresAt < new Date()) {
        logger.info({ userId }, 'Token expired, attempting refresh')
        const refreshed = await this.refreshAccessToken(credentials)
        return refreshed !== null
      }

      return true
    } catch (error) {
      logger.error({ error, userId }, 'Token validation failed')
      return false
    }
  }
}
