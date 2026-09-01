import { env } from 'cloudflare:workers';

export async function authRequestAllowed(
  request: Request,
  scope: 'google-prepare' | 'google-callback',
) {
  const limiter = (env as Cloudflare.Env).AUTH_RATE_LIMITER;
  if (!limiter) return true;

  const clientAddress =
    request.headers.get('cf-connecting-ip')?.trim() || 'unknown-client';
  try {
    const result = await limiter.limit({ key: `${scope}:${clientAddress}` });
    return result.success;
  } catch {
    // Authentication should remain available during a transient limiter outage.
    return true;
  }
}
