import { env } from 'cloudflare:workers';

import { getPublicInvitation } from '@/lib/d1';

type RouteContext = { params: Promise<{ slug: string; kind: string }> };

type ByteRange = {
  offset: number;
  length: number;
  end: number;
};

type RangeDecision =
  | { kind: 'ignore' }
  | { kind: 'unsatisfiable' }
  | { kind: 'range'; range: ByteRange };

function parseRange(value: string, size: number): RangeDecision {
  if (!value.toLowerCase().startsWith('bytes=')) return { kind: 'ignore' };
  if (value.includes(',')) return { kind: 'ignore' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return { kind: 'ignore' };
  if (size === 0) return { kind: 'unsatisfiable' };

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return { kind: 'unsatisfiable' };
    const length = Math.min(suffixLength, size);
    return { kind: 'range', range: { offset: size - length, length, end: size - 1 } };
  }

  const offset = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(requestedEnd) ||
      offset >= size || requestedEnd < offset) return { kind: 'unsatisfiable' };

  const end = Math.min(requestedEnd, size - 1);
  return { kind: 'range', range: { offset, length: end - offset + 1, end } };
}

function objectHeaders(object: R2Object, contentLength: number) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('content-length', String(contentLength));
  headers.set('accept-ranges', 'bytes');
  return headers;
}

async function serve(request: Request, context: RouteContext, headOnly: boolean) {
  const { slug, kind } = await context.params;
  if (kind !== 'video' && kind !== 'poster') return new Response(null, { status: 404 });

  const invitation = await getPublicInvitation(slug);
  if (!invitation) return new Response(null, { status: 404 });

  const key = kind === 'video' ? invitation.videoKey : invitation.posterKey;
  if (!key) return new Response(null, { status: 404 });

  const metadata = await env.FILES.head(key);
  if (!metadata) return new Response(null, { status: 404 });

  const rangeValue = headOnly ? null : request.headers.get('range');
  const decision = rangeValue ? parseRange(rangeValue, metadata.size) : { kind: 'ignore' } as const;
  if (decision.kind === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: {
        'accept-ranges': 'bytes',
        'content-range': `bytes */${metadata.size}`,
        'content-length': '0',
      },
    });
  }
  const range = decision.kind === 'range' ? decision.range : undefined;

  const contentLength = range?.length ?? metadata.size;
  const headers = objectHeaders(metadata, contentLength);
  if (range) headers.set('content-range', `bytes ${range.offset}-${range.end}/${metadata.size}`);
  const status = range ? 206 : 200;
  if (headOnly) return new Response(null, { status, headers });

  const object = await env.FILES.get(key, range ? {
    range: { offset: range.offset, length: range.length },
  } : undefined);
  if (!object) return new Response(null, { status: 404 });

  return new Response(object.body, { status, headers });
}

export async function GET(request: Request, context: RouteContext) {
  return serve(request, context, false);
}

export async function HEAD(request: Request, context: RouteContext) {
  return serve(request, context, true);
}
