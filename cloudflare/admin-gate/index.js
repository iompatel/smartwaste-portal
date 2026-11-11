const ORIGINS = {
  'admin.smartwaste.dpdns.org': 'https://smartwaste-admin.onrender.com',
  'admin-api.smartwaste.dpdns.org': 'https://smartwaste-admin-backend.onrender.com',
};

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Edge gate for the private admin console. Cloudflare Access needs a card to
// activate, so this free Worker holds the first (and only shared) credential.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = ORIGINS[url.hostname];
    if (!origin) return new Response('Not found', { status: 404 });

    // CORS preflights carry no credentials and no data.
    if (request.method !== 'OPTIONS') {
      const expected = `Basic ${btoa(`${env.BASIC_USER}:${env.BASIC_PASS}`)}`;
      const provided = request.headers.get('Authorization') ?? '';
      if (!timingSafeEqual(provided, expected)) {
        return new Response('Authentication required', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="SmartWaste Admin", charset="UTF-8"',
            'Cache-Control': 'no-store',
          },
        });
      }
    }

    // The Basic credential is for the edge only; never forward it to Render.
    const headers = new Headers(request.headers);
    headers.delete('Authorization');
    // Proves to the admin backend that this request came through the gate.
    if (env.EDGE_SECRET) headers.set('X-Admin-Edge', env.EDGE_SECRET);
    return fetch(
      new Request(origin + url.pathname + url.search, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      }),
    );
  },
};
