import { NextResponse } from 'next/server';
import { getActiveActivationSession } from '@/lib/activation-session';
import { listPublishedVideos } from '@/lib/video-library';

export async function GET(request: Request) {
  if (!(await getActiveActivationSession(request))) {
    return NextResponse.json({ error: 'Aktivasyon oturumu gerekli.' }, { status: 401 });
  }
  const videos = await listPublishedVideos();
  return NextResponse.json({ videos: videos.map((video) => ({
    ...video, previewUrl: `/api/videos/${encodeURIComponent(video.id)}/media`,
  })) }, { headers: { 'Cache-Control': 'no-store' } });
}
