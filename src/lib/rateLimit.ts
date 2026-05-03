const requests = new Map<string, number[]>();
const MAX_ENTRIES = 10000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (requests.size > MAX_ENTRIES) {
    const cutoff = now - windowMs * 2;
    for (const [k, timestamps] of requests) {
      if (timestamps[timestamps.length - 1] < cutoff) requests.delete(k);
    }
  }

  const timestamps = requests.get(key) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= limit) {
    return { success: false, remaining: 0 };
  }

  recent.push(now);
  requests.set(key, recent);
  return { success: true, remaining: limit - recent.length };
}
