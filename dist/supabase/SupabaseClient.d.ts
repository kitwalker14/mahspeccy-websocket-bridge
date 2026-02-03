import { UserCredentials } from '../types';
export declare class SupabaseClient {
    private client;
    constructor();
    getUserCredentials(userId: string): Promise<UserCredentials | null>;
    updateTokens(userId: string, accessToken: string, refreshToken: string, expiresIn: number): Promise<void>;
    updateAccountInfo(userId: string, accountInfo: any): Promise<void>;
    setConnectionStatus(userId: string, isConnected: boolean): Promise<void>;
    refreshAccessToken(credentials: UserCredentials): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    } | null>;
    validateToken(userId: string): Promise<boolean>;
}
