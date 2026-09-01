import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureConfiguredAdmin, getAccessUser } from '@/app/cloudflare-access-auth';
import { ensureDatabase } from '@/lib/d1';
import { listAllVideos } from '@/lib/video-library';

const PART_SIZE = 8 * 1024 * 1024;
const MAX_BYTES = 250 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 2 * 60 * 60;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

type UploadedPart = { partNumber: number; etag: string };
type InitiateBody = { action: 'initiate'; title?: unknown; fileName?: unknown; contentType?: unknown; size?: unknown };
type CompleteBody = { action: 'complete'; videoId?: unknown; key?: unknown; uploadId?: unknown; parts?: unknown };
type PatchBody = { videoId?: unknown; status?: unknown };

type UploadSession = {
  content_type: string;
  expected_size: number;
  part_size: number;
  expected_parts: number;
  expires_at: number;
  status: string;
};

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function adminUser() {
  const accessUser = await getAccessUser();
  return accessUser ? ensureConfiguredAdmin(accessUser) : null;
}

function cleanText(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function extensionFor(contentType: string) {
  return contentType === 'video/webm' ? 'webm' : 'mp4';
}

function hasVideoSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'video/mp4') {
    return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  }
  return contentType === 'video/webm' && bytes.length >= 4 && bytes[0] === 0x1a &&
    bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

async function uploadSession(key: string, uploadId: string, userId: string) {
  return env.DB.prepare(`SELECT content_type, expected_size, part_size, expected_parts, expires_at, status
    FROM media_uploads WHERE id = ? AND object_key = ? AND owner_user_id = ? AND kind = 'video' LIMIT 1`)
    .bind(uploadId, key, userId).first<UploadSession>();
}

export async function GET() {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: 'Yönetici oturumu doğrulanamadı.' }, { status: 401 });
  const videos = await listAllVideos();
  return NextResponse.json({ videos: videos.map((video) => ({
    ...video, previewUrl: `/api/admin/videos/${encodeURIComponent(video.id)}/media`,
  })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: 'Yönetici oturumu doğrulanamadı.' }, { status: 401 });
  await ensureDatabase();

  let body: InitiateBody | CompleteBody;
  try { body = await request.json() as InitiateBody | CompleteBody; }
  catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }); }

  if (body.action === 'initiate') {
    const title = cleanText(body.title);
    const fileName = cleanText(body.fileName, 200);
    const contentType = cleanText(body.contentType, 100);
    const size = Number(body.size);
    if (title.length < 2 || !fileName || !VIDEO_TYPES.has(contentType) ||
        !Number.isInteger(size) || size <= 0 || size > MAX_BYTES) {
      return NextResponse.json({ error: 'Video başlığını, biçimini ve boyutunu kontrol edin.' }, { status: 422 });
    }

    const videoId = crypto.randomUUID();
    const key = `library/${videoId}/source.${extensionFor(contentType)}`;
    let upload: R2MultipartUpload;
    try {
      upload = await env.FILES.createMultipartUpload(key, {
        httpMetadata: { contentType, contentDisposition: 'inline', cacheControl: 'public, max-age=3600' },
        customMetadata: { ownerUserId: user.userId, mediaKind: 'video-library', videoId, declaredSize: String(size) },
      });
    } catch {
      return NextResponse.json({ error: 'R2 yükleme oturumu başlatılamadı.' }, { status: 503 });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO video_library (
          id, title, video_key, content_type, size_bytes, status, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'draft', ?)`).bind(videoId, title, key, contentType, size, user.userId),
        env.DB.prepare(`INSERT INTO media_uploads (
          id, object_key, owner_user_id, kind, content_type, expected_size, part_size,
          expected_parts, status, expires_at
        ) VALUES (?, ?, ?, 'video', ?, ?, ?, ?, 'initiated', ?)`).bind(
          upload.uploadId, key, user.userId, contentType, size, PART_SIZE,
          Math.ceil(size / PART_SIZE), expiresAt,
        ),
      ]);
    } catch {
      await upload.abort().catch(() => undefined);
      return NextResponse.json({ error: 'Video kütüphane kaydı oluşturulamadı.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, videoId, key, uploadId: upload.uploadId, partSize: PART_SIZE }, { status: 201 });
  }

  if (body.action !== 'complete') return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  const videoId = cleanText(body.videoId, 80);
  const key = cleanText(body.key, 500);
  const uploadId = cleanText(body.uploadId, 1024);
  const parts = Array.isArray(body.parts) ? body.parts as UploadedPart[] : [];
  if (!videoId || key !== `library/${videoId}/source.${key.endsWith('.webm') ? 'webm' : 'mp4'}` ||
      !uploadId || parts.length < 1 || parts.length > 10_000) {
    return NextResponse.json({ error: 'Yükleme bilgileri geçersiz.' }, { status: 422 });
  }
  const session = await uploadSession(key, uploadId, user.userId);
  if (!session || session.status !== 'initiated') return NextResponse.json({ error: 'Yükleme oturumu etkin değil.' }, { status: 409 });
  if (session.expires_at <= Math.floor(Date.now() / 1000)) return NextResponse.json({ error: 'Yükleme süresi doldu.' }, { status: 410 });
  const libraryVideo = await env.DB.prepare(`SELECT video_key, content_type, size_bytes, status
    FROM video_library WHERE id = ? AND created_by_user_id = ? LIMIT 1`)
    .bind(videoId, user.userId)
    .first<{ video_key: string; content_type: string; size_bytes: number; status: string }>();
  if (!libraryVideo || libraryVideo.status !== 'draft' || libraryVideo.video_key !== key ||
      libraryVideo.content_type !== session.content_type || libraryVideo.size_bytes !== session.expected_size) {
    return NextResponse.json({ error: 'Video kütüphane kaydı yüklemeyle eşleşmiyor.' }, { status: 409 });
  }
  const unique = new Set<number>();
  for (const part of parts) {
    if (!part || !Number.isInteger(part.partNumber) || part.partNumber < 1 ||
        typeof part.etag !== 'string' || !part.etag || unique.has(part.partNumber)) {
      return NextResponse.json({ error: 'Yükleme parçaları geçersiz.' }, { status: 422 });
    }
    unique.add(part.partNumber);
  }
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  if (sorted.length !== session.expected_parts || sorted.some((part, index) => part.partNumber !== index + 1)) {
    return NextResponse.json({ error: 'Yükleme parçaları eksik.' }, { status: 422 });
  }
  try { await env.FILES.resumeMultipartUpload(key, uploadId).complete(sorted); }
  catch { return NextResponse.json({ error: 'Video yüklemesi tamamlanamadı.' }, { status: 409 }); }

  const object = await env.FILES.head(key);
  const metadata = object?.customMetadata;
  if (!object || metadata?.ownerUserId !== user.userId || metadata.videoId !== videoId ||
      object.size !== session.expected_size || object.httpMetadata?.contentType !== session.content_type) {
    await env.FILES.delete(key).catch(() => undefined);
    await env.DB.prepare(`UPDATE media_uploads SET status = 'failed', updated_at = unixepoch() WHERE id = ?`).bind(uploadId).run();
    return NextResponse.json({ error: 'Yüklenen video doğrulanamadı.' }, { status: 422 });
  }
  const header = await env.FILES.get(key, { range: { offset: 0, length: 16 } });
  const signature = header ? new Uint8Array(await header.arrayBuffer()) : new Uint8Array();
  if (!hasVideoSignature(session.content_type, signature)) {
    await env.FILES.delete(key).catch(() => undefined);
    await env.DB.prepare(`UPDATE media_uploads SET status = 'failed', updated_at = unixepoch() WHERE id = ?`).bind(uploadId).run();
    return NextResponse.json({ error: 'Dosya içeriği MP4/WebM biçimiyle eşleşmiyor.' }, { status: 422 });
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE media_uploads SET status = 'attached', updated_at = unixepoch() WHERE id = ? AND owner_user_id = ?`).bind(uploadId, user.userId),
    env.DB.prepare(`UPDATE video_library SET status = 'published', updated_at = unixepoch()
      WHERE id = ? AND created_by_user_id = ? AND status = 'draft'`).bind(videoId, user.userId),
  ]);
  return NextResponse.json({ ok: true, videoId }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: 'Yönetici oturumu doğrulanamadı.' }, { status: 401 });
  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? '';
  const uploadId = url.searchParams.get('uploadId') ?? '';
  const partNumber = Number(url.searchParams.get('partNumber'));
  const contentLength = Number(request.headers.get('content-length'));
  const session = await uploadSession(key, uploadId, user.userId);
  if (!session || session.status !== 'initiated' || !request.body || !Number.isInteger(partNumber) ||
      partNumber < 1 || partNumber > session.expected_parts) {
    return NextResponse.json({ error: 'Yükleme parçası geçersiz.' }, { status: 422 });
  }
  const expectedLength = partNumber === session.expected_parts
    ? session.expected_size - (session.expected_parts - 1) * session.part_size
    : session.part_size;
  if (contentLength !== expectedLength) return NextResponse.json({ error: 'Parça boyutu geçersiz.' }, { status: 422 });
  try {
    const part = await env.FILES.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, request.body);
    return NextResponse.json({ partNumber: part.partNumber, etag: part.etag });
  } catch {
    return NextResponse.json({ error: 'Yükleme parçası R2’ye aktarılamadı.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: 'Yönetici oturumu doğrulanamadı.' }, { status: 401 });
  let body: PatchBody;
  try { body = await request.json() as PatchBody; } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }); }
  const videoId = cleanText(body.videoId, 80);
  const status = body.status === 'published' || body.status === 'archived' ? body.status : '';
  if (!videoId || !status) return NextResponse.json({ error: 'Video durumu geçersiz.' }, { status: 422 });
  const video = await env.DB.prepare('SELECT video_key FROM video_library WHERE id = ? LIMIT 1').bind(videoId).first<{ video_key: string }>();
  if (!video || (status === 'published' && !(await env.FILES.head(video.video_key)))) {
    return NextResponse.json({ error: 'Video bulunamadı veya R2 nesnesi eksik.' }, { status: 404 });
  }
  await env.DB.prepare('UPDATE video_library SET status = ?, updated_at = unixepoch() WHERE id = ?').bind(status, videoId).run();
  return NextResponse.json({ ok: true });
}
