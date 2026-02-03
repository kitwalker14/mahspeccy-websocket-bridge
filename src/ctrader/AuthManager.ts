import { SupabaseClient } from '../supabase/SupabaseClient'
import { UserCredentials } from '../types'
import { logger } from '../logger'

export class AuthManager {
  private supabaseClient: SupabaseClient
  private credentials: Map<string, UserCredentials> = new Map()

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient
  }

  async getCredentials(userId: string): Promise<UserCredentials | null> {
    const cached = this.credentials.get(userId)
    if (cached) {
      if (cached.tokenExpiresAt > new Date()) {
        return cached
      }
      logger.info({ userId }, 'Cached token expired, fetching fresh credentials')
    }

    const credentials = await this.supabaseClient.getUserCredentials(userId)
    
    if (!credentials) {
      return null
    }

    if (credentials.tokenExpiresAt < new Date()) {
      logger.info({ userId }, 'Token expired, refreshing')
      const refreshed = await this.supabaseClient.refreshAccessToken(credentials)
      
      if (!refreshed) {
        logger.error({ userId }, 'Failed to refresh token')
        return null
      }

      credentials.accessToken = refreshed.accessToken
      credentials.refreshToken = refreshed.refreshToken
      credentials.tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000)
    }

    this.credentials.set(userId, credentials)
    return credentials
  }

  async validateToken(userId: string): Promise<boolean> {
    const credentials = await this.getCredentials(userId)
    return credentials !== null
  }

  clearCache(userId: string): void {
    this.credentials.delete(userId)
    logger.debug({ userId }, 'Credentials cache cleared')
  }

  clearAllCache(): void {
    this.credentials.clear()
    logger.debug('All credentials cache cleared')
  }
}
