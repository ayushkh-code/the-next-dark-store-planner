const COUNTERAPI_NAMESPACE = 'ayushkhaitan';
const COUNTERAPI_NAME = 'dark-store-planner-visits';

async function incrementViaCounterApi() {
  const res = await fetch(
    `https://api.counterapi.dev/v1/${COUNTERAPI_NAMESPACE}/${COUNTERAPI_NAME}/up`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) {
    throw new Error(`counterapi responded ${res.status}`);
  }
  const data = await res.json();
  if (typeof data.count !== 'number') {
    throw new Error('counterapi returned invalid payload');
  }
  return data.count;
}

async function incrementCount() {
  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );

  if (hasUpstash) {
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();
    return redis.incr('dark-store-planner:visitor-count');
  }

  return incrementViaCounterApi();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const count = await incrementCount();
    return res.status(200).json({ count });
  } catch {
    return res.status(503).json({ count: null, error: 'unavailable' });
  }
}
