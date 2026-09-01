import { NextResponse } from 'next/server';

import { authRequestAllowed } from '@/lib/auth-rate-limit';
import {
  AuthenticationError,
  consumeGoogleLoginAttempt,
  googleCsrfCookie,
  googleCsrfCookieName,
  googleStateCookie,
  googleStateCookieName,
  sessionCookie,
  signInWithGoogle,
  verifyGoogleCredential,
} from '@/lib/user-auth';

const MAX_FORM_LENGTH = 16_384;
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return origin === new URL(request.url).origin && fetchSite !== 'cross-site';
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

async function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function errorResponse(
  request: Request,
  error: string,
  status: number,
  state?: string,
  returnTo: '/hesap' | '/olustur' = '/hesap',
) {
  if (request.headers.get('accept')?.includes('text/html')) {
    const loginUrl = new URL('/giris', request.url);
    loginUrl.searchParams.set('error', 'google');
    if (returnTo === '/olustur') loginUrl.searchParams.set('returnTo', returnTo);
    const response = NextResponse.redirect(
      loginUrl,
      { status: 303 },
    );
    response.headers.set('Cache-Control', 'no-store');
    if (status === 429) response.headers.set('Retry-After', '60');
    if (state && OPAQUE_TOKEN_PATTERN.test(state)) {
      response.cookies.set(googleCsrfCookie(state, '', 0));
      response.cookies.set(googleStateCookie(state, '', 0));
    }
    return response;
  }
  const response = NextResponse.json({ error }, { status });
  response.headers.set('Cache-Control', 'no-store');
  if (status === 429) response.headers.set('Retry-After', '60');
  return response;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return errorResponse(request, 'İstek kaynağı doğrulanamadı.', 403);
  }
  const contentType =
    request.headers.get('content-type')?.toLocaleLowerCase('en-US') ?? '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return errorResponse(request, 'Geçersiz Google giriş isteği.', 415);
  }

  const announcedLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(announcedLength) && announcedLength > MAX_FORM_LENGTH) {
    return errorResponse(request, 'Google giriş isteği çok büyük.', 413);
  }

  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(request, 'Google giriş isteği okunamadı.', 400);
  }
  if (!rawBody || rawBody.length > MAX_FORM_LENGTH) {
    return errorResponse(
      request,
      'Geçersiz Google giriş isteği.',
      rawBody.length > MAX_FORM_LENGTH ? 413 : 400,
    );
  }

  const form = new URLSearchParams(rawBody);
  const credentials = form.getAll('credential');
  const states = form.getAll('state');
  const returnTos = form.getAll('returnTo');
  const bodyCsrfTokens = form.getAll('g_csrf_token');
  const state = states.length === 1 && OPAQUE_TOKEN_PATTERN.test(states[0])
    ? states[0]
    : '';
  const returnTo = returnTos.length === 1 && returnTos[0] === '/olustur'
    ? '/olustur'
    : '/hesap';
  const cookieCsrfTokens = cookieValues(
    request.headers.get('cookie'),
    state ? googleCsrfCookieName(state) : '',
  );
  const stateCookies = cookieValues(
    request.headers.get('cookie'),
    state ? googleStateCookieName(state) : '',
  );
  if (
    credentials.length !== 1 ||
    states.length !== 1 ||
    returnTos.length !== 1 ||
    (returnTos[0] !== '/hesap' && returnTos[0] !== '/olustur') ||
    bodyCsrfTokens.length !== 1 ||
    cookieCsrfTokens.length !== 1 ||
    stateCookies.length !== 1 ||
    !state ||
    !OPAQUE_TOKEN_PATTERN.test(stateCookies[0]) ||
    !OPAQUE_TOKEN_PATTERN.test(bodyCsrfTokens[0]) ||
    !OPAQUE_TOKEN_PATTERN.test(cookieCsrfTokens[0]) ||
    !(await constantTimeEqual(bodyCsrfTokens[0], cookieCsrfTokens[0])) ||
    !(await constantTimeEqual(states[0], stateCookies[0]))
  ) {
    return errorResponse(
      request,
      'Google giriş güvenlik doğrulaması başarısız.',
      400,
      state,
      returnTo,
    );
  }

  if (!(await authRequestAllowed(request, 'google-callback'))) {
    return errorResponse(
      request,
      'Çok fazla giriş denemesi yapıldı. Lütfen bir dakika sonra tekrar deneyin.',
      429,
      state,
      returnTo,
    );
  }

  try {
    const identity = await verifyGoogleCredential(credentials[0]);
    const attempt = await consumeGoogleLoginAttempt(states[0], identity.nonce);
    if (!attempt) {
      return errorResponse(
        request,
        'Google giriş isteğinin süresi dolmuş veya daha önce kullanılmış.',
        400,
        state,
        returnTo,
      );
    }
    const { token } = await signInWithGoogle(identity);
    const response = NextResponse.redirect(
      new URL(attempt.return_to, request.url),
      { status: 303 },
    );
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.cookies.set(sessionCookie(token));
    response.cookies.set(googleCsrfCookie(state, '', 0));
    response.cookies.set(googleStateCookie(state, '', 0));
    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return errorResponse(request, error.message, error.status, state, returnTo);
    }
    return errorResponse(
      request,
      'Google ile giriş şu anda tamamlanamadı.',
      500,
      state,
      returnTo,
    );
  }
}
