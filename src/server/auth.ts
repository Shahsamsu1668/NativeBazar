import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { pool } from './neonDb.js';

export const SESSION_COOKIE_NAME = 'nb_session';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE_MS,
  path: '/',
};

// ─── PASSWORD HASHING & MIGRATION ─────────────────────────────────────────────

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export function hashPasswordSync(plainText: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

// Computes legacy DJB2 hash used previously in client store
export function computeLegacyDJB2Hash(plainText: string, salt = 'nb_secure_salt_2026'): string {
  let hash = 5381;
  const combined = `${salt}:${plainText}`;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256_${hex}_${plainText.length}`;
}

// Computes legacy HMAC-SHA256 hash used in SQLite
export function computeLegacyHmacSha256(plainText: string, salt = 'nb_secure_salt_2026'): string {
  const hmac = crypto.createHmac('sha256', salt).update(plainText).digest('hex');
  return `sha256_${hmac}`;
}

function safeTimingCompare(a?: string, b?: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies password against stored hash.
 * Returns { valid: boolean, needsRehash: boolean }
 * If needsRehash is true, the caller should update stored password with modern bcrypt hash.
 */
export async function verifyPassword(
  plainText: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedHash || !plainText) {
    return { valid: false, needsRehash: false };
  }

  // 1. Check if stored hash is bcrypt ($2a$, $2b$, or $2y$)
  if (storedHash.startsWith('$2')) {
    const valid = await bcrypt.compare(plainText, storedHash);
    return { valid, needsRehash: false };
  }

  // 2. Check legacy HMAC-SHA256 hash
  const hmacCandidate = computeLegacyHmacSha256(plainText);
  if (safeTimingCompare(storedHash, hmacCandidate)) {
    return { valid: true, needsRehash: true };
  }

  // 3. Check legacy DJB2 hash
  const djb2Candidate = computeLegacyDJB2Hash(plainText);
  if (safeTimingCompare(storedHash, djb2Candidate)) {
    return { valid: true, needsRehash: true };
  }

  // 4. Plaintext demo fallback (for initial legacy accounts before any hashing)
  if (safeTimingCompare(storedHash, plainText)) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}

// ─── SESSION TOKEN & HASHING ───────────────────────────────────────────────────

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  role: string,
  req: Request
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const sessionId = `sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown Client';

  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, role, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, userId, tokenHash, role, ipAddress, userAgent, expiresAt]
  );

  return { rawToken, expiresAt };
}

export async function revokeSessionByToken(rawToken: string): Promise<void> {
  const tokenHash = hashSessionToken(rawToken);
  await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1`,
    [tokenHash]
  );
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

// ─── AUTHENTICATION MIDDLEWARES ───────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  role: string;
  name: string;
  nameBn?: string;
  phone: string;
  email?: string;
  district: string;
  upazila?: string;
  verified: boolean;
  businessName?: string;
  businessType?: string;
  shopName?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionId?: string;
}

export async function validateToken(
  rawToken: string
): Promise<{ user: AuthenticatedUser; sessionId: string } | null> {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashSessionToken(rawToken);
  const result = await pool.query(
    `SELECT s.id as session_id, s.user_id, s.role as session_role,
            u.id, u.role, u.name, u.name_bn as "nameBn", u.phone, u.email,
            u.district, u.upazila, u.verified,
            u.business_name as "businessName", u.business_type as "businessType",
            u.shop_name as "shopName"
     FROM sessions s
     LEFT JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  if (!row.id && row.session_role === 'admin') {
    return {
      sessionId: row.session_id,
      user: {
        id: row.user_id || 'admin-root',
        role: 'admin',
        name: 'Central Platform Administrator',
        nameBn: 'কেন্দ্রীয় প্ল্যাটফর্ম প্রশাসক',
        phone: '01700000000',
        email: 'admin@nativebazar.gov.bd',
        district: 'Bogura',
        upazila: 'Bogura Sadar',
        verified: true,
      },
    };
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.id || row.user_id,
      role: row.role || row.session_role,
      name: row.name || 'User',
      nameBn: row.nameBn,
      phone: row.phone || '',
      email: row.email,
      district: row.district || 'Bogura',
      upazila: row.upazila,
      verified: Boolean(row.verified),
      businessName: row.businessName,
      businessType: row.businessType,
      shopName: row.shopName,
    },
  };
}

export function extractToken(req: Request): string | null {
  // 1. Try HttpOnly cookie
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }
  // 2. Try Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Middleware: Strictly requires authenticated session.
 * Rejects with 401 if missing or invalid.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = extractToken(req);
    if (!rawToken) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in.',
      });
      return;
    }

    const sessionData = await validateToken(rawToken);
    if (!sessionData) {
      const { maxAge: _unused, ...clearOptions } = SESSION_COOKIE_OPTIONS;
      res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
      res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        message: 'Your session has expired or was revoked. Please sign in again.',
      });
      return;
    }

    req.user = sessionData.user;
    req.sessionId = sessionData.sessionId;
    next();
  } catch (err: any) {
    console.error('requireAuth middleware error:', err);
    res.status(500).json({ success: false, error: 'Authentication verification error' });
  }
}

/**
 * Middleware: Populates req.user if valid session exists, but doesn't block unauthenticated.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = extractToken(req);
    if (rawToken) {
      const sessionData = await validateToken(rawToken);
      if (sessionData) {
        req.user = sessionData.user;
        req.sessionId = sessionData.sessionId;
      }
    }
    next();
  } catch {
    next();
  }
}
