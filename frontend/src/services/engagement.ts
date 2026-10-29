import type { EngagementEvent, EngagementMetrics } from './contracts';

let sessionVisitor: string | undefined;
// An anonymous browser identifier, not an account or a fingerprint.
export function visitorId(): string {
  try {
    const key = 'repaircalc.visitor.v1';
    const saved = localStorage.getItem(key);
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved)) return saved;
    const id = (sessionVisitor ??= crypto.randomUUID());
    localStorage.setItem(key, id);
    return id;
  } catch {
    return (sessionVisitor ??= crypto.randomUUID());
  }
}

export type StoredEvent = EngagementEvent & { createdAt: string };
export function summarizeEngagement(events: StoredEvent[]): EngagementMetrics {
  const shares = events.filter((e) => e.kind === 'share');
  const distribution = [0, 0, 0, 0, 0];
  for (const event of events) if (event.kind === 'rating') distribution[event.rating - 1]++;
  return {
    since: events.map((e) => e.createdAt).sort()[0] ?? null,
    shares: { total: shares.length, visitors: new Set(shares.map((e) => e.visitorId)).size },
    ratings: { total: distribution.reduce((a, b) => a + b, 0), distribution },
  };
}
