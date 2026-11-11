const WORKER_HOST = 'worker.smartwaste.dpdns.org';
const RENDER_ORIGIN = 'https://smartwaste-worker.onrender.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== WORKER_HOST) {
      return new Response('Not found', { status: 404 });
    }

    return fetch(
      new Request(RENDER_ORIGIN + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual',
      }),
    );
  },
};
