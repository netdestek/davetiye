import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/lib/d1';

export type VideoLibraryItem = {
  id: string;
  title: string;
  contentType: string;
  sizeBytes: number;
  status: 'draft' | 'published' | 'archived';
  createdAt: number;
};

type VideoRow = {
  id: string; title: string; content_type: string; size_bytes: number;
  status: VideoLibraryItem['status']; created_at: number;
};

function mapVideo(row: VideoRow): VideoLibraryItem {
  return { id: row.id, title: row.title, contentType: row.content_type,
    sizeBytes: Number(row.size_bytes), status: row.status, createdAt: Number(row.created_at) };
}

export async function listPublishedVideos() {
  await ensureDatabase();
  const rows = await env.DB.prepare(`SELECT id, title, content_type, size_bytes, status, created_at
    FROM video_library WHERE status = 'published' ORDER BY created_at DESC LIMIT 100`).all<VideoRow>();
  return rows.results.map(mapVideo);
}

export async function listAllVideos() {
  await ensureDatabase();
  const rows = await env.DB.prepare(`SELECT id, title, content_type, size_bytes, status, created_at
    FROM video_library ORDER BY created_at DESC LIMIT 100`).all<VideoRow>();
  return rows.results.map(mapVideo);
}

export async function getPublishedVideo(id: string) {
  await ensureDatabase();
  return env.DB.prepare(`SELECT id, title, video_key, content_type, size_bytes
    FROM video_library WHERE id = ? AND status = 'published' LIMIT 1`).bind(id)
    .first<{ id: string; title: string; video_key: string; content_type: string; size_bytes: number }>();
}

export async function getVideoKey(id: string, includeUnpublished = false) {
  await ensureDatabase();
  const statusClause = includeUnpublished ? '' : "AND status = 'published'";
  return env.DB.prepare(`SELECT video_key, content_type FROM video_library WHERE id = ? ${statusClause} LIMIT 1`)
    .bind(id).first<{ video_key: string; content_type: string }>();
}
