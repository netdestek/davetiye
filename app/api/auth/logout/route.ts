import { NextResponse } from 'next/server';

import { ACTIVATION_COOKIE_NAME } from '@/lib/activation-session';
import { revokeCurrentSession, sessionCookie } from '@/lib/user-auth';

function isSameOrigin(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin && origin !== expectedOrigin) return false;
  return fetchSite !== 'cross-site';
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'İstek kaynağı doğrulanamadı.' },
      { status: 403 },
    );
  }

  await revokeCurrentSession(request);
  const response = NextResponse.redirect(new URL('/', request.url), {
    status: 303,
  });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(sessionCookie('', 0));
  response.cookies.set({
    name: ACTIVATION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
  return response;
}
