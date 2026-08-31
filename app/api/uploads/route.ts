import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { getChatGPTUser } from '@/app/chatgpt-auth';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav',
]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Devam etmek için giriş yapın.' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Bir dosya seçin.' }, { status: 422 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'MP4, WebM, MP3 veya WAV dosyası yükleyin.' }, { status: 422 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Dosya en fazla 25 MB olabilir.' }, { status: 413 });
  }

  const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const mediaKind = file.type.startsWith('video/') ? 'video' : 'audio';
  const key = `uploads/${user.userId}/${mediaKind}-${crypto.randomUUID()}.${extension}`;
  await env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { ownerUserId: user.userId, originalName: file.name.slice(0, 120) },
  });
  return NextResponse.json({ ok: true, key });
}
