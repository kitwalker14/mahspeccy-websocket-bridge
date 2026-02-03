"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseClient = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
const logger_1 = require("../logger");
class SupabaseClient {
    client;
    constructor() {
        this.client = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
        logger_1.logger.info('Supabase client initialized');
    }
    async getUserCredentials(userId) {
        try {
            const { data, error } = await this.client
                .from('ctrader_credentials')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    logger_1.logger.warn({ userId }, 'No credentials found for user');
                    return null;
                }
                throw error;
            }
            if (!data) {
                return null;
            }
            return {
                userId: data.user_id,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                clientId: data.client_id,
                clientSecret: data.client_secret,
                tokenExpiresAt: new Date(data.token_expires_at),
            };
        }
        catch (error) {
            logger_1.logger.error({ error, userId }, 'Failed to get user credentials');
            throw new Error('Failed to retrieve credentials');
        }
    }
    async updateTokens(userId, accessToken, refreshToken, expiresIn) {
        try {
            const expiresAt = new Date(Date.now() + expiresIn * 1000);
            const { error } = await this.client
                .from('ctrader_credentials')
                .update({
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('user_id', userId);
            if (error) {
                throw error;
            }
            logger_1.logger.info({ userId }, 'Tokens updated successfully');
        }
        catch (error) {
            logger_1.logger.error({ error, userId }, 'Failed to update tokens');
            throw new Error('Failed to update tokens');
        }
    }
    async updateAccountInfo(userId, accountInfo) {
        try {
            const { error } = await this.client
                .from('ctrader_credentials')
                .update({
                account_info: JSON.stringify(accountInfo),
                updated_at: new Date().toISOString(),
            })
                .eq('user_id', userId);
            if (error) {
                throw error;
            }
            logger_1.logger.debug({ userId }, 'Account info updated');
        }
        catch (error) {
            logger_1.logger.error({ error, userId }, 'Failed to update account info');
        }
    }
    async setConnectionStatus(userId, isConnected) {
        try {
            const { error } = await this.client
                .from('ctrader_credentials')
                .update({
                is_connected: isConnected,
                updated_at: new Date().toISOString(),
            })
                .eq('user_id', userId);
            if (error) {
                throw error;
            }
            logger_1.logger.info({ userId, isConnected }, 'Connection status updated');
        }
        catch (error) {
            logger_1.logger.error({ error, userId }, 'Failed to update connection status');
        }
    }
    async refreshAccessToken(credentials) {
        try {
            logger_1.logger.info({ userId: credentials.userId }, 'Refreshing access token');
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
            });
            if (!response.ok) {
                const errorText = await response.text();
                logger_1.logger.error({ userId: credentials.userId, error: errorText }, 'Token refresh failed');
                return null;
            }
            const data = await response.json();
            await this.updateTokens(credentials.userId, data.access_token, data.refresh_token, data.expires_in);
            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
            };
        }
        catch (error) {
            logger_1.logger.error({ error, userId: credentials.userId }, 'Failed to refresh token');
            return null;
        }
    }
    async validateToken(userId) {
        try {
            const credentials = await this.getUserCredentials(userId);
            if (!credentials) {
                return false;
            }
            if (credentials.tokenExpiresAt < new Date()) {
                logger_1.logger.info({ userId }, 'Token expired, attempting refresh');
                const refreshed = await this.refreshAccessToken(credentials);
                return refreshed !== null;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error({ error, userId }, 'Token validation failed');
            return false;
        }
    }
}
exports.SupabaseClient = SupabaseClient;
//# sourceMappingURL=SupabaseClient.js.map