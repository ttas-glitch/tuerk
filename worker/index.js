const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // strip leading /

    // POST /filename — upload a file
    if (request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
      const body = await request.arrayBuffer();

      await env.UPLOADS.put(key, body, {
        httpMetadata: { contentType },
        customMetadata: { uploadedAt: new Date().toISOString() },
      });

      return Response.json({ ok: true, key }, { headers: CORS });
    }

    // GET /  — list all files
    if (request.method === 'GET' && key === '') {
      const listed = await env.UPLOADS.list();
      const files = await Promise.all(
        listed.objects.map(async (obj) => {
          const head = await env.UPLOADS.head(obj.key);
          return {
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded,
            contentType: head?.httpMetadata?.contentType || 'application/octet-stream',
          };
        })
      );
      return Response.json(files, { headers: CORS });
    }

    // GET /filename — serve a file
    if (request.method === 'GET' && key) {
      const obj = await env.UPLOADS.get(key);
      if (!obj) return new Response('Not found', { status: 404, headers: CORS });

      const headers = new Headers(CORS);
      headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Content-Disposition', `inline; filename="${key}"`);
      return new Response(obj.body, { headers });
    }

    // DELETE /filename — remove a file
    if (request.method === 'DELETE' && key) {
      await env.UPLOADS.delete(key);
      return Response.json({ ok: true }, { headers: CORS });
    }

    return new Response('Method not allowed', { status: 405, headers: CORS });
  },
};
