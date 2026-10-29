import { ApiError, type MetricsReport } from './contracts';

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const count = (v: unknown): v is number => number(v) && Number.isSafeInteger(v);
const label = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const date = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const unique = (rows: { id: string }[]) => new Set(rows.map((r) => r.id)).size === rows.length;

export function decodeMetrics(v: unknown): MetricsReport {
  const invalid = () => {
    throw new ApiError(
      'Ответ сервера не соответствует контракту метрик. Проверьте данные отчёта.',
      'invalid',
    );
  };
  if (
    !object(v) ||
    !date(v.generatedAt) ||
    !object(v.period) ||
    !date(v.period.from) ||
    !date(v.period.to) ||
    Date.parse(v.period.from) > Date.parse(v.period.to) ||
    Date.parse(v.period.to) > Date.parse(v.generatedAt) ||
    !label(v.modelVersion) ||
    !label(v.dataset) ||
    !count(v.labeledProducts) ||
    !Array.isArray(v.matching) ||
    !v.matching.every(
      (r) => object(r) && label(r.id) && label(r.name) && count(r.tp) && count(r.fp) && count(r.fn),
    ) ||
    !Array.isArray(v.consumption) ||
    !v.consumption.every(
      (r) =>
        object(r) &&
        label(r.id) &&
        label(r.name) &&
        label(r.unit) &&
        count(r.samples) &&
        number(r.absoluteError) &&
        (r.samples > 0 || r.absoluteError === 0),
    ) ||
    !object(v.automation) ||
    !count(v.automation.automatic) ||
    !count(v.automation.eligible) ||
    v.automation.automatic > v.automation.eligible ||
    !object(v.estimates) ||
    !count(v.estimates.completed) ||
    !number(v.estimates.totalSeconds) ||
    !(v.estimates.p95Seconds === null || number(v.estimates.p95Seconds)) ||
    (v.estimates.completed === 0 && (v.estimates.totalSeconds !== 0 || v.estimates.p95Seconds !== null)) ||
    !object(v.journey) ||
    !count(v.journey.started) ||
    !count(v.journey.completed) ||
    !count(v.journey.totalClicks) ||
    v.journey.completed > v.journey.started ||
    (v.journey.completed === 0 && v.journey.totalClicks !== 0) ||
    !object(v.requests) ||
    !count(v.requests.total) ||
    !count(v.requests.failed) ||
    v.requests.failed > v.requests.total
  )
    return invalid();
  const report = v as MetricsReport;
  if (v.engagement !== undefined) {
    const e = v.engagement;
    if (
      !object(e) ||
      !(e.since === null || date(e.since)) ||
      !object(e.shares) ||
      !count(e.shares.total) ||
      !count(e.shares.visitors) ||
      e.shares.visitors > e.shares.total ||
      (e.shares.total > 0 && e.shares.visitors === 0) ||
      !object(e.ratings) ||
      !count(e.ratings.total) ||
      !Array.isArray(e.ratings.distribution) ||
      e.ratings.distribution.length !== 5 ||
      !e.ratings.distribution.every(count) ||
      e.ratings.distribution.reduce((sum: number, n: number) => sum + n, 0) !== e.ratings.total ||
      (e.shares.total + e.ratings.total === 0) !== (e.since === null)
    )
      return invalid();
  }
  if (
    !unique(report.matching) ||
    !unique(report.consumption) ||
    (report.labeledProducts === 0 && report.matching.some((r) => r.tp + r.fp + r.fn > 0))
  )
    return invalid();
  return report;
}

export const ratio = (value: number, total: number): number | null => (total > 0 ? value / total : null);
export function matchingScores(row: MetricsReport['matching'][number]) {
  return {
    precision: ratio(row.tp, row.tp + row.fp),
    recall: ratio(row.tp, row.tp + row.fn),
    f1: ratio(2 * row.tp, 2 * row.tp + row.fp + row.fn),
  };
}
