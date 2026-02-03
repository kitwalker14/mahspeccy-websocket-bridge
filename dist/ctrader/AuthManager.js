"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = void 0;
const logger_1 = require("../logger");
class AuthManager {
    supabaseClient;
    credentials = new Map();
    constructor(supabaseClient) {
        this.supabaseClient = supabaseClient;
    }
    async getCredentials(userId) {
        const cached = this.credentials.get(userId);
        if (cached) {
            if (cached.tokenExpiresAt > new Date()) {
                return cached;
            }
            logger_1.logger.info({ userId }, 'Cached token expired, fetching fresh credentials');
        }
        const credentials = await this.supabaseClient.getUserCredentials(userId);
        if (!credentials) {
            return null;
        }
        if (credentials.tokenExpiresAt < new Date()) {
            logger_1.logger.info({ userId }, 'Token expired, refreshing');
            const refreshed = await this.supabaseClient.refreshAccessToken(credentials);
            if (!refreshed) {
                logger_1.logger.error({ userId }, 'Failed to refresh token');
                return null;
            }
            credentials.accessToken = refreshed.accessToken;
            credentials.refreshToken = refreshed.refreshToken;
            credentials.tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
        }
        this.credentials.set(userId, credentials);
        return credentials;
    }
    async validateToken(userId) {
        const credentials = await this.getCredentials(userId);
        return credentials !== null;
    }
    clearCache(userId) {
        this.credentials.delete(userId);
        logger_1.logger.debug({ userId }, 'Credentials cache cleared');
    }
    clearAllCache() {
        this.credentials.clear();
        logger_1.logger.debug('All credentials cache cleared');
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=AuthManager.js.map