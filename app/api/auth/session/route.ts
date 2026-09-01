import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/user-auth';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  const response = NextResponse.json({ authenticated: Boolean(user), user });
  response.headers.set('Cache-Control', 'no-store, private');
  response.headers.set('Vary', 'Cookie');
  return response;
}
