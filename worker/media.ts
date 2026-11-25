import type { Env } from './env';

/**
 * Static assets ignore Range requests, so a video served from them cannot be
 * seeked or replayed in Chrome. This answers a single byte range by streaming
 * only that slice of the asset.
 */
export async function media(request: Request, env: Env) {
  const range = request.headers.get('Range');
  const response = await env.ASSETS.fetch(
    new Request(request.url, { method: request.method }),
  );
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (!match) return new Response(response.body, { status: 200, headers });
  // The asset binding may stream without a length; then read it to know it.
  const length = response.headers.get('Content-Length');
  const buffered = length ? null : new Uint8Array(await response.arrayBuffer());
  const size = buffered ? buffered.byteLength : Number(length);
  if (!Number.isSafeInteger(size) || size <= 0)
    return new Response(buffered ?? response.body, { status: 200, headers });

  let start: number;
  let end: number;
  if (match[1] === '') {
    // bytes=-N: the last N bytes.
    const suffix = Number(match[2]);
    if (!match[2] || suffix === 0) return unsatisfiable(size, response);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || end < start) return unsatisfiable(size, response);

  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  if (buffered)
    return new Response(
      request.method === 'HEAD' ? null : buffered.slice(start, end + 1),
      { status: 206, headers },
    );
  if (request.method === 'HEAD' || !response.body) {
    await response.body?.cancel();
    return new Response(null, { status: 206, headers });
  }
  return new Response(slice(response.body, start, end + 1), {
    status: 206,
    headers,
  });
}

function unsatisfiable(size: number, response: Response) {
  if (!response.bodyUsed) void response.body?.cancel();
  return new Response(null, {
    status: 416,
    headers: { 'Content-Range': `bytes */${size}` },
  });
}

/** Bytes [from, to) of a stream, stopping the source once `to` is reached. */
function slice(body: ReadableStream<Uint8Array>, from: number, to: number) {
  const reader = body.getReader();
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        const chunkStart = offset;
        offset += value.byteLength;
        if (offset <= from) continue;
        const begin = Math.max(0, from - chunkStart);
        const finish = Math.min(value.byteLength, to - chunkStart);
        controller.enqueue(value.subarray(begin, finish));
        if (offset >= to) {
          await reader.cancel();
          controller.close();
        }
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
