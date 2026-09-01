import { NextResponse } from 'next/server';

import { authRequestAllowed } from '@/lib/auth-rate-limit';
import {
  googleCsrfCookie,
  googleStateCookie,
  prepareGoogleLogin,
  type GoogleLoginReturnTo,
} from '@/lib/user-auth';

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return origin === new URL(request.url).origin && fetchSite !== 'cross-site';
}

function errorResponse(error: string, status: number) {
  const response = NextResponse.json({ error }, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return errorResponse('İstek kaynağı doğrulanamadı.', 403);
  }
  if (!(await authRequestAllowed(request, 'google-prepare'))) {
    const response = errorResponse(
      'Çok fazla giriş denemesi yapıldı. Lütfen bir dakika sonra tekrar deneyin.',
      429,
    );
    response.headers.set('Retry-After', '60');
    return response;
  }

  const contentType =
    request.headers.get('content-type')?.toLocaleLowerCase('en-US') ?? '';
  if (!contentType.startsWith('application/json')) {
    return errorResponse('Geçersiz giriş isteği.', 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Geçersiz giriş isteği.', 400);
  }
  const requestedReturnTo =
    body && typeof body === 'object' && 'returnTo' in body
      ? body.returnTo
      : '/hesap';
  if (requestedReturnTo !== '/hesap' && requestedReturnTo !== '/olustur') {
    return errorResponse('Geçersiz dönüş adresi.', 422);
  }
  const returnTo: GoogleLoginReturnTo = requestedReturnTo;
  const attempt = await prepareGoogleLogin(returnTo);
  const response = NextResponse.json(attempt);
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(googleCsrfCookie(attempt.state, attempt.csrfToken));
  response.cookies.set(googleStateCookie(attempt.state, attempt.state));
  return response;
}
