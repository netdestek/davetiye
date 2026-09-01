import { getActiveActivationSession } from '@/lib/activation-session';
import { serveR2Media } from '@/lib/r2-media';
import { getCurrentUser } from '@/lib/user-auth';
import { getVideoKey } from '@/lib/video-library';

type RouteContext = { params: Promise<{ id: string }> };
async function serve(request: Request, context: RouteContext, headOnly: boolean) {
  const [user, activation] = await Promise.all([
    getCurrentUser(request),
    getActiveActivationSession(request),
  ]);
  if (!user || !activation || activation.userId !== user.id) return new Response(null, { status: 401 });
  const { id } = await context.params;
  const video = await getVideoKey(id);
  return video ? serveR2Media(request, video.video_key, headOnly) : new Response(null, { status: 404 });
}
export async function GET(request: Request, context: RouteContext) { return serve(request, context, false); }
export async function HEAD(request: Request, context: RouteContext) { return serve(request, context, true); }
