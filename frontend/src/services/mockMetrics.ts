import type { MetricsReport } from './contracts';

// Fixed illustrative evaluation; unrelated to the current user's edits or live traffic.
export const mockMetrics: MetricsReport = {
  generatedAt: '2026-10-23T09:00:00Z',
  period: { from: '2026-10-16T00:00:00Z', to: '2026-10-23T00:00:00Z' },
  modelVersion: 'demo-matcher-v1',
  dataset: 'Демонстрационный размеченный сабсет v1',
  labeledProducts: 240,
  matching: [
    { id: 'floor', name: 'Напольные покрытия', tp: 108, fp: 12, fn: 12 },
    { id: 'walls', name: 'Покрытия для стен', tp: 68, fp: 12, fn: 12 },
    { id: 'prep', name: 'Подготовка основания', tp: 30, fp: 10, fn: 10 },
  ],
  consumption: [
    { id: 'floor', name: 'Напольные покрытия', unit: 'упак.', samples: 80, absoluteError: 20 },
    { id: 'wallpaper', name: 'Обои', unit: 'рулон', samples: 40, absoluteError: 16 },
    { id: 'paint', name: 'Краска', unit: 'ведро', samples: 40, absoluteError: 8 },
  ],
  automation: { automatic: 864, eligible: 1200 },
  estimates: { completed: 180, totalSeconds: 432, p95Seconds: 4.8 },
  journey: { started: 250, completed: 180, totalClicks: 1080 },
  requests: { total: 2000, failed: 24 },
};
