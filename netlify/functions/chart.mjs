import { chart, cached } from '../../lib/market.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'GET 요청만 지원합니다.' }, { status: 405, headers: { Allow: 'GET' } });
  }
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase();
  const date = url.searchParams.get('date');
  if (!/^[a-z\d][a-z\d.\-]{0,19}$/i.test(symbol) ||
      (date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date))) {
    return Response.json({ error: '종목 코드와 날짜를 확인해 주세요.' }, { status: 400 });
  }
  try {
    const result = await cached('c:' + symbol + ':' + date,45000,() => chart(symbol,date));
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}
