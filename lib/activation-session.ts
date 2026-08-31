import { env } from 'cloudflare:workers';

import { hashActivationToken } from '@/lib/activation-codes';

export const ACTIVATION_COOKIE_NAME = 'davetly_activation';

export type ActiveActivationSession = {
  id: string;
  codeId: string;
  tokenHash: string;
  userId: string;
  email: string;
  displayName: string;
};

type ActivationSessionRow = {
  id: string;
  code_id: string;
  session_status: 'active' | 'redeemed' | 'expired' | 'revoked';
  expires_at: number;
  owner_user_id: string;
  code_status: 'unused' | 'used';
  email: string;
  display_name: string | null;
  user_status: 'active' | 'disabled';
};

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

export async function getActiveActivationSession(request: Request): Promise<ActiveActivationSession | null> {
  const token = getCookie(request, ACTIVATION_COOKIE_NAME);
  if (!token || token.length < 32 || token.length > 128) return null;

  const tokenHash = await hashActivationToken(token);
  const session = await env.DB.prepare(`SELECT s.id, s.code_id, s.status AS session_status,
      s.expires_at, s.owner_user_id, c.status AS code_status, u.email, u.display_name,
      u.status AS user_status
    FROM activation_sessions s
    JOIN activation_codes c ON c.id = s.code_id
    JOIN app_users u ON u.id = s.owner_user_id
    WHERE s.token_hash = ? LIMIT 1`)
    .bind(tokenHash).first<ActivationSessionRow>();

  if (!session) return null;
  if (session.session_status === 'active' && session.expires_at <= Math.floor(Date.now() / 1000)) {
    await env.DB.prepare(`UPDATE activation_sessions SET status = 'expired'
      WHERE id = ? AND status = 'active'`).bind(session.id).run();
    return null;
  }
  if (session.session_status !== 'active' || session.code_status !== 'unused' || session.user_status !== 'active') return null;

  return {
    id: session.id,
    codeId: session.code_id,
    tokenHash,
    userId: session.owner_user_id,
    email: session.email,
    displayName: session.display_name ?? 'Davetiye müşterisi',
  };
}

export async function getActivationSessionFailureReason(request: Request): Promise<'used' | 'expired' | 'invalid'> {
  const token = getCookie(request, ACTIVATION_COOKIE_NAME);
  if (!token || token.length < 32 || token.length > 128) return 'invalid';

  const tokenHash = await hashActivationToken(token);
  const session = await env.DB.prepare(`SELECT s.id, s.status AS session_status, s.expires_at,
      c.status AS code_status
    FROM activation_sessions s
    JOIN activation_codes c ON c.id = s.code_id
    WHERE s.token_hash = ? LIMIT 1`)
    .bind(tokenHash).first<{
      id: string;
      session_status: 'active' | 'redeemed' | 'expired' | 'revoked';
      expires_at: number;
      code_status: 'unused' | 'used';
    }>();
  if (!session) return 'invalid';
  if (session.code_status === 'used') return 'used';
  if (session.session_status === 'active' && session.expires_at <= Math.floor(Date.now() / 1000)) {
    await env.DB.prepare(`UPDATE activation_sessions SET status = 'expired'
      WHERE id = ? AND status = 'active'`).bind(session.id).run();
    return 'expired';
  }
  return session.session_status === 'expired' ? 'expired' : 'invalid';
}
