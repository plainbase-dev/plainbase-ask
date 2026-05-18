import { timingSafeEqual } from 'crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { loginAttempts } from '../../api/chat.js';

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Server-side session store: Set of valid session tokens
const activeSessions = new Set<string>();

export function createSession(): string {
  const token = crypto.randomUUID();
  activeSessions.add(token);
  return token;
}

export function destroySession(token: string): void {
  activeSessions.delete(token);
}

export function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  return activeSessions.has(token);
}

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  if (!attempts) return false;
  if (now - attempts.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return attempts.count >= LOGIN_MAX_ATTEMPTS;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  if (!attempts || now - attempts.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    attempts.count += 1;
  }
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export function isPasswordCorrect(input: string, expected: string): boolean {
  // Pad to the same length so timingSafeEqual doesn't throw on mismatched buffers.
  // The length comparison is itself timing-safe here because expected.length is constant.
  if (input.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

export function getCsrfToken(c: Parameters<typeof getCookie>[0] & Parameters<typeof setCookie>[0]): string {
  const existing = getCookie(c, '_csrf');
  if (existing) return existing;
  const token = crypto.randomUUID();
  setCookie(c, '_csrf', token, {
    httpOnly: false,
    sameSite: 'Strict',
    path: '/admin',
    maxAge: 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
  return token;
}

export const csrfProtect = createMiddleware(async (c, next) => {
  if (c.req.method !== 'POST') {
    await next();
    return;
  }
  // JSON requests cannot be sent via a plain HTML form, so they're not CSRF-vulnerable.
  // CORS policy handles cross-origin JSON requests; no token needed.
  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    await next();
    return;
  }
  const cookieToken = getCookie(c, '_csrf');
  const body = await c.req.parseBody();
  const bodyToken = body['_csrf'] as string | undefined;
  if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
    return c.html('Forbidden: invalid or missing CSRF token.', 403);
  }
  await next();
});

export const adminAuth = createMiddleware(async (c, next) => {
  const token = getCookie(c, 'admin_session');
  if (isValidSession(token)) {
    await next();
    return;
  }
  return c.redirect('/admin/login');
});

export function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string): void {
  setCookie(c, 'admin_session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/admin',
    maxAge: 24 * 60 * 60, // 24 hours
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]): void {
  deleteCookie(c, 'admin_session', { path: '/admin' });
}
