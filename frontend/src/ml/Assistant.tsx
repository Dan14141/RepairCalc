import { useEffect, useRef, useState } from 'react';
import { RatingPrompt } from './RatingPrompt';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Droplets,
  FileCheck2,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { DimensionInput, Modal, ProductVisual, RoomIcon, Toggle } from '../components';
import { area, money, number, roomTypes, type Product, type Project, type Room } from '../data';
import { type ParsedRoom, type Recommendation, type RecommendationInput } from '../services/contracts';
import { compatible } from '../services/selection';
import { RequestState, SourceBadge, useBootstrap, useQuery, useRuntime } from '../services/runtime';

type ApplyMaterial = (product: Product) => void;
export function SmartAssistant({
  project,
  room,
  selectRoom,
  addRoom,
  applyMaterial,
}: {
  project: Project;
  room: Room;
  selectRoom: (id: string) => void;
  addRoom: (draft: NonNullable<ParsedRoom['draft']>) => void;
  applyMaterial: ApplyMaterial;
}) {
  return (
    <>
      <section className="page-heading">
        <h1>
          У каждого решения
          <br />
          есть объяснение<span className="accent-dot">.</span>
        </h1>
        <p>Опишите пространство, проверьте детали и выберите материалы с понятным обоснованием.</p>
      </section>
      <div className="ml-journey">
        <span>
          <b>01</b>Понять задачу
        </span>
        <ArrowRight size={15} />
        <span>
          <b>02</b>Предложить решение
        </span>
        <ArrowRight size={15} />
        <span>
          <b>03</b>Оставить выбор вам
        </span>
      </div>
      <RoomBrief addRoom={addRoom} />
      <section className="ml-project-context">
        <div>
          <h2>{project.name}</h2>
          <span className="ml-overline">Текущий проект</span>
        </div>
        <label>
          <span>Подобрать для</span>
          <select
            aria-label="Комната для рекомендаций"
            value={room.id}
            onChange={(e) => selectRoom(e.target.value)}
          >
            {project.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {number(area(r))} м²
              </option>
            ))}
          </select>
        </label>
      </section>
      <Recommendations room={room} reserve={project.reserve} applyMaterial={applyMaterial} />
    </>
  );
}

export function RoomBrief({
  addRoom,
  compact = false,
}: {
  addRoom: (draft: NonNullable<ParsedRoom['draft']>) => void;
  compact?: boolean;
}) {
  const { api } = useRuntime();
  const [expanded, setExpanded] = useState(!compact);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ParsedRoom | null>(null);
  const [review, setReview] = useState<NonNullable<ParsedRoom['draft']> | null>(null);
  const [applied, setApplied] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort();
    setState('idle');
    setResult(null);
    setReview(null);
    setApplied(false);
    return () => request.current?.abort();
  }, [api]);
  function editText(value: string) {
    request.current?.abort();
    setText(value);
    setState('idle');
    setResult(null);
    setReview(null);
    setApplied(false);
  }
  async function analyze() {
    if (!text.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState('loading');
    setResult(null);
    setReview(null);
    setApplied(false);
    setError('');
    try {
      const next = await api.parseRoom(text.trim(), controller.signal);
      if (!controller.signal.aborted) {
        setResult(next);
        setReview(next.draft);
        setState('success');
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setState('error');
        setError((cause as Error).message);
      }
    }
  }
  return (
    <section className={`ml-brief panel ${compact ? 'compact' : ''}`}>
      <div className="ml-section-heading">
        <span className="ml-icon">
          <Sparkles size={21} />
        </span>
        <div>
          <h2>Расскажите о вашей комнате</h2>
          <p>Превратим описание в параметры для расчёта.</p>
        </div>
        {compact ? (
          <button
            className="button secondary"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Свернуть' : 'Описать комнату'}
            <ChevronDown size={15} />
          </button>
        ) : (
          <SourceBadge />
        )}
      </div>
      {expanded && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void analyze();
            }}
          >
            <label className="ml-prompt-label" htmlFor="room-description">
              Назначение, размеры и особенности
            </label>
            <div className="ml-prompt">
              <textarea
                id="room-description"
                maxLength={2000}
                rows={3}
                placeholder="Например: санузел 6 м², потолок 2,7 м, высокая влажность. Хочу светлую плитку."
                value={text}
                onChange={(e) => editText(e.target.value)}
              />
              <div>
                <span>{text.length}/2000</span>
                <button
                  type="submit"
                  className="button primary"
                  disabled={!text.trim() || state === 'loading'}
                >
                  {state === 'loading' ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
                  Разобрать описание
                </button>
              </div>
            </div>
          </form>
          <div className="ml-example-chips">
            <span>Попробуйте</span>
            {[
              'Санузел 6 м², высокая влажность',
              'Кухня 4 × 3 м, потолок 2,8 м',
              'Детская 18 м², есть собака',
            ].map((example) => (
              <button key={example} onClick={() => editText(example)}>
                {example}
              </button>
            ))}
          </div>
          <RequestState
            loading={state === 'loading'}
            label="Выделяем параметры и отмечаем, что нужно уточнить…"
            error={state === 'error' ? error : undefined}
            retry={analyze}
          />
          {result && !review && (
            <div className="ml-clarification" role="status">
              <Lightbulb size={20} />
              <div>
                <strong>Нужно немного больше деталей</strong>
                <p>{result.clarification || 'Дополните описание или введите размеры вручную.'}</p>
              </div>
            </div>
          )}
          {result && review && (
            <div className="ml-review">
              <div className="ml-review-header">
                <FileCheck2 size={20} />
                <div>
                  <h3>Проверьте, всё ли верно</h3>
                  <p>Эти параметры попадут в проект только после вашего подтверждения.</p>
                </div>
                <SourceBadge />
              </div>
              <div className="ml-extracted">
                {result.extracted.map((item, i) => (
                  <span key={i}>
                    <Check size={12} />
                    {item}
                  </span>
                ))}
              </div>
              <div className="ml-review-fields">
                <label className="form-field">
                  <span>Название комнаты</span>
                  <input
                    aria-label="Распознанное название комнаты"
                    maxLength={60}
                    value={review.name}
                    onChange={(e) => {
                      setReview({ ...review, name: e.target.value });
                      setApplied(false);
                    }}
                  />
                </label>
                <DimensionInput
                  label="Распознанная длина"
                  value={review.length}
                  onChange={(length) => {
                    setReview({ ...review, length });
                    setApplied(false);
                  }}
                />
                <DimensionInput
                  label="Распознанная ширина"
                  value={review.width}
                  onChange={(width) => {
                    setReview({ ...review, width });
                    setApplied(false);
                  }}
                />
                <DimensionInput
                  label="Распознанная высота"
                  value={review.height}
                  min={2}
                  max={6}
                  onChange={(height) => {
                    setReview({ ...review, height });
                    setApplied(false);
                  }}
                />
              </div>
              <div className="ml-review-toggles">
                <Toggle
                  label="Повышенная влажность"
                  checked={review.wet}
                  onChange={() => {
                    setReview({ ...review, wet: !review.wet });
                    setApplied(false);
                  }}
                />
                <Toggle
                  label="Высокая нагрузка"
                  checked={review.heavy}
                  onChange={() => {
                    setReview({ ...review, heavy: !review.heavy });
                    setApplied(false);
                  }}
                />
              </div>
              {result.assumptions.length > 0 && (
                <div className="ml-assumptions">
                  <Lightbulb size={18} />
                  <div>
                    <strong>Что принято за вас</strong>
                    <ul>
                      {result.assumptions.map((assumption, i) => (
                        <li key={i}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="ml-review-footer">
                <span>
                  {number(review.length * review.width)} м²,{' '}
                  {roomTypes.find((t) => t.id === review.type)?.name}
                </span>
                <button
                  className="button primary"
                  disabled={!review.name.trim() || applied}
                  onClick={() => {
                    try {
                      addRoom({ ...review, name: review.name.trim() });
                      setApplied(true);
                    } catch (cause) {
                      setError((cause as Error).message);
                      setState('error');
                    }
                  }}
                >
                  {applied ? (
                    <>
                      <Check size={16} />
                      Добавлено в проект
                    </>
                  ) : (
                    <>
                      Добавить в проект
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function Recommendations({
  room,
  reserve,
  applyMaterial,
  compact = false,
}: {
  room: Room;
  reserve: number;
  applyMaterial: ApplyMaterial;
  compact?: boolean;
}) {
  const { api, settings } = useRuntime();
  const { products } = useBootstrap();
  const [priority, setPriority] = useState<RecommendationInput['priority']>('balanced');
  const [explanation, setExplanation] = useState<Recommendation | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const input = { room, reserve, priority };
  const query = useQuery(
    `recommendations:${JSON.stringify(input)}`,
    (signal) => api.recommendations(input, signal),
    120,
  );
  useEffect(() => {
    setExplanation(null);
    setExpanded(null);
  }, [
    room.id,
    api,
    room.wet,
    room.heavy,
    room.length,
    room.width,
    room.height,
    room.windows,
    room.doors,
    reserve,
    priority,
  ]);
  return (
    <section className={`ml-recommendations ${compact ? 'compact' : ''}`}>
      <div className="ml-section-heading">
        <span className="ml-icon">
          <Sparkles size={21} />
        </span>
        <div>
          <h2>ML-подбор для вашего пространства</h2>
          <p>Подходящие покрытия, причины выбора и честные ограничения.</p>
        </div>
        <SourceBadge />
      </div>
      <div className="ml-recommend-controls">
        <div className="ml-room-context">
          <RoomIcon type={room.type} size={18} />
          <strong>{room.name}</strong>
          <span>{number(area(room))} м²</span>
          {room.wet && (
            <span>
              <Droplets size={13} />
              Влажно
            </span>
          )}
          {room.heavy && (
            <span>
              <ShieldCheck size={13} />
              Нагрузка
            </span>
          )}
        </div>
        <div className="ml-priorities" role="group" aria-label="Приоритет подбора">
          {(
            [
              { id: 'balanced', label: 'Баланс' },
              { id: 'budget', label: 'Экономия' },
              { id: 'durability', label: 'Износостойкость' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              className={priority === p.id ? 'active' : ''}
              aria-pressed={priority === p.id}
              onClick={() => setPriority(p.id)}
            >
              {p.label}
            </button>
          ))}
          <button className="ml-refresh" aria-label="Обновить ML-рекомендации" onClick={query.refresh}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>
      <RequestState
        loading={query.status === 'loading'}
        label="Сопоставляем материалы с условиями комнаты…"
        error={query.error}
        retry={query.refresh}
      />
      {query.data && (
        <>
          <p className="ml-summary">{query.data.summary}</p>
          {query.data.groups.length === 0 && (
            <div className="ml-empty">
              <Lightbulb size={23} />
              <h3>Подбор пока пуст</h3>
              <p>Уточните условия комнаты или выберите материал вручную. Текущая смета сохранена.</p>
              <button className="button secondary" onClick={query.refresh}>
                Повторить подбор <RefreshCw size={14} />
              </button>
            </div>
          )}
          <div className="ml-recommendation-grid">
            {query.data.groups.map((group) => {
              const candidates = group.candidates.filter((c) =>
                products.some(
                  (p) => p.id === c.productId && p.category === group.category && compatible(p, room),
                ),
              );
              const top = candidates[0];
              const product = top && products.find((p) => p.id === top.productId);
              if (!top || !product)
                return (
                  <div className="ml-empty panel" key={group.category}>
                    <h3>{group.category === 'floor' ? 'Напольное покрытие' : 'Отделка стен'}</h3>
                    <p>
                      В ответе нет доступного материала, подходящего текущим условиям. Попробуйте обновить
                      подбор.
                    </p>
                  </div>
                );
              const selected = (group.category === 'floor' ? room.floor : room.wall) === product.id;
              return (
                <article className="ml-recommendation panel" key={group.category}>
                  <div className="ml-card-top">
                    <span className="ml-overline">
                      {group.category === 'floor' ? 'Для пола' : 'Для стен'}
                    </span>
                    <span className="ml-score">
                      <Sparkles size={12} />
                      {Math.round(top.score * 100)}% соответствия
                    </span>
                  </div>
                  <div className="ml-recommended-product">
                    <ProductVisual product={product} />
                    <div>
                      <small>{product.brand}</small>
                      <h3>{product.name}</h3>
                      <strong>
                        {money(top.total)}{' '}
                        <span>
                          за {top.quantity} {product.unit}
                        </span>
                      </strong>
                    </div>
                  </div>
                  <ul className="ml-reasons">
                    {top.reasons.map((reason, i) => (
                      <li key={i}>
                        <Check size={13} />
                        {reason}
                      </li>
                    ))}
                  </ul>
                  <button className="ml-explanation-link" onClick={() => setExplanation(top)}>
                    <BookOpen size={14} />
                    Почему этот материал?
                    <ArrowRight size={14} />
                  </button>
                  <div className="ml-card-actions">
                    <button
                      className={`button ${selected ? 'secondary' : 'primary'}`}
                      disabled={selected}
                      onClick={() => applyMaterial(product)}
                    >
                      {selected ? (
                        <>
                          <Check size={14} />В вашей смете
                        </>
                      ) : (
                        <>
                          Выбрать материал
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                    {candidates.length > 1 && (
                      <button
                        className="text-button"
                        aria-expanded={expanded === group.category}
                        onClick={() => setExpanded(expanded === group.category ? null : group.category)}
                      >
                        Ещё {candidates.length - 1}
                        <ChevronDown size={14} />
                      </button>
                    )}
                  </div>
                  {expanded === group.category && (
                    <div className="ml-alternatives">
                      {candidates.slice(1).map((candidate) => {
                        const alternative = products.find((p) => p.id === candidate.productId)!;
                        return (
                          <div key={candidate.productId}>
                            <ProductVisual product={alternative} />
                            <div>
                              <strong>{alternative.name}</strong>
                              <small>
                                {money(candidate.total)}, {Math.round(candidate.score * 100)}%
                              </small>
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`Выбрать альтернативу: ${alternative.name}`}
                              onClick={() => applyMaterial(alternative)}
                            >
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {query.data.excluded.length > 0 && (
            <details className="ml-exclusions">
              <summary>
                Почему исключены другие материалы <span>{query.data.excluded.length}</span>
                <ChevronDown size={14} />
              </summary>
              <ul>
                {query.data.excluded.map((item) => (
                  <li key={item.productId}>
                    <X size={13} />
                    <strong>{products.find((p) => p.id === item.productId)?.name || item.productId}</strong>
                    <span>{item.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {explanation && (
        <Modal title="Почему этот материал" close={() => setExplanation(null)}>
          <div className="ml-explanation-heading">
            <Sparkles size={20} />
            <h3>{products.find((p) => p.id === explanation.productId)?.name}</h3>
          </div>
          <SourceBadge />
          <div className="ml-evidence">
            {explanation.evidence.map((source, i) => (
              <article key={i}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{source.title}</h3>
                  <p>{source.excerpt}</p>
                  <small>{source.source}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="ml-assumptions">
            <Lightbulb size={18} />
            <div>
              <strong>Что ещё учесть</strong>
              <p>{explanation.tradeoff}</p>
            </div>
          </div>
        </Modal>
      )}
      {compact && (
        <RatingPrompt
          available={
            !!query.data?.groups.some((group) =>
              group.candidates.some((candidate) =>
                products.some(
                  (product) =>
                    product.id === candidate.productId &&
                    product.category === group.category &&
                    compatible(product, room),
                ),
              ),
            )
          }
        />
      )}
    </section>
  );
}
