import { SupabaseClient } from '../supabase/SupabaseClient';
import { UserCredentials } from '../types';
export declare class AuthManager {
    private supabaseClient;
    private credentials;
    constructor(supabaseClient: SupabaseClient);
    getCredentials(userId: string): Promise<UserCredentials | null>;
    validateToken(userId: string): Promise<boolean>;
    clearCache(userId: string): void;
    clearAllCache(): void;
}
