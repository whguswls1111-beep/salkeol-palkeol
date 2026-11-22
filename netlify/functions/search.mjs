import { search, cached } from '../../lib/market.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'GET 요청만 지원합니다.' }, { status: 405, headers: { Allow: 'GET' } });
  }
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0,80);
  try {
    const result = query ? await cached('s:' + query,300000,() => search(query)) : [];
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}
