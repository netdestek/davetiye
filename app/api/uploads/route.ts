import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { getActiveActivationSession } from '@/lib/activation-session';
import { ensureDatabase } from '@/lib/d1';

type UploadKind = 'video' | 'poster';

type InitiateBody = {
  action: 'initiate';
  kind: UploadKind;
  fileName: string;
  contentType: string;
  size: number;
};

type CompleteBody = {
  action: 'complete';
  key: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
};

type UploadBody = InitiateBody | CompleteBody;
type CleanupBody = {
  action?: 'abort' | 'delete';
  key?: string;
  uploadId?: string;
};

type UploadSession = {
  kind: UploadKind;
  content_type: string;
  expected_size: number;
  part_size: number;
  expected_parts: number;
  expires_at: number;
  status: 'initiated' | 'completed' | 'attached' | 'aborted' | 'failed' | 'expired' | 'deleted';
};

const PART_SIZE = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 250 * 1024 * 1024;
const POSTER_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 2 * 60 * 60;
const MAX_ACTIVE_UPLOADS = 5;
const DAILY_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

const RULES = {
  video: {
    maxBytes: VIDEO_MAX_BYTES,
    types: new Set(['video/mp4', 'video/webm']),
    extensions: { 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>,
  },
  poster: {
    maxBytes: POSTER_MAX_BYTES,
    types: new Set(['image/jpeg', 'image/png', 'image/webp']),
    extensions: {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    } as Record<string, string>,
  },
};

function ownerPrefix(userId: string) {
  return `uploads/${encodeURIComponent(userId)}/`;
}

function isOwnedKey(key: string, userId: string) {
  return key.startsWith(ownerPrefix(userId)) && !key.includes('..');
}

function cleanFileName(value: string) {
  const printable = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127 ? character : '';
  }).join('');
  return printable.trim().slice(0, 120) || 'media';
}

function isUploadKind(value: unknown): value is UploadKind {
  return value === 'video' || value === 'poster';
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function hasValidSignature(kind: UploadKind, contentType: string, bytes: Uint8Array) {
  if (kind === 'video' && contentType === 'video/mp4') {
    return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  }
  if (kind === 'video' && contentType === 'video/webm') {
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 &&
      bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  if (kind === 'poster' && contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (kind === 'poster' && contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
  }
  if (kind === 'poster' && contentType === 'image/webp') {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

async function readJson(request: Request): Promise<UploadBody | null> {
  try {
    return await request.json() as UploadBody;
  } catch {
    return null;
  }
}

async function getUploadSession(key: string, uploadId: string, userId: string) {
  return env.DB.prepare(`SELECT kind, content_type, expected_size, part_size,
      expected_parts, expires_at, status FROM media_uploads
      WHERE id = ? AND object_key = ? AND owner_user_id = ? LIMIT 1`)
    .bind(uploadId, key, userId).first<UploadSession>();
}

async function markUpload(uploadId: string, userId: string, status: UploadSession['status']) {
  await env.DB.prepare(`UPDATE media_uploads SET status = ?, updated_at = unixepoch()
    WHERE id = ? AND owner_user_id = ?`).bind(status, uploadId, userId).run();
}

async function clearExpiredUploads(userId: string) {
  const expired = await env.DB.prepare(`SELECT id, object_key FROM media_uploads
    WHERE owner_user_id = ? AND status = 'initiated' AND expires_at <= unixepoch()
    ORDER BY expires_at ASC LIMIT 10`).bind(userId)
    .all<{ id: string; object_key: string }>();

  await Promise.all(expired.results.map(async (session) => {
    try {
      await env.FILES.resumeMultipartUpload(session.object_key, session.id).abort();
    } catch {
      // R2 may already have removed an expired multipart upload.
    }
    await markUpload(session.id, userId, 'expired');
  }));
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  }
  await ensureDatabase();
  const user = await getActiveActivationSession(request);
  if (!user) {
    return NextResponse.json({ error: 'Video yüklemek için önce aktivasyon kodunuzu doğrulayın.' }, { status: 401 });
  }

  const body = await readJson(request);
  if (!body) {
    return NextResponse.json({ error: 'Geçersiz yükleme isteği.' }, { status: 400 });
  }

  if (body.action === 'initiate') {
    if (!isUploadKind(body.kind) || typeof body.fileName !== 'string' || body.fileName.length > 512 ||
        typeof body.contentType !== 'string' || body.contentType.length > 100 ||
        typeof body.size !== 'number') {
      return NextResponse.json({ error: 'Geçersiz dosya türü.' }, { status: 422 });
    }

    const rule = RULES[body.kind];
    if (!rule.types.has(body.contentType)) {
      const message = body.kind === 'video'
        ? 'MP4 veya WebM videosu yükleyin.'
        : 'JPG, PNG veya WebP kapak görseli yükleyin.';
      return NextResponse.json({ error: message }, { status: 422 });
    }
    if (!Number.isInteger(body.size) || body.size <= 0) {
      return NextResponse.json({ error: 'Boş bir dosya yüklenemez.' }, { status: 422 });
    }
    if (body.size > rule.maxBytes) {
      const maxMb = Math.floor(rule.maxBytes / 1024 / 1024);
      return NextResponse.json({ error: `Dosya en fazla ${maxMb} MB olabilir.` }, { status: 413 });
    }

    const extension = rule.extensions[body.contentType];
    const key = `${ownerPrefix(user.userId)}${body.kind}-${crypto.randomUUID()}.${extension}`;
    const expectedParts = Math.ceil(body.size / PART_SIZE);
    const expiresAt = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
    await clearExpiredUploads(user.userId);
    await env.DB.prepare(`INSERT INTO app_users (id, email, display_name)
      VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email,
      display_name = excluded.display_name`)
      .bind(user.userId, user.email.toLowerCase(), user.displayName).run();

    let upload: R2MultipartUpload;
    try {
      upload = await env.FILES.createMultipartUpload(key, {
        httpMetadata: {
          contentType: body.contentType,
          contentDisposition: 'inline',
          cacheControl: 'private, max-age=3600',
        },
        customMetadata: {
          ownerUserId: user.userId,
          mediaKind: body.kind,
          originalName: cleanFileName(body.fileName),
          declaredSize: String(body.size),
        },
      });
    } catch {
      return NextResponse.json({ error: 'R2 yükleme oturumu başlatılamadı.' }, { status: 503 });
    }

    try {
      const inserted = await env.DB.prepare(`INSERT INTO media_uploads (
          id, object_key, owner_user_id, kind, content_type, expected_size,
          part_size, expected_parts, status, expires_at
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'initiated', ?
        WHERE (SELECT COUNT(*) FROM media_uploads
          WHERE owner_user_id = ? AND status = 'initiated' AND expires_at > unixepoch()) < ?
        AND (SELECT COALESCE(SUM(expected_size), 0) FROM media_uploads
          WHERE owner_user_id = ? AND created_at >= unixepoch() - 86400) + ? <= ?`)
        .bind(
          upload.uploadId, key, user.userId, body.kind, body.contentType, body.size,
          PART_SIZE, expectedParts, expiresAt, user.userId, MAX_ACTIVE_UPLOADS,
          user.userId, body.size, DAILY_UPLOAD_BYTES,
        ).run();
      if (!inserted.meta.changes) {
        await upload.abort();
        return NextResponse.json({
          error: 'Etkin yükleme veya günlük video kotanıza ulaştınız. Açık yüklemeleri tamamlayıp yeniden deneyin.',
        }, { status: 429 });
      }
    } catch {
      await upload.abort().catch(() => undefined);
      return NextResponse.json({ error: 'Yükleme oturumu kaydedilemedi.' }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      key: upload.key,
      uploadId: upload.uploadId,
      partSize: PART_SIZE,
    }, { status: 201 });
  }

  if (body.action === 'complete') {
    if (typeof body.key !== 'string' || body.key.length > 500 ||
        typeof body.uploadId !== 'string' || body.uploadId.length > 1024 ||
        !isOwnedKey(body.key, user.userId) || !body.uploadId) {
      return NextResponse.json({ error: 'Yükleme oturumu geçersiz.' }, { status: 403 });
    }
    if (!Array.isArray(body.parts) || body.parts.length < 1 || body.parts.length > 10_000) {
      return NextResponse.json({ error: 'Yükleme parçaları geçersiz.' }, { status: 422 });
    }

    const session = await getUploadSession(body.key, body.uploadId, user.userId);
    if (!session || session.status !== 'initiated') {
      return NextResponse.json({ error: 'Yükleme oturumu etkin değil.' }, { status: 409 });
    }
    if (session.expires_at <= Math.floor(Date.now() / 1000)) {
      await markUpload(body.uploadId, user.userId, 'expired');
      await env.FILES.resumeMultipartUpload(body.key, body.uploadId).abort().catch(() => undefined);
      return NextResponse.json({ error: 'Yükleme oturumunun süresi doldu.' }, { status: 410 });
    }
    if (body.parts.length !== session.expected_parts) {
      return NextResponse.json({ error: 'Yükleme parçaları eksik.' }, { status: 422 });
    }

    const uniqueParts = new Set<number>();
    for (const part of body.parts) {
      if (!part || typeof part !== 'object' || !Number.isInteger(part.partNumber) ||
          part.partNumber < 1 || part.partNumber > 10_000 ||
          typeof part.etag !== 'string' || !part.etag || part.etag.length > 256 ||
          uniqueParts.has(part.partNumber)) {
        return NextResponse.json({ error: 'Yükleme parçaları geçersiz.' }, { status: 422 });
      }
      uniqueParts.add(part.partNumber);
    }

    const sortedParts = [...body.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (sortedParts.some((part, index) => part.partNumber !== index + 1)) {
      return NextResponse.json({ error: 'Yükleme parçaları eksik veya sırasız.' }, { status: 422 });
    }

    let object: R2Object;
    try {
      const upload = env.FILES.resumeMultipartUpload(body.key, body.uploadId);
      object = await upload.complete(sortedParts);
    } catch {
      return NextResponse.json({ error: 'Yükleme tamamlanamadı; lütfen yeniden deneyin.' }, { status: 409 });
    }
    const metadata = object.customMetadata;
    const kind = metadata?.mediaKind;
    const declaredSize = Number(metadata?.declaredSize ?? 0);
    const maxBytes = kind === 'poster' ? POSTER_MAX_BYTES : VIDEO_MAX_BYTES;
    const contentType = object.httpMetadata?.contentType ?? '';

    if (metadata?.ownerUserId !== user.userId || !isUploadKind(kind) ||
        kind !== session.kind || contentType !== session.content_type ||
        object.size !== declaredSize || object.size !== session.expected_size || object.size > maxBytes ||
        sortedParts.length !== session.expected_parts || !RULES[kind]?.types.has(contentType)) {
      await env.FILES.delete(body.key);
      await markUpload(body.uploadId, user.userId, 'failed');
      return NextResponse.json({ error: 'Yüklenen dosya doğrulanamadı.' }, { status: 422 });
    }

    let signature = new Uint8Array();
    try {
      const header = await env.FILES.get(body.key, { range: { offset: 0, length: 16 } });
      if (header) signature = new Uint8Array(await header.arrayBuffer());
    } catch {
      await env.FILES.delete(body.key);
      await markUpload(body.uploadId, user.userId, 'failed');
      return NextResponse.json({ error: 'Dosya içeriği doğrulanamadı.' }, { status: 503 });
    }
    if (!hasValidSignature(kind, contentType, signature)) {
      await env.FILES.delete(body.key);
      await markUpload(body.uploadId, user.userId, 'failed');
      return NextResponse.json({ error: 'Dosya içeriği seçilen biçimle eşleşmiyor.' }, { status: 422 });
    }

    try {
      await markUpload(body.uploadId, user.userId, 'completed');
    } catch {
      await env.FILES.delete(body.key).catch(() => undefined);
      return NextResponse.json({ error: 'Yükleme kaydı tamamlanamadı.' }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      key: object.key,
      size: object.size,
      etag: object.etag,
    });
  }

  return NextResponse.json({ error: 'Geçersiz yükleme işlemi.' }, { status: 400 });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  }
  await ensureDatabase();
  const user = await getActiveActivationSession(request);
  if (!user) {
    return NextResponse.json({ error: 'Yüklemeye devam etmek için aktivasyon kodunuzu yeniden doğrulayın.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? '';
  const uploadId = url.searchParams.get('uploadId') ?? '';
  const partNumber = Number(url.searchParams.get('partNumber'));
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? Number.NaN : Number(contentLengthHeader);

  if (!isOwnedKey(key, user.userId) || !uploadId || !Number.isInteger(partNumber) ||
      key.length > 500 || uploadId.length > 1024 ||
      partNumber < 1 || partNumber > 10_000 || !request.body) {
    return NextResponse.json({ error: 'Yükleme parçası geçersiz.' }, { status: 422 });
  }

  const session = await getUploadSession(key, uploadId, user.userId);
  if (!session || session.status !== 'initiated') {
    return NextResponse.json({ error: 'Yükleme oturumu etkin değil.' }, { status: 409 });
  }
  if (session.expires_at <= Math.floor(Date.now() / 1000)) {
    await markUpload(uploadId, user.userId, 'expired');
    await env.FILES.resumeMultipartUpload(key, uploadId).abort().catch(() => undefined);
    return NextResponse.json({ error: 'Yükleme oturumunun süresi doldu.' }, { status: 410 });
  }
  if (partNumber > session.expected_parts) {
    return NextResponse.json({ error: 'Yükleme parçası beklenen aralığın dışında.' }, { status: 422 });
  }

  const expectedLength = partNumber === session.expected_parts
    ? session.expected_size - (session.expected_parts - 1) * session.part_size
    : session.part_size;
  if (!Number.isInteger(contentLength) || contentLength !== expectedLength) {
    return NextResponse.json({ error: 'Yükleme parçasının boyutu beklenen değerle eşleşmiyor.' }, { status: 422 });
  }

  try {
    const upload = env.FILES.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, request.body);
    return NextResponse.json({ ok: true, partNumber: part.partNumber, etag: part.etag });
  } catch {
    return NextResponse.json({ error: 'Yükleme parçası R2’ye aktarılamadı.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  await ensureDatabase();
  const user = await getActiveActivationSession(request);
  if (!user) return new Response(null, { status: 401 });

  let body: CleanupBody | null;
  try {
    body = await request.json() as CleanupBody;
  } catch {
    body = null;
  }
  const key = typeof body?.key === 'string' ? body.key : '';
  const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
  if (!isOwnedKey(key, user.userId)) return new Response(null, { status: 204 });
  if (body?.action === 'delete') {
    const session = await env.DB.prepare(`SELECT id FROM media_uploads
      WHERE object_key = ? AND owner_user_id = ? AND status IN ('completed','attached') LIMIT 1`)
      .bind(key, user.userId).first<{ id: string }>();
    if (!session) return new Response(null, { status: 204 });
    const reference = await env.DB.prepare(`SELECT id FROM invitations
      WHERE video_key = ? OR poster_key = ? LIMIT 1`).bind(key, key).first<{ id: string }>();
    if (reference) {
      return NextResponse.json({ error: 'Yayındaki bir davetiyeye bağlı medya silinemez.' }, { status: 409 });
    }
    const object = await env.FILES.head(key);
    if (object?.customMetadata?.ownerUserId === user.userId) await env.FILES.delete(key);
    await markUpload(session.id, user.userId, 'deleted');
    return new Response(null, { status: 204 });
  }

  if (!uploadId) return new Response(null, { status: 204 });

  const session = await getUploadSession(key, uploadId, user.userId);
  if (!session || session.status !== 'initiated') return new Response(null, { status: 204 });

  try {
    await env.FILES.resumeMultipartUpload(key, uploadId).abort();
  } catch {
    // Abort is intentionally idempotent for clients retrying cleanup.
  }
  await markUpload(uploadId, user.userId, 'aborted');
  return new Response(null, { status: 204 });
}
