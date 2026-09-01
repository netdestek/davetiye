import { env } from 'cloudflare:workers';

type ByteRange = { offset: number; length: number; end: number };
type RangeDecision = { kind: 'ignore' } | { kind: 'unsatisfiable' } | { kind: 'range'; range: ByteRange };

function parseRange(value: string, size: number): RangeDecision {
  if (!value.toLowerCase().startsWith('bytes=') || value.includes(',')) return { kind: 'ignore' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return { kind: 'unsatisfiable' };
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return { kind: 'unsatisfiable' };
    const length = Math.min(suffixLength, size);
    return { kind: 'range', range: { offset: size - length, length, end: size - 1 } };
  }
  const offset = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(requestedEnd) || offset >= size || requestedEnd < offset) return { kind: 'unsatisfiable' };
  const end = Math.min(requestedEnd, size - 1);
  return { kind: 'range', range: { offset, length: end - offset + 1, end } };
}

export async function serveR2Media(request: Request, key: string, headOnly = false) {
  const metadata = await env.FILES.head(key);
  if (!metadata) return new Response(null, { status: 404 });
  const rangeHeader = headOnly ? null : request.headers.get('range');
  const decision = rangeHeader ? parseRange(rangeHeader, metadata.size) : { kind: 'ignore' } as const;
  if (decision.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: {
    'accept-ranges': 'bytes', 'content-range': `bytes */${metadata.size}`, 'content-length': '0',
  } });
  const range = decision.kind === 'range' ? decision.range : undefined;
  const headers = new Headers();
  metadata.writeHttpMetadata(headers);
  headers.set('etag', metadata.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-length', String(range?.length ?? metadata.size));
  if (range) headers.set('content-range', `bytes ${range.offset}-${range.end}/${metadata.size}`);
  const status = range ? 206 : 200;
  if (headOnly) return new Response(null, { status, headers });
  const object = await env.FILES.get(key, range ? { range: { offset: range.offset, length: range.length } } : undefined);
  return object ? new Response(object.body, { status, headers }) : new Response(null, { status: 404 });
}
