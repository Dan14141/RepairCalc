import { roomTypes, type Product, type Project } from '../data';
import {
  ApiError,
  workTypes,
  type RepairApi,
  type RuntimeSettings,
  type RequestLog,
  type Bootstrap,
  type Assignment,
  type Estimate,
  type ParsedRoom,
  type RecommendationResult,
  type ProductCalculation,
  type Workspace,
  type CatalogPage,
} from './contracts';
import { mockRequest } from './mock';
import { decodeMetrics } from './metrics';

const invalid = () => {
  throw new ApiError(
    'Ответ сервера не соответствует контракту API. Проверьте структуру данных и адрес сервера.',
    'invalid',
  );
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const whole = (v: unknown) => nonnegative(v) && Number.isInteger(v);
function isProduct(v: unknown): v is Product {
  return (
    object(v) &&
    ['id', 'name', 'brand', 'unit', 'color', 'texture', 'rating', 'description'].every(
      (k) => typeof v[k] === 'string',
    ) &&
    ['floor', 'walls', 'prep', 'electric', 'other'].includes(String(v.category)) &&
    nonnegative(v.price) &&
    nonnegative(v.coverage) &&
    typeof v.wet === 'boolean' &&
    typeof v.heavy === 'boolean'
  );
}
function isRoom(v: unknown): boolean {
  return (
    object(v) &&
    typeof v.name === 'string' &&
    roomTypes.some((t) => t.id === v.type) &&
    ['length', 'width'].every((k) => nonnegative(v[k]) && v[k] >= 0.5 && v[k] <= 30) &&
    nonnegative(v.height) &&
    v.height >= 2 &&
    v.height <= 6 &&
    ['windows', 'doors'].every((k) => whole(v[k]) && Number(v[k]) <= 10) &&
    typeof v.wet === 'boolean' &&
    typeof v.heavy === 'boolean'
  );
}
function isProject(v: unknown): v is Project {
  return (
    object(v) &&
    ['id', 'name', 'updatedAt'].every((k) => typeof v[k] === 'string') &&
    ['Квартира', 'Дом', 'Студия'].includes(String(v.object)) &&
    ['Косметический', 'Капитальный', 'Дизайнерский'].includes(String(v.repair)) &&
    [5, 10, 15].includes(Number(v.reserve)) &&
    typeof v.labor === 'boolean' &&
    Array.isArray(v.rooms) &&
    v.rooms.length > 0 &&
    v.rooms.every(
      (r) => isRoom(r) && object(r) && ['id', 'floor', 'wall'].every((k) => typeof r[k] === 'string'),
    )
  );
}
export function decodeWorkspace(v: unknown): Workspace {
  if (!object(v) || !Array.isArray(v.projects) || !v.projects.every(isProject) || !strings(v.favorites))
    return invalid();
  if (new Set(v.projects.map((p) => p.id)).size !== v.projects.length) return invalid();
  return v as Workspace;
}
export function decodeBootstrap(v: unknown): Bootstrap {
  const workspace = decodeWorkspace(v);
  if (
    !object(v) ||
    !Array.isArray(v.products) ||
    !v.products.every(isProduct) ||
    (v.catalogTotal !== undefined && !whole(v.catalogTotal)) ||
    !strings(v.regions) ||
    !Array.isArray(v.guides) ||
    !v.guides.every(
      (g) => object(g) && ['title', 'tag', 'time', 'text'].every((k) => typeof g[k] === 'string'),
    )
  )
    return invalid();
  const catalog = v.products;
  if (
    new Set(catalog.map((p) => p.id)).size !== catalog.length ||
    workspace.projects.some((p) =>
      p.rooms.some(
        (r) =>
          !catalog.some((t) => t.id === r.floor && t.category === 'floor') ||
          !catalog.some((t) => t.id === r.wall && t.category === 'walls'),
      ),
    )
  )
    return invalid();
  return v as Bootstrap;
}
function decodeEstimate(v: unknown): Estimate {
  if (
    !object(v) ||
    !['materials', 'labor', 'total', 'totalArea'].every((k) => nonnegative(v[k])) ||
    (v.warnings !== undefined && !strings(v.warnings)) ||
    !Array.isArray(v.items) ||
    !v.items.every(
      (r) =>
        object(r) &&
        isProduct(r.product) &&
        whole(r.quantity) &&
        nonnegative(r.cost) &&
        strings(r.rooms) &&
        nonnegative(r.surface),
    ) ||
    !Array.isArray(v.categories) ||
    !v.categories.every(
      (c) =>
        object(c) &&
        ['floor', 'walls', 'prep', 'electric'].includes(String(c.id)) &&
        typeof c.name === 'string' &&
        typeof c.color === 'string' &&
        nonnegative(c.total),
    )
  )
    return invalid();
  return v as Estimate;
}
function decodeRecommendations(v: unknown): RecommendationResult {
  if (!object(v) || typeof v.summary !== 'string' || !Array.isArray(v.groups) || !Array.isArray(v.excluded))
    return invalid();
  if (
    !v.groups.every(
      (g) =>
        object(g) &&
        ['floor', 'walls'].includes(String(g.category)) &&
        Array.isArray(g.candidates) &&
        g.candidates.every(
          (c) =>
            object(c) &&
            typeof c.productId === 'string' &&
            nonnegative(c.score) &&
            c.score <= 1 &&
            strings(c.reasons) &&
            typeof c.tradeoff === 'string' &&
            whole(c.quantity) &&
            nonnegative(c.total) &&
            Array.isArray(c.evidence) &&
            c.evidence.every(
              (e) => object(e) && ['title', 'excerpt', 'source'].every((k) => typeof e[k] === 'string'),
            ),
        ),
    ) ||
    !v.excluded.every((x) => object(x) && typeof x.productId === 'string' && typeof x.reason === 'string')
  )
    return invalid();
  return v as RecommendationResult;
}
function decodeParsedRoom(v: unknown): ParsedRoom {
  if (
    !object(v) ||
    !(v.draft === null || isRoom(v.draft)) ||
    !strings(v.extracted) ||
    !strings(v.assumptions) ||
    !(v.clarification === null || typeof v.clarification === 'string')
  )
    return invalid();
  return v as ParsedRoom;
}
function isAssignment(v: unknown): v is Assignment {
  return (
    object(v) &&
    typeof v.productId === 'string' &&
    typeof v.explanation === 'string' &&
    strings(v.works) &&
    v.works.every((w) => workTypes.some((t) => t.id === w)) &&
    strings(v.rooms) &&
    v.rooms.every((r) => roomTypes.some((t) => t.id === r)) &&
    nonnegative(v.score) &&
    v.score <= 1 &&
    ['pending', 'approved', 'rejected'].includes(String(v.status))
  );
}
function decodeAssignments(v: unknown): Assignment[] {
  if (!Array.isArray(v) || !v.every(isAssignment)) return invalid();
  return v;
}
function decodeProductCalc(v: unknown): ProductCalculation {
  if (!object(v) || !whole(v.quantity) || !nonnegative(v.total) || typeof v.unit !== 'string')
    return invalid();
  return v as ProductCalculation;
}

export function normalizeBaseUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Укажите HTTP(S)-адрес API без пароля, параметров и якоря.');
  return url.href.replace(/\/$/, '');
}
export function createApi(settings: RuntimeSettings, log: (entry: RequestLog) => void): RepairApi {
  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    signal: AbortSignal,
    decode: (v: unknown) => T,
  ): Promise<T> {
    const start = performance.now();
    const entry: RequestLog = {
      id: crypto.randomUUID(),
      method,
      path,
      source: settings.mode,
      status: 'pending',
      time: new Date().toLocaleTimeString('ru-RU'),
    };
    log(entry);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) controller.abort();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);
    try {
      let value: unknown;
      if (settings.mode === 'mock') value = await mockRequest(path, body, settings, controller.signal);
      else {
        const response = await fetch(`${settings.baseUrl}${path}`, {
          method,
          signal: controller.signal,
          credentials: 'omit',
          headers:
            body === undefined
              ? { Accept: 'application/json' }
              : { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok)
          throw new ApiError(
            `Сервер вернул ошибку ${response.status}. Проверьте доступность API и повторите запрос.`,
            'http',
          );
        try {
          value = await response.json();
        } catch {
          throw new ApiError(
            'Сервер вернул не JSON. Проверьте адрес API: он не должен вести на HTML-страницу.',
            'invalid',
          );
        }
      }
      if (controller.signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
      const result = decode(value);
      log({ ...entry, status: 'ok', duration: Math.round(performance.now() - start) });
      return result;
    } catch (cause) {
      const error = timedOut
        ? new ApiError('Сервер не ответил за 8 секунд. Проверьте адрес и повторите запрос.', 'timeout')
        : controller.signal.aborted
          ? new DOMException('Запрос отменён', 'AbortError')
          : cause instanceof ApiError
            ? cause
            : new ApiError(
                'Не удалось связаться с сервером. Проверьте адрес API, соединение и настройки CORS на сервере.',
                'network',
              );
      log({
        ...entry,
        status: error.name === 'AbortError' ? 'cancelled' : 'error',
        message: error.message,
        duration: Math.round(performance.now() - start),
      });
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
  return {
    catalog: (params, signal) =>
      request('GET', `/catalog?${params}`, undefined, signal, (v): CatalogPage => {
        if (
          !object(v) ||
          !Array.isArray(v.products) ||
          !v.products.every(isProduct) ||
          !whole(v.total) ||
          !whole(v.page) ||
          !whole(v.size)
        )
          return invalid();
        return v as CatalogPage;
      }),
    metrics: (signal) => request('GET', '/admin/metrics', undefined, signal, decodeMetrics),
    bootstrap: (signal) => request('GET', '/bootstrap', undefined, signal, decodeBootstrap),
    saveWorkspace: (value, signal) => request('PUT', '/workspace', value, signal, decodeWorkspace),
    estimate: (project, signal) => request('POST', '/estimate', project, signal, decodeEstimate),
    productCalculation: (id, input, signal) =>
      request('POST', `/product/${encodeURIComponent(id)}/calc`, input, signal, decodeProductCalc),
    recommendations: (input, signal) =>
      request('POST', '/ml/recommendations', input, signal, decodeRecommendations),
    parseRoom: (text, signal) => request('POST', '/ml/parse-room', { text }, signal, decodeParsedRoom),
    assignments: (signal) => request('GET', '/ml/assignments', undefined, signal, decodeAssignments),
    classify: (productIds, signal) =>
      request('POST', '/ml/classify', { productIds }, signal, decodeAssignments),
    saveAssignment: (value, signal) =>
      request('PUT', `/ml/assignments/${encodeURIComponent(value.productId)}`, value, signal, (v) =>
        isAssignment(v) ? v : invalid(),
      ),
  };
}
