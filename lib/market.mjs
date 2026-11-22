const aliases = [
  ['005930.KS','삼성전자'], ['000660.KS','SK하이닉스'], ['035420.KS','네이버'],
  ['035720.KS','카카오'], ['005380.KS','현대차'], ['000270.KS','기아'],
  ['373220.KS','LG에너지솔루션'], ['207940.KS','삼성바이오로직스'],
  ['068270.KS','셀트리온'], ['247540.KQ','에코프로비엠'], ['086520.KQ','에코프로'],
  ['AAPL','애플'], ['TSLA','테슬라'], ['NVDA','엔비디아'], ['MSFT','마이크로소프트'],
  ['AMZN','아마존'], ['GOOGL','알파벳 구글'], ['META','메타'], ['AMD','AMD'],
  ['PLTR','팔란티어'], ['SPY','SPDR S&P 500 ETF'], ['QQQ','인베스코 나스닥 100 ETF'],
];
const normalize = value => value.toLowerCase().replace(/\s/g,'');

async function yahoo(path, params) {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const response = await fetch('https://' + host + path + '?' + new URLSearchParams(params), {
        headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' },
        signal: AbortSignal.timeout(6500)
      });
      if (response.status === 404) return null;
      if (response.ok) return await response.json();
    } catch {}
  }
  throw new Error('시세 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
}

async function search(query) {
  const term = normalize(query);
  const results = new Map();
  for (const [symbol,name] of aliases) {
    if (normalize(name).includes(term) || normalize(symbol).startsWith(term))
      results.set(symbol,{ symbol,name });
  }
  if (results.size && [...results.values()].some(({ symbol,name }) =>
    [normalize(symbol),normalize(symbol.split('.')[0]),normalize(name)].includes(term))) {
    return [...results.values()];
  }
  try {
    const result = await yahoo('/v1/finance/search', { q: query, quotesCount: '12', newsCount: '0', lang: 'ko-KR' });
    for (const quote of result?.quotes ?? []) {
      if (!['EQUITY','ETF'].includes(quote.quoteType) || results.has(quote.symbol)) continue;
      results.set(quote.symbol,{ symbol: quote.symbol, name: quote.shortname || quote.longname || quote.symbol });
    }
  } catch (error) {
    if (!results.size && !/^[a-z\d][a-z\d.\-]{0,19}$/i.test(query)) throw error;
  }
  if (/^\d{6}$/.test(query)) {
    for (const suffix of ['KS','KQ']) {
      const symbol = query + '.' + suffix;
      if (!results.has(symbol)) results.set(symbol,{ symbol,name: symbol });
    }
  } else if (!results.size && /^[a-z\d][a-z\d.\-]{0,19}$/i.test(query)) {
    const symbol = query.toUpperCase();
    results.set(symbol,{ symbol,name: symbol });
  }
  return [...results.values()].slice(0,12);
}

async function chart(symbol, date) {
  if (!/^[a-z\d][a-z\d.\-]{0,19}$/i.test(symbol)) throw new Error('종목 코드를 확인해 주세요.');
  const params = date
    ? { interval: '5m', period1: String(Date.parse(date + 'T00:00:00Z') / 1000 - 86400),
        period2: String(Math.min(Math.floor(Date.now() / 1000),Date.parse(date + 'T00:00:00Z') / 1000 + 172800)) }
    : { interval: '1d', range: 'max' };
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Number(params.period1))))
    throw new Error('조회 날짜를 확인해 주세요.');
  const result = (await yahoo('/v8/finance/chart/' + encodeURIComponent(symbol), params))?.chart?.result?.[0];
  if (!result) throw new Error(date ? '해당 날짜의 5분봉을 조회할 수 없습니다.' : '종목의 시세를 찾을 수 없습니다.');
  const { meta, timestamp = [], indicators } = result;
  const close = indicators?.quote?.[0]?.close ?? [];
  return {
    symbol: meta.symbol, name: meta.longName || meta.shortName || symbol,
    timezone: meta.exchangeTimezoneName, currency: meta.currency,
    latest: meta.regularMarketPrice, latestTime: meta.regularMarketTime,
    points: timestamp.flatMap((time,index) => Number.isFinite(close[index]) && close[index] > 0 ? [[time,close[index]]] : [])
  };
}

const cache = new Map();
async function cached(key, ttl, action) {
  const entry = cache.get(key);
  if (entry && entry.until > Date.now()) return entry.value;
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  const value = Promise.resolve().then(action);
  const next = { until: Date.now() + ttl, value };
  cache.set(key,next);
  try { return await value; }
  catch (error) { if (cache.get(key) === next) cache.delete(key); throw error; }
}


export { search, chart, cached };