import { NextResponse } from 'next/server';

function disabled() {
  return NextResponse.json({
    error: 'Kullanıcı video yüklemeleri kapalıdır. Videolar yalnızca yönetici kütüphanesinden seçilebilir.',
  }, { status: 403 });
}

export const POST = disabled;
export const PUT = disabled;
export const DELETE = disabled;
