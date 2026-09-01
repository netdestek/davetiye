import { NextResponse } from 'next/server';
import { getActiveActivationSession } from '@/lib/activation-session';
import { getCurrentUser } from '@/lib/user-auth';
import { listPublishedVideos } from '@/lib/video-library';

export async function GET(request: Request) {
  const [user, activation] = await Promise.all([
    getCurrentUser(request),
    getActiveActivationSession(request),
  ]);
  if (!user) {
    return NextResponse.json({ error: 'Google hesabınızla giriş yapmanız gerekiyor.' }, { status: 401 });
  }
  if (!activation || activation.userId !== user.id) {
    return NextResponse.json({ error: 'Aktivasyon oturumu gerekli.' }, { status: 401 });
  }
  const videos = await listPublishedVideos();
  return NextResponse.json({ videos: videos.map((video) => ({
    ...video, previewUrl: `/api/videos/${encodeURIComponent(video.id)}/media`,
  })) }, { headers: { 'Cache-Control': 'no-store' } });
}
