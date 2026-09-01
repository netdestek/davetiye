import { env } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { ensureDatabase } from '@/lib/d1';

export const AUTH_SESSION_COOKIE_NAME = '__Host-davetly_session';
export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const GOOGLE_PROVIDER = 'google';
const GOOGLE_CERTS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const GOOGLE_ATTEMPT_TTL_SECONDS = 10 * 60;
const MAX_ACTIVE_SESSIONS_PER_USER = 10;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
};

export type VerifiedGoogleIdentity = {
  subject: string;
  email: string;
  displayName: string;
  nonce: string;
  emailIsGoogleAuthoritative: boolean;
};

export class AuthenticationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

let googleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function configuredGoogleClientId() {
  const runtimeEnv = env as typeof env & { GOOGLE_CLIENT_ID?: string };
  return runtimeEnv.GOOGLE_CLIENT_ID?.trim() ?? '';
}

function getGoogleJwks() {
  googleJwks ??= createRemoteJWKSet(GOOGLE_CERTS_URL, {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
  });
  return googleJwks;
}

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanDisplayName(value: unknown, email: string) {
  if (typeof value !== 'string') return email.split('@')[0] ?? email;
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 120);
  return name || email.split('@')[0] || email;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function createOpaqueToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function hashOpaqueToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function cookieValues(header: string | null, name: string) {
  if (!header) return [];
  const values: string[] = [];
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    values.push(part.slice(separator + 1).trim());
  }
  return values;
}

async function requestSessionToken(request?: Request) {
  if (request) {
    const values = cookieValues(
      request.headers.get('cookie'),
      AUTH_SESSION_COOKIE_NAME,
    );
    return values.length === 1 && SESSION_TOKEN_PATTERN.test(values[0])
      ? values[0]
      : '';
  }

  const token = (await cookies()).get(AUTH_SESSION_COOKIE_NAME)?.value ?? '';
  return SESSION_TOKEN_PATTERN.test(token) ? token : '';
}

export function sessionCookie(
  value: string,
  maxAge = AUTH_SESSION_MAX_AGE_SECONDS,
) {
  return {
    name: AUTH_SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function googleCsrfCookieName(state: string) {
  return `__Host-davetly_google_csrf_${state}`;
}

export function googleStateCookieName(state: string) {
  return `__Host-davetly_google_state_${state}`;
}

export function googleCsrfCookie(
  state: string,
  value: string,
  maxAge = GOOGLE_ATTEMPT_TTL_SECONDS,
) {
  return {
    name: googleCsrfCookieName(state),
    value,
    httpOnly: false,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function googleStateCookie(
  state: string,
  value: string,
  maxAge = GOOGLE_ATTEMPT_TTL_SECONDS,
) {
  return {
    name: googleStateCookieName(state),
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function verifyGoogleCredential(
  credential: string,
): Promise<VerifiedGoogleIdentity> {
  const clientId = configuredGoogleClientId();
  if (!clientId) {
    throw new AuthenticationError(
      'google_not_configured',
      503,
      'Google ile giriş henüz yapılandırılmadı.',
    );
  }
  if (credential.length < 100 || credential.length > 8_192) {
    throw new AuthenticationError(
      'invalid_google_token',
      401,
      'Google kimliği doğrulanamadı.',
    );
  }

  try {
    const { payload } = await jwtVerify(credential, getGoogleJwks(), {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      clockTolerance: 5,
    });

    const subject = typeof payload.sub === 'string' ? payload.sub : '';
    const email =
      typeof payload.email === 'string' ? normalizeEmail(payload.email) : '';
    const nonce = typeof payload.nonce === 'string' ? payload.nonce : '';
    const authorizedParty = typeof payload.azp === 'string' ? payload.azp : '';
    if (
      !subject ||
      subject.length > 255 ||
      !/^[A-Za-z0-9_-]+$/.test(subject) ||
      !isValidEmail(email) ||
      payload.email_verified !== true ||
      !SESSION_TOKEN_PATTERN.test(nonce) ||
      (authorizedParty && authorizedParty !== clientId)
    ) {
      throw new AuthenticationError(
        'invalid_google_claims',
        401,
        'Google kimliği doğrulanamadı.',
      );
    }

    const emailDomain = email.slice(email.lastIndexOf('@') + 1);
    const hostedDomain =
      typeof payload.hd === 'string'
        ? payload.hd.trim().toLocaleLowerCase('en-US')
        : '';
    return {
      subject,
      email,
      displayName: cleanDisplayName(payload.name, email),
      nonce,
      emailIsGoogleAuthoritative:
        emailDomain === 'gmail.com' ||
        (Boolean(hostedDomain) && hostedDomain === emailDomain),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError(
      'invalid_google_token',
      401,
      'Google kimliği doğrulanamadı.',
    );
  }
}

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
};

type IdentityUserRow = UserRow & {
  identity_id: string;
  provider_subject: string;
};

function authUser(
  row: Pick<UserRow, 'id' | 'email' | 'display_name' | 'role'>,
): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name?.trim() || row.email,
    // A Google application session never grants the separate Cloudflare Access
    // administrator capability, even if both identities share one app_users row.
    role: 'user',
  };
}

async function userByGoogleSubject(subject: string) {
  return env.DB.prepare(`SELECT u.id, u.email, u.display_name, u.role, u.status,
      i.id AS identity_id, i.provider_subject
    FROM user_identities i JOIN app_users u ON u.id = i.user_id
    WHERE i.provider = ? AND i.provider_subject = ? LIMIT 1`)
    .bind(GOOGLE_PROVIDER, subject)
    .first<IdentityUserRow>();
}

async function usersByEmail(email: string) {
  return env.DB.prepare(`SELECT id, email, display_name, role, status FROM app_users
    WHERE email = ? COLLATE NOCASE LIMIT 2`)
    .bind(email)
    .all<UserRow>();
}

async function identityByGoogleEmail(email: string) {
  return env.DB.prepare(`SELECT user_id, provider_subject FROM user_identities
    WHERE provider = ? AND email = ? COLLATE NOCASE LIMIT 1`)
    .bind(GOOGLE_PROVIDER, email)
    .first<{ user_id: string; provider_subject: string }>();
}

async function reconcileGoogleUser(
  identity: VerifiedGoogleIdentity,
): Promise<AuthUser> {
  await ensureDatabase();
  const existingIdentity = await userByGoogleSubject(identity.subject);

  if (existingIdentity) {
    if (existingIdentity.status !== 'active') {
      throw new AuthenticationError(
        'account_disabled',
        403,
        'Bu kullanıcı hesabı devre dışı.',
      );
    }

    if (identity.emailIsGoogleAuthoritative) {
      const emailIdentity = await identityByGoogleEmail(identity.email);
      if (
        emailIdentity &&
        emailIdentity.provider_subject !== identity.subject
      ) {
        throw new AuthenticationError(
          'identity_conflict',
          409,
          'Bu e-posta başka bir Google kimliğiyle eşleşiyor.',
        );
      }

      const emailAccounts = await usersByEmail(identity.email);
      if (
        emailAccounts.results.some(
          (account) => account.id !== existingIdentity.id,
        )
      ) {
        throw new AuthenticationError(
          'account_conflict',
          409,
          'Bu e-posta başka bir kullanıcı hesabıyla eşleşiyor.',
        );
      }

      await env.DB.batch([
        env.DB.prepare(`UPDATE user_identities SET email = ?, updated_at = unixepoch()
          WHERE id = ?`).bind(identity.email, existingIdentity.identity_id),
        env.DB.prepare(
          `UPDATE app_users SET email = ?, display_name = ? WHERE id = ?`,
        ).bind(identity.email, identity.displayName, existingIdentity.id),
      ]);
      return {
        ...authUser(existingIdentity),
        email: identity.email,
        displayName: identity.displayName,
      };
    }

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE user_identities SET updated_at = unixepoch() WHERE id = ?`,
      ).bind(existingIdentity.identity_id),
      env.DB.prepare(`UPDATE app_users SET display_name = ? WHERE id = ?`).bind(
        identity.displayName,
        existingIdentity.id,
      ),
    ]);
    return { ...authUser(existingIdentity), displayName: identity.displayName };
  }

  const emailIdentity = await identityByGoogleEmail(identity.email);
  if (emailIdentity) {
    throw new AuthenticationError(
      'identity_conflict',
      409,
      'Bu e-posta başka bir Google kimliğiyle eşleşiyor.',
    );
  }

  const emailAccounts = await usersByEmail(identity.email);
  if (emailAccounts.results.length > 1) {
    throw new AuthenticationError(
      'account_conflict',
      409,
      'Bu e-postayla eşleşen birden fazla kullanıcı hesabı bulundu.',
    );
  }

  let target = emailAccounts.results[0] ?? null;
  if (target && !identity.emailIsGoogleAuthoritative) {
    throw new AuthenticationError(
      'account_link_requires_verification',
      409,
      'Bu e-posta mevcut hesaba otomatik olarak bağlanamıyor.',
    );
  }
  if (target?.status === 'disabled') {
    throw new AuthenticationError(
      'account_disabled',
      403,
      'Bu kullanıcı hesabı devre dışı.',
    );
  }
  if (target) {
    const anotherGoogleIdentity = await env.DB.prepare(`SELECT provider_subject
      FROM user_identities WHERE provider = ? AND user_id = ? LIMIT 1`)
      .bind(GOOGLE_PROVIDER, target.id)
      .first<{ provider_subject: string }>();
    if (
      anotherGoogleIdentity &&
      anotherGoogleIdentity.provider_subject !== identity.subject
    ) {
      throw new AuthenticationError(
        'account_conflict',
        409,
        'Bu kullanıcı hesabı başka bir Google kimliğiyle bağlı.',
      );
    }
  } else {
    const userId = `user:${crypto.randomUUID()}`;
    await env.DB.prepare(`INSERT OR IGNORE INTO app_users (id, email, display_name, role, status)
      VALUES (?, ?, ?, 'user', 'active')`)
      .bind(userId, identity.email, identity.displayName)
      .run();

    const resolvedAccounts = await usersByEmail(identity.email);
    if (
      resolvedAccounts.results.length !== 1 ||
      resolvedAccounts.results[0].status !== 'active'
    ) {
      throw new AuthenticationError(
        'account_conflict',
        409,
        'Kullanıcı hesabı oluşturulamadı.',
      );
    }
    target = resolvedAccounts.results[0];
  }

  await env.DB.prepare(`INSERT OR IGNORE INTO user_identities (
      id, user_id, provider, provider_subject, email
    ) VALUES (?, ?, ?, ?, ?)`)
    .bind(
      `identity:${crypto.randomUUID()}`,
      target.id,
      GOOGLE_PROVIDER,
      identity.subject,
      identity.email,
    )
    .run();

  const linkedUser = await userByGoogleSubject(identity.subject);
  if (!linkedUser || linkedUser.status !== 'active') {
    const conflictingIdentity = await identityByGoogleEmail(identity.email);
    if (conflictingIdentity) {
      throw new AuthenticationError(
        'identity_conflict',
        409,
        'Google kimliği başka bir kullanıcı hesabıyla eşleşiyor.',
      );
    }
    throw new AuthenticationError(
      'account_creation_failed',
      500,
      'Kullanıcı hesabı oluşturulamadı.',
    );
  }

  await env.DB.prepare(`UPDATE app_users SET display_name = ? WHERE id = ?`)
    .bind(identity.displayName, linkedUser.id)
    .run();
  return { ...authUser(linkedUser), displayName: identity.displayName };
}

export async function signInWithGoogle(identity: VerifiedGoogleIdentity) {
  const user = await reconcileGoogleUser(identity);
  const token = createOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + AUTH_SESSION_MAX_AGE_SECONDS;

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM user_sessions
      WHERE expires_at <= unixepoch() OR (revoked_at IS NOT NULL AND revoked_at <= unixepoch() - 86400)`),
    env.DB.prepare(`UPDATE user_sessions SET revoked_at = unixepoch()
      WHERE id IN (
        SELECT id FROM user_sessions
        WHERE user_id = ? AND revoked_at IS NULL AND expires_at > unixepoch()
        ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?
      )`).bind(user.id, MAX_ACTIVE_SESSIONS_PER_USER - 1),
    env.DB.prepare(`INSERT INTO user_sessions (
      id, user_id, token_hash, expires_at, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)`).bind(
      `session:${crypto.randomUUID()}`,
      user.id,
      tokenHash,
      expiresAt,
      now,
      now,
    ),
  ]);

  return { user, token, expiresAt };
}

export async function getCurrentUser(
  request?: Request,
): Promise<AuthUser | null> {
  const token = await requestSessionToken(request);
  if (!token) return null;

  await ensureDatabase();
  const tokenHash = await hashOpaqueToken(token);
  const row =
    await env.DB.prepare(`SELECT u.id, u.email, u.display_name, u.role,
      s.id AS session_id, s.last_seen_at
    FROM user_sessions s JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > unixepoch()
      AND u.status = 'active' LIMIT 1`)
      .bind(tokenHash)
      .first<UserRow & { session_id: string; last_seen_at: number }>();
  if (!row) return null;

  if (row.last_seen_at < Math.floor(Date.now() / 1000) - 24 * 60 * 60) {
    await env.DB.prepare(`UPDATE user_sessions SET last_seen_at = unixepoch()
      WHERE id = ? AND revoked_at IS NULL`)
      .bind(row.session_id)
      .run();
  }
  return authUser(row);
}

export async function revokeCurrentSession(request: Request) {
  const token = await requestSessionToken(request);
  if (!token) return false;

  await ensureDatabase();
  const tokenHash = await hashOpaqueToken(token);
  const result =
    await env.DB.prepare(`UPDATE user_sessions SET revoked_at = unixepoch()
    WHERE token_hash = ? AND revoked_at IS NULL`)
      .bind(tokenHash)
      .run();
  return result.meta.changes === 1;
}

export type GoogleLoginReturnTo = '/hesap' | '/olustur';

export async function prepareGoogleLogin(returnTo: GoogleLoginReturnTo) {
  await ensureDatabase();
  const state = createOpaqueToken();
  const nonce = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const [stateHash, nonceHash] = await Promise.all([
    hashOpaqueToken(state),
    hashOpaqueToken(nonce),
  ]);
  const expiresAt = Math.floor(Date.now() / 1000) + GOOGLE_ATTEMPT_TTL_SECONDS;

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM google_login_attempts
      WHERE expires_at <= unixepoch() OR used_at IS NOT NULL`),
    env.DB.prepare(`INSERT INTO google_login_attempts (
      state_hash, nonce_hash, return_to, expires_at
    ) VALUES (?, ?, ?, ?)`).bind(stateHash, nonceHash, returnTo, expiresAt),
  ]);

  return {
    state,
    nonce,
    csrfToken,
    expiresInSeconds: GOOGLE_ATTEMPT_TTL_SECONDS,
  };
}

export async function consumeGoogleLoginAttempt(state: string, nonce: string) {
  if (!SESSION_TOKEN_PATTERN.test(state) || !SESSION_TOKEN_PATTERN.test(nonce))
    return null;
  await ensureDatabase();
  const [stateHash, nonceHash] = await Promise.all([
    hashOpaqueToken(state),
    hashOpaqueToken(nonce),
  ]);

  return env.DB.prepare(`UPDATE google_login_attempts SET used_at = unixepoch()
    WHERE state_hash = ? AND nonce_hash = ? AND used_at IS NULL AND expires_at > unixepoch()
    RETURNING return_to`)
    .bind(stateHash, nonceHash)
    .first<{ return_to: GoogleLoginReturnTo }>();
}
