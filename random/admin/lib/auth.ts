import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const cookieName = 'random_admin_session';
const lifetimeMs = 8 * 60 * 60 * 1000;

function config(): { username: string; salt: string; hash: string; secret: string } | null {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_SCRYPT;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!username || !passwordHash || !secret || secret.length < 32) return null;
  const [salt, hash] = passwordHash.split(':');
  if (!salt || !/^[a-f0-9]{64}$/i.test(hash || '')) return null;
  return { username, salt, hash, secret };
}

function equals(a: string | Buffer, b: string | Buffer): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function checkPassword(username: string, password: string): boolean {
  const settings = config();
  if (!settings || username !== settings.username || typeof password !== 'string') return false;
  return equals(scryptSync(password, settings.salt, 32), Buffer.from(settings.hash, 'hex'));
}

export async function createSession(): Promise<void> {
  const settings = config();
  if (!settings) throw new Error('后台账号未配置');
  const payload = Buffer.from(JSON.stringify({ user: settings.username, expires: Date.now() + lifetimeMs })).toString('base64url');
  const signature = createHmac('sha256', settings.secret).update(payload).digest('base64url');
  (await cookies()).set(cookieName, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.ADMIN_SECURE_COOKIE === 'true',
    path: '/',
    maxAge: lifetimeMs / 1000,
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const settings = config();
  const token = (await cookies()).get(cookieName)?.value;
  if (!settings || !token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = createHmac('sha256', settings.secret).update(payload).digest('base64url');
  if (!equals(signature, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.user === settings.username && Number.isSafeInteger(session.expires) && session.expires > Date.now();
  } catch {
    return false;
  }
}

export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect('/login');
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(cookieName);
}
