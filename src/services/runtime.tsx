import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ArrowRight,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  Server,
  WifiOff,
} from 'lucide-react';
import { Logo, Modal, Toggle } from '../components';
import { createProject } from '../data';
import { createApi, normalizeBaseUrl } from './client';
import { roomWithCatalog } from './selection';
import {
  ApiError,
  type Bootstrap,
  type RepairApi,
  type RequestLog,
  type RuntimeSettings,
  type Workspace,
} from './contracts';

const settingsKey = 'repaircalc.runtime.v1';
function loadSettings(): RuntimeSettings {
  const defaults: RuntimeSettings = {
    mode: 'mock',
    baseUrl: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1',
    delay: 350,
    scenario: 'normal',
  };
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey) || 'null');
    if (
      value &&
      ['mock', 'http'].includes(value.mode) &&
      [0, 350, 1200].includes(value.delay) &&
      ['normal', 'ml-error', 'ml-empty'].includes(value.scenario)
    )
      return { ...value, baseUrl: normalizeBaseUrl(value.baseUrl) };
  } catch {
    /* A corrupted settings object returns to the explicit default mode. */
  }
  return defaults;
}
type Runtime = {
  api: RepairApi;
  settings: RuntimeSettings;
  updateSettings: (patch: Partial<RuntimeSettings>) => void;
  logs: RequestLog[];
  openSettings: () => void;
};
const RuntimeContext = createContext<Runtime | null>(null);
const BootstrapContext = createContext<Bootstrap | null>(null);
export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('RuntimeProvider missing');
  return value;
}
export function useBootstrap() {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error('Bootstrap missing');
  return value;
}

export function RuntimeRoot({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadSettings);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [open, setOpen] = useState(false);
  const log = useCallback(
    (entry: RequestLog) => setLogs((prev) => [entry, ...prev.filter((x) => x.id !== entry.id)].slice(0, 20)),
    [],
  );
  const api = useMemo(() => createApi(settings, log), [settings, log]);
  const updateSettings = useCallback(
    (patch: Partial<RuntimeSettings>) =>
      setSettings((current) => {
        const next = { ...current, ...patch };
        try {
          localStorage.setItem(settingsKey, JSON.stringify(next));
        } catch {
          /* Current session still changes mode. */
        }
        return next;
      }),
    [],
  );
  const value = useMemo(
    () => ({ api, settings, updateSettings, logs, openSettings: () => setOpen(true) }),
    [api, settings, updateSettings, logs],
  );
  return (
    <RuntimeContext.Provider value={value}>
      <WorkspaceBoundary key={`${settings.mode}:${settings.baseUrl}`}>{children}</WorkspaceBoundary>
      <button
        className={`test-mode-fab ${settings.mode}`}
        onClick={() => setOpen(true)}
        aria-label={`Тестовый режим: ${settings.mode === 'mock' ? 'MOCK' : 'NOT MOCK'}`}
      >
        <FlaskConical size={18} />
        <span>
          Тестовый режим<b>{settings.mode === 'mock' ? 'MOCK' : 'NOT MOCK'}</b>
        </span>
        <span className="mode-dot" />
      </button>
      {open && <SettingsDialog close={() => setOpen(false)} />}
    </RuntimeContext.Provider>
  );
}

function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const { api, settings, openSettings } = useRuntime();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    apiRef.current
      .bootstrap(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [retry]);
  if (!data || data.projects.length === 0)
    return (
      <div className="connection-screen">
        <div className="connection-brand">
          <Logo />
        </div>
        <section className="connection-card">
          <span className="connection-icon">
            {error ? (
              <WifiOff size={29} />
            ) : data ? (
              <FlaskConical size={29} />
            ) : (
              <LoaderCircle className="spin" size={29} />
            )}
          </span>
          <span className="ml-overline">
            {settings.mode === 'mock' ? 'MOCK · ЛОКАЛЬНЫЕ ДАННЫЕ' : 'NOT MOCK · СЕРВЕРНЫЕ ДАННЫЕ'}
          </span>
          <h1>
            {error
              ? 'Не удалось загрузить мастерскую'
              : data
                ? 'Место для первого проекта'
                : 'Открываем вашу мастерскую'}
          </h1>
          <p>
            {error ||
              (data
                ? 'Каталог загружен. Создайте проект, чтобы начать расчёт.'
                : settings.mode === 'http'
                  ? `Запрашиваем данные: ${settings.baseUrl}`
                  : 'Подготавливаем проекты и демонстрационный каталог.')}
          </p>
          {error ? (
            <div className="connection-actions">
              <button className="button primary" onClick={() => setRetry((v) => v + 1)}>
                <RefreshCw size={16} />
                Повторить
              </button>
              <button className="button secondary" onClick={openSettings}>
                Настройки подключения
              </button>
            </div>
          ) : (
            data && (
              <button
                className="button primary"
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    const project = createProject('Мой первый проект');
                    project.rooms = [roomWithCatalog(project.rooms[0], data.products)];
                    const result = await api.saveWorkspace(
                      { projects: [project], favorites: data.favorites },
                      new AbortController().signal,
                    );
                    setData({ ...data, ...result });
                  } catch (cause) {
                    setError((cause as Error).message);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                Создать первый проект <ArrowRight size={16} />
              </button>
            )
          )}
        </section>
      </div>
    );
  return <BootstrapContext.Provider value={data}>{children}</BootstrapContext.Provider>;
}

export function useQuery<T>(key: string, request: (signal: AbortSignal) => Promise<T>, delay = 0) {
  const { api } = useRuntime();
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(request);
  requestRef.current = request;
  const [state, setState] = useState<{
    key: string;
    api: RepairApi;
    status: 'loading' | 'success' | 'error';
    data?: T;
    error?: string;
  }>({ key, api, status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, api, status: 'loading' });
    const timer = setTimeout(
      () =>
        requestRef
          .current(controller.signal)
          .then((data) => {
            if (!controller.signal.aborted) setState({ key, api, status: 'success', data });
          })
          .catch((cause) => {
            if (!controller.signal.aborted) setState({ key, api, status: 'error', error: cause.message });
          }),
      delay,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, api, retry, delay]);
  const current = state.key === key && state.api === api ? state : { key, api, status: 'loading' as const };
  return { ...current, refresh: () => setRetry((v) => v + 1) };
}

export function useWorkspaceSave(value: Workspace, initial: Workspace) {
  const { api } = useRuntime();
  const signature = JSON.stringify(value);
  const committed = useRef(JSON.stringify({ projects: initial.projects, favorites: initial.favorites }));
  const latest = useRef(value);
  latest.current = value;
  const sequence = useRef(Promise.resolve());
  const generation = useRef(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ status: 'saved' | 'saving' | 'error'; error?: string }>({
    status: 'saved',
  });
  useEffect(() => {
    if (signature === committed.current) return;
    const version = ++generation.current;
    let alive = true;
    setState({ status: 'saving' });
    const payload = structuredClone(latest.current);
    // Serialize saves: an older HTTP request can never overwrite a newer edit.
    sequence.current = sequence.current
      .catch(() => {})
      .then(async () => {
        if (version !== generation.current) return;
        try {
          await api.saveWorkspace(payload, new AbortController().signal);
          committed.current = signature;
          if (alive && version === generation.current) setState({ status: 'saved' });
        } catch (cause) {
          if (alive && version === generation.current)
            setState({ status: 'error', error: (cause as Error).message });
        }
      });
    return () => {
      alive = false;
    };
  }, [signature, api, retry]);
  return { ...state, retry: () => setRetry((v) => v + 1) };
}

export function RequestState({
  loading,
  error,
  retry,
  label = 'Получаем результат',
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
  label?: string;
}) {
  if (!loading && !error) return null;
  return (
    <div className={`request-state ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'}>
      {error ? <AlertCircle size={18} /> : <LoaderCircle className="spin" size={18} />}
      <span>{error || label}</span>
      {error && retry && (
        <button className="text-button" onClick={retry}>
          Повторить <RefreshCw size={14} />
        </button>
      )}
    </div>
  );
}
export function SourceBadge() {
  const { settings } = useRuntime();
  return (
    <span className={`ml-source ${settings.mode}`}>
      {settings.mode === 'mock' ? 'MOCK · пример ответа' : 'API · ответ сервера'}
    </span>
  );
}

function SettingsDialog({ close }: { close: () => void }) {
  const { settings, updateSettings, logs } = useRuntime();
  const [url, setUrl] = useState(settings.baseUrl);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal title="Тестовый режим" close={close}>
      <div className="test-mode-summary">
        <FlaskConical size={23} />
        <div>
          <strong>{settings.mode === 'mock' ? 'Данные из заглушек' : 'Запросы к серверу'}</strong>
          <p>
            {settings.mode === 'mock'
              ? 'Весь фронтенд и ML-сценарии работают локально.'
              : 'Локальные ответы отключены. Ошибки сервера отображаются в интерфейсе.'}
          </p>
        </div>
      </div>
      <div className="test-toggle">
        <Toggle
          checked={settings.mode === 'mock'}
          onChange={() => updateSettings({ mode: settings.mode === 'mock' ? 'http' : 'mock' })}
          label="MOCK — использовать заглушки"
          description="Выключите, чтобы перейти в NOT MOCK"
        />
      </div>
      <form
        className="api-address-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const normalized = normalizeBaseUrl(url);
            updateSettings({ baseUrl: normalized });
            setUrl(normalized);
            setError('');
            setConfirmed(true);
          } catch (cause) {
            setError((cause as Error).message || 'Укажите корректный адрес API');
          }
        }}
      >
        <label className="form-field">
          <span>Адрес API</span>
          <input
            type="url"
            required
            value={url}
            placeholder="http://127.0.0.1:8000/api/v1"
            aria-invalid={!!error}
            onChange={(e) => {
              setUrl(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <button className="button secondary" type="submit">
          <Server size={15} />
          Применить адрес
        </button>
        {error && (
          <p className="ml-form-error" role="alert">
            {error}
          </p>
        )}
        {confirmed && (
          <p className="settings-confirmation" role="status">
            Адрес сохранён
          </p>
        )}
      </form>
      <div className="test-options">
        <label>
          Задержка заглушки
          <select
            aria-label="Задержка заглушки"
            value={settings.delay}
            onChange={(e) => updateSettings({ delay: Number(e.target.value) })}
            disabled={settings.mode !== 'mock'}
          >
            <option value={0}>Без задержки</option>
            <option value={350}>350 мс</option>
            <option value={1200}>1,2 секунды</option>
          </select>
        </label>
        <label>
          ML-сценарий
          <select
            aria-label="ML-сценарий"
            value={settings.scenario}
            onChange={(e) => updateSettings({ scenario: e.target.value as RuntimeSettings['scenario'] })}
            disabled={settings.mode !== 'mock'}
          >
            <option value="normal">Обычный ответ</option>
            <option value="ml-error">Ошибка ML-сервиса</option>
            <option value="ml-empty">Пустой результат</option>
          </select>
        </label>
      </div>
      <p className="settings-note">
        Переключение источника открывает его проекты заново. Моки и серверные данные не смешиваются.
        Автоматического возврата к мокам нет.
      </p>
      <div className="request-log">
        <h3>Последние запросы</h3>
        {logs.length ? (
          logs.slice(0, 6).map((item) => (
            <div key={item.id}>
              <span className={`log-status ${item.status}`} />
              <span>
                <b>
                  {item.method} {item.path}
                </b>
                <small>
                  {item.source === 'mock' ? 'MOCK' : 'NOT MOCK'} · {item.time}
                  {item.duration !== undefined ? ` · ${item.duration} мс` : ''}
                </small>
              </span>
              <em>
                {item.status === 'ok'
                  ? 'Готово'
                  : item.status === 'error'
                    ? 'Ошибка'
                    : item.status === 'cancelled'
                      ? 'Отменён'
                      : 'Запрос'}
              </em>
            </div>
          ))
        ) : (
          <p>Здесь появится история обращений.</p>
        )}
      </div>
    </Modal>
  );
}
