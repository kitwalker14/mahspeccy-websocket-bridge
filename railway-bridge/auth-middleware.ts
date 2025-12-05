/**
 * Authentication Middleware
 * Handles session token creation and validation
 */

import type { CTraderConfig } from './ctrader/types.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SessionData {
  userId: string;
  credentials: CTraderConfig;
  createdAt: number;
  expiresAt: number;
}

/**
 * Create encrypted session token
 */
export async function createSessionToken(data: { 
  userId: string; 
  credentials: CTraderConfig;
}): Promise<string> {
  const sessionData: SessionData = {
    userId: data.userId,
    credentials: data.credentials,
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  };
  
  // Encode as base64 (in production, use proper encryption)
  const jsonString = JSON.stringify(sessionData);
  const encoded = encoder.encode(jsonString);
  const base64 = btoa(String.fromCharCode(...encoded));
  
  return base64;
}

/**
 * Validate and decrypt session token
 */
export async function validateSessionToken(token: string): Promise<SessionData | null> {
  try {
    // Decode from base64 (in production, use proper decryption)
    const decoded = atob(token);
    const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
    const jsonString = decoder.decode(bytes);
    const sessionData: SessionData = JSON.parse(jsonString);
    
    // Check expiration
    if (sessionData.expiresAt < Date.now()) {
      console.log(`❌ Session token expired for user: ${sessionData.userId}`);
      return null;
    }
    
    // Validate required fields
    if (!sessionData.userId || !sessionData.credentials) {
      console.log(`❌ Invalid session data structure`);
      return null;
    }
    
    return sessionData;
    
  } catch (error) {
    console.error(`❌ Failed to validate session token:`, error);
    return null;
  }
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || userLimit.resetAt < now) {
    // Reset window
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }
  
  if (userLimit.count >= maxRequests) {
    console.log(`⚠️ Rate limit exceeded for user: ${userId}`);
    return false;
  }
  
  userLimit.count++;
  return true;
}
