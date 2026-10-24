import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { matchingScores, ratio } from '../services/metrics';
import { RequestState, SourceBadge, useQuery, useRuntime } from '../services/runtime';

const format = (value: number | null, digits = 1) =>
  value === null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const score = (value: number | null) =>
  value === null
    ? '—'
    : value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const percent = (value: number | null) => (value === null ? '—' : `${format(value * 100)}%`);
const date = (value: string) => new Date(value).toLocaleDateString('ru-RU', { timeZone: 'UTC' });

function MetricCard({
  title,
  value,
  unit,
  children,
}: {
  title: string;
  value: string;
  unit?: string;
  children: ReactNode;
}) {
  return (
    <article className="admin-metric-card" aria-label={title}>
      <h3>{title}</h3>
      <div className="admin-metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {children}
    </article>
  );
}

export function SuccessMetrics() {
  const { api, settings } = useRuntime();
  const query = useQuery('admin-metrics', (signal) => api.metrics(signal));
  const report = query.data;
  const rows = report?.matching.map((row) => ({ ...row, ...matchingScores(row) })) || [];
  const complete = rows.length > 0 && rows.every((r) => r.f1 !== null);
  const minimum = complete ? Math.min(...rows.map((r) => r.f1!)) : null;
  const passed = rows.filter((r) => r.f1 !== null && r.f1 >= 0.8).length;
  const status = (f1: number | null) =>
    f1 === null ? 'Нет данных' : f1 >= 0.8 ? 'Цель достигнута' : 'Ниже цели';
  return (
    <div className="admin-metrics">
      <div className="admin-section-heading">
        <div>
          <h2>Метрики успеха</h2>
          <p>Качество рекомендаций, точность смет и путь клиента.</p>
        </div>
        <button className="button secondary" disabled={query.status === 'loading'} onClick={query.refresh}>
          <RefreshCw size={15} aria-hidden="true" />
          Обновить метрики
        </button>
      </div>
      <RequestState
        loading={query.status === 'loading'}
        error={query.error}
        retry={query.refresh}
        label="Загружаем метрики успеха…"
      />
      {report && (
        <>
          <dl className="admin-report-meta">
            <div>
              <dt>Период, UTC</dt>
              <dd>
                {date(report.period.from)} — {date(report.period.to)}
              </dd>
            </div>
            <div>
              <dt>Модель</dt>
              <dd>{report.modelVersion}</dd>
            </div>
            <div>
              <dt>Размеченный сабсет</dt>
              <dd>
                {report.dataset} · {format(report.labeledProducts, 0)} товаров
              </dd>
            </div>
            <div>
              <dt>Сформирован, UTC</dt>
              <dd>{new Date(report.generatedAt).toLocaleString('ru-RU', { timeZone: 'UTC' })}</dd>
            </div>
          </dl>
          <div className="admin-metric-grid">
            <MetricCard title="Качество матчинга" value={score(minimum)} unit="мин. F1">
              <span
                className={`admin-status ${minimum === null ? '' : minimum >= 0.8 ? 'good' : 'attention'}`}
              >
                {status(minimum)}
              </span>
              <p>
                Цель MVP: F1 ≥ 0,8 в каждой топ-категории. Порог пройден: {passed} из {rows.length}.
              </p>
            </MetricCard>
            <MetricCard
              title="Автоматические привязки"
              value={percent(ratio(report.automation.automatic, report.automation.eligible))}
            >
              <p>
                {format(report.automation.automatic, 0)} из {format(report.automation.eligible, 0)} товаров
                привязаны без ручной разметки.
              </p>
              <span className="admin-metric-goal">Цель: увеличивать долю при F1 ≥ 0,8</span>
            </MetricCard>
            <MetricCard
              title="Время формирования сметы"
              value={format(ratio(report.estimates.totalSeconds, report.estimates.completed))}
              unit="сек в среднем"
            >
              <p>
                P95: {format(report.estimates.p95Seconds)} сек · {format(report.estimates.completed, 0)}{' '}
                успешных расчётов.
              </p>
              <span className="admin-metric-goal">Цель: сокращать время</span>
            </MetricCard>
            <MetricCard
              title="Клики до готовой корзины"
              value={format(ratio(report.journey.totalClicks, report.journey.completed))}
              unit="в среднем"
            >
              <p>
                От выбора комнаты до готовой корзины · {format(report.journey.completed, 0)} завершённых
                сценариев.
              </p>
              <span className="admin-metric-goal">Цель: сокращать число кликов</span>
            </MetricCard>
          </div>

          <section className="panel admin-report-section" aria-labelledby="matching-quality-title">
            <div className="admin-section-heading">
              <div>
                <h3 id="matching-quality-title">Качество матчинга по топ-категориям</h3>
              </div>
            </div>
            {rows.length ? (
              <div
                className="admin-table-scroll"
                role="region"
                aria-label="Качество по категориям"
                tabIndex={0}
              >
                <table className="admin-table">
                  <caption>Связи «товар → вид работ». Каждая топ-категория проверяется отдельно.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Категория</th>
                      <th scope="col">Precision</th>
                      <th scope="col">Recall</th>
                      <th scope="col">F1</th>
                      <th scope="col">TP / FP / FN</th>
                      <th scope="col">Цель MVP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.name}</th>
                        <td>{score(row.precision)}</td>
                        <td>{score(row.recall)}</td>
                        <td>
                          <strong>{score(row.f1)}</strong>
                        </td>
                        <td>
                          {row.tp} / {row.fp} / {row.fn}
                        </td>
                        <td>
                          <span
                            className={`admin-status ${row.f1 === null ? '' : row.f1 >= 0.8 ? 'good' : 'attention'}`}
                          >
                            {status(row.f1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-empty">
                Нет размеченной выборки. Добавьте результаты оценки топ-категорий.
              </p>
            )}
          </section>

          <section className="panel admin-report-section" aria-labelledby="consumption-title">
            <div className="admin-section-heading">
              <div>
                <h3 id="consumption-title">Точность расчёта расхода</h3>
                <p>
                  MAE по количеству: среднее абсолютное отклонение от эталонных смет.
                </p>
              </div>
            </div>
            {report.consumption.length ? (
              <div className="admin-table-scroll" role="region" aria-label="Отклонение расхода" tabIndex={0}>
                <table className="admin-table">
                  <caption>Сравнение при одинаковых площади, запасе и единице продажи.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Материал</th>
                      <th scope="col">MAE</th>
                      <th scope="col">Единица</th>
                      <th scope="col">Строк эталонных смет</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.consumption.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.name}</th>
                        <td>
                          <strong>{format(ratio(row.absoluteError, row.samples), 2)}</strong>
                        </td>
                        <td>{row.unit}</td>
                        <td>{format(row.samples, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-empty">Нет эталонных смет для сравнения.</p>
            )}
          </section>

          <section className="panel admin-report-section" aria-labelledby="journey-title">
            <div className="admin-section-heading">
              <div>
                <h3 id="journey-title">Бизнес-прокси и UX</h3>
                <p>
                  Дополнительные показатели помогают объяснить потери между выбором комнаты и результатом.
                </p>
              </div>
            </div>
            <div className="admin-secondary-metrics">
              <MetricCard
                title="Завершённые сценарии"
                value={percent(ratio(report.journey.completed, report.journey.started))}
              >
                <p>
                  {format(report.journey.completed, 0)} готовых корзин из {format(report.journey.started, 0)}{' '}
                  начатых сценариев. Цель: увеличивать долю.
                </p>
              </MetricCard>
              <MetricCard
                title="Ошибки запросов"
                value={percent(ratio(report.requests.failed, report.requests.total))}
              >
                <p>
                  {format(report.requests.failed, 0)} ошибок из {format(report.requests.total, 0)} запросов
                  расчёта и ML. Цель: снижать долю.
                </p>
              </MetricCard>
            </div>
            <details className="admin-methodology">
              <summary>Как измерять и читать показатели</summary>
              <ul>
                <li>
                  Автоматическая привязка — товар принят без ручной разметки. Ручное подтверждение в
                  ML-мастерской не увеличивает этот показатель.
                </li>
                <li>
                  Время сметы — от запроса расчёта до готового ответа. P95 — время, в которое укладываются 95%
                  успешных расчётов.
                </li>
                <li>
                  UX — сумма кликов в завершённых сценариях / число этих сценариев. Начало: «выбрал комнату»,
                  конец: «готовая корзина». Незавершённые сценарии учитываются в доле завершения.
                </li>
                <li>
                  Готовая корзина должна подтверждаться отдельным событием интеграции с магазином. Просмотр
                  сметы и экспорт CSV не считаются корзиной.
                </li>
                <li>
                  Числовые цели для MAE, времени, кликов и дополнительных показателей пока не заданы. Их
                  согласуют после базового замера.
                </li>
                <li>
                  Прочерк означает отсутствие наблюдений, а не нулевую ошибку или достигнутую цель. Порог F1
                  проверяется до округления.
                </li>
              </ul>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
