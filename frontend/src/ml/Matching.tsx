import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ClipboardCheck,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Modal, ProductVisual } from '../components';
import { roomTypes } from '../data';
import { workTypes, type Assignment } from '../services/contracts';
import { RequestState, SourceBadge, useBootstrap, useQuery, useRuntime } from '../services/runtime';

export function MatchingStudio() {
  const { api, settings } = useRuntime();
  const { products } = useBootstrap();
  const query = useQuery('assignments', (signal) => api.assignments(signal));
  const [overrides, setOverrides] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort();
    setOverrides([]);
    setSelected([]);
    setRunning(false);
    setError('');
    setMessage('');
    setEditing(null);
    return () => request.current?.abort();
  }, [api]);
  const assignments = (query.data || []).map((a) => overrides.find((o) => o.productId === a.productId) || a);
  // Newly classified catalogue items need not already have a saved assignment.
  overrides.forEach((a) => {
    if (!assignments.some((x) => x.productId === a.productId)) assignments.push(a);
  });
  const rows = products
    .filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase()))
    .filter(
      (p) =>
        filter === 'all' ||
        (assignments.find((a) => a.productId === p.id)?.status || 'unassigned') === filter,
    );
  const pending = assignments.filter((a) => a.status === 'pending');
  const approved = assignments.filter((a) => a.status === 'approved');
  async function classify() {
    if (!selected.length) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setRunning(true);
    setError('');
    setMessage('');
    try {
      const result = await api.classify(selected, controller.signal);
      if (!controller.signal.aborted) {
        setOverrides((previous) => [
          ...previous.filter((a) => !result.some((r) => r.productId === a.productId)),
          ...result,
        ]);
        setMessage(
          result.length
            ? `Получено предложений: ${result.length}. Проверьте их перед подтверждением.`
            : 'Новых предложений нет. Попробуйте выбрать другие товары.',
        );
        setSelected([]);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  }
  return (
    <>
      <div className="ml-metrics">
        <div>
          <span>Товаров в каталоге</span>
          <strong>{products.length.toString().padStart(2, '0')}</strong>
          <Layers3 size={20} />
        </div>
        <div>
          <span>Ожидают проверки</span>
          <strong>{pending.length.toString().padStart(2, '0')}</strong>
          <ClipboardCheck size={20} />
        </div>
        <div>
          <span>Подтверждено</span>
          <strong>{approved.length.toString().padStart(2, '0')}</strong>
          <CheckCheck size={20} />
        </div>
      </div>
      <div className="page-tools">
        <div className="search-box">
          <Search size={18} />
          <input
            placeholder="Найти товар для разметки"
            aria-label="Поиск товаров для разметки"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setOverrides([]);
            setSelected([]);
            query.refresh();
          }}
        >
          <RefreshCw size={15} />
          Обновить
        </button>
      </div>
      <div className="ml-studio-toolbar">
        <div className="ml-priorities" role="group" aria-label="Статус привязки">
          {[
            { id: 'all', label: 'Все' },
            { id: 'pending', label: 'На проверку' },
            { id: 'approved', label: 'Подтверждены' },
            { id: 'rejected', label: 'Отклонены' },
            { id: 'unassigned', label: 'Без привязки' },
          ].map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? 'active' : ''}
              aria-pressed={filter === item.id}
              onClick={() => {
                setFilter(item.id);
                setSelected([]);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className="button primary"
          disabled={!selected.length || running || query.status !== 'success'}
          onClick={classify}
        >
          {running ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}Сопоставить
          выбранные{selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
      </div>
      <RequestState
        loading={query.status === 'loading' || running}
        label={running ? 'Сопоставляем товары с видами работ и помещений…' : 'Загружаем привязки каталога…'}
        error={query.error || error}
        retry={query.error ? query.refresh : classify}
      />
      {message && (
        <p className="ml-operation-message" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      {query.status === 'success' && (
        <div className="ml-matching-table panel">
          <div className="ml-matching-head">
            <label className="ml-row-checkbox">
              <input
                type="checkbox"
                aria-label="Выбрать все видимые товары"
                checked={rows.length > 0 && rows.every((p) => selected.includes(p.id))}
                onChange={(e) => setSelected(e.target.checked ? rows.map((p) => p.id) : [])}
              />
              <span>Материал</span>
            </label>
            <span>Предложенные привязки</span>
            <span>Проверка</span>
          </div>
          {rows.map((product) => {
            const assignment = assignments.find((a) => a.productId === product.id);
            return (
              <div className="ml-matching-row" key={product.id}>
                <div className="ml-matching-product">
                  <input
                    type="checkbox"
                    aria-label={`Выбрать товар: ${product.name}`}
                    checked={selected.includes(product.id)}
                    onChange={(e) =>
                      setSelected((previous) =>
                        e.target.checked
                          ? [...previous, product.id]
                          : previous.filter((id) => id !== product.id),
                      )
                    }
                  />
                  <ProductVisual product={product} />
                  <div>
                    <small>{product.brand}</small>
                    <strong>{product.name}</strong>
                    <span>{product.id}</span>
                  </div>
                </div>
                <div className="ml-matching-assignment">
                  {assignment ? (
                    <>
                      <div>
                        {assignment.works.map((work) => (
                          <span className="ml-work-chip" key={work}>
                            {workTypes.find((w) => w.id === work)?.name}
                          </span>
                        ))}
                      </div>
                      <p>
                        {assignment.rooms
                          .map((room) => roomTypes.find((r) => r.id === room)?.name)
                          .join(', ')}
                      </p>
                    </>
                  ) : (
                    <p>Выберите товар и запустите сопоставление.</p>
                  )}
                </div>
                <div className="ml-matching-decision">
                  {assignment ? (
                    <>
                      <span className={`ml-status ${assignment.status}`}>
                        {assignment.status === 'approved' ? (
                          <>
                            <Check size={12} />
                            Подтверждено
                          </>
                        ) : assignment.status === 'rejected' ? (
                          <>
                            <X size={12} />
                            Отклонено
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            {Math.round(assignment.score * 100)}% соответствия
                          </>
                        )}
                      </span>
                      <button className="text-button" onClick={() => setEditing(assignment)}>
                        {assignment.status === 'pending' ? 'Проверить' : 'Изменить'}
                        <ArrowRight size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="ml-status">Без привязки</span>
                  )}
                </div>
              </div>
            );
          })}
          {!rows.length && (
            <div className="ml-empty">
              <Search size={25} />
              <h3>Товаров с таким условием нет</h3>
              <p>Измените поисковый запрос или статус.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      )}
      {editing && (
        <AssignmentDialog
          key={editing.productId}
          assignment={editing}
          close={() => setEditing(null)}
          saved={(next) => {
            setOverrides((previous) => [...previous.filter((a) => a.productId !== next.productId), next]);
            setEditing(null);
            setMessage(
              next.status === 'approved'
                ? 'Привязка подтверждена и сохранена.'
                : 'Предложение отклонено. Решение сохранено.',
            );
          }}
        />
      )}
    </>
  );
}

function AssignmentDialog({
  assignment,
  close,
  saved,
}: {
  assignment: Assignment;
  close: () => void;
  saved: (next: Assignment) => void;
}) {
  const { api } = useRuntime();
  const { products } = useBootstrap();
  const product = products.find((p) => p.id === assignment.productId)!;
  const [draft, setDraft] = useState(assignment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function save(status: Assignment['status']) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    try {
      const result = await api.saveAssignment({ ...draft, status }, request.signal);
      if (!request.signal.aborted) saved(result);
    } catch (cause) {
      if (!request.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  return (
    <Modal title="Проверить ML-привязку" close={close} wide>
      <div className="ml-assignment-detail">
        <ProductVisual product={product} />
        <div>
          <small>{product.brand}</small>
          <h2>{product.name}</h2>
          <p>{product.description}</p>
          <SourceBadge />
        </div>
      </div>
      <div className="ml-assignment-reason">
        <Sparkles size={18} />
        <div>
          <strong>Обоснование предложения, {Math.round(assignment.score * 100)}%</strong>
          <p>{assignment.explanation}</p>
        </div>
      </div>
      <div className="ml-assignment-fields">
        <fieldset>
          <legend>
            Виды работ <span>Можно выбрать несколько</span>
          </legend>
          {workTypes.map((work) => (
            <label key={work.id}>
              <input
                type="checkbox"
                checked={draft.works.includes(work.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    works: e.target.checked
                      ? [...draft.works, work.id]
                      : draft.works.filter((w) => w !== work.id),
                  })
                }
              />
              {work.name}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Подходящие помещения</legend>
          {roomTypes.map((room) => (
            <label key={room.id}>
              <input
                type="checkbox"
                checked={draft.rooms.includes(room.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rooms: e.target.checked
                      ? [...draft.rooms, room.id]
                      : draft.rooms.filter((r) => r !== room.id),
                  })
                }
              />
              {room.name}
            </label>
          ))}
        </fieldset>
      </div>
      {(!draft.works.length || !draft.rooms.length) && (
        <p className="ml-form-error">Для подтверждения выберите хотя бы один вид работ и одно помещение.</p>
      )}
      <RequestState error={error} />
      <div className="dialog-actions">
        <button className="button secondary" disabled={busy} onClick={() => save('rejected')}>
          <X size={15} />
          Отклонить
        </button>
        <button
          className="button primary"
          disabled={busy || !draft.works.length || !draft.rooms.length}
          onClick={() => save('approved')}
        >
          {busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}Подтвердить привязку
        </button>
      </div>
    </Modal>
  );
}
