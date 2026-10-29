import { compatible } from './selection';
import { mockMetrics } from './mockMetrics';
import { summarizeEngagement, type StoredEvent } from './engagement';
import type { EngagementEvent } from './contracts';
import {
  createRoom,
  estimate,
  guides,
  loadProjects,
  products,
  roomTypes,
  area,
  wallArea,
  type Product,
  type Room,
  type Project,
} from '../data';
import {
  ApiError,
  type Assignment,
  type Bootstrap,
  type ParsedRoom,
  type RecommendationInput,
  type RecommendationResult,
  type RuntimeSettings,
  type Workspace,
  type WorkType,
} from './contracts';

const workspaceKey = 'repaircalc.mock.workspace.v2';
const assignmentKey = 'repaircalc.mock.assignments.v1';
const engagementKey = 'repaircalc.mock.engagement.v1';
function read<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new ApiError(
      'Браузер не разрешил сохранение. Изменения остаются в текущей сессии; разрешите локальное хранение и повторите.',
      'mock',
    );
  }
}
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Запрос отменён', 'AbortError'));
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException('Запрос отменён', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
function seedAssignment(p: Product): Assignment {
  const works: WorkType[] =
    p.category === 'floor'
      ? p.texture === 'stone'
        ? ['flooring', 'tiling']
        : ['flooring']
      : p.category === 'walls'
        ? p.texture === 'tile'
          ? ['tiling']
          : p.texture === 'linen'
            ? ['wallpaper']
            : ['painting']
        : p.category === 'prep'
          ? ['preparation']
          : ['electrical'];
  return {
    productId: p.id,
    works,
    rooms: roomTypes
      .filter((t) => p.wet || !['bathroom', 'kitchen', 'balcony'].includes(t.id))
      .map((t) => t.id),
    score: p.id === 'primer' ? 0.76 : p.id === 'paint' ? 0.88 : 0.96,
    explanation: `Название и характеристики указывают на категорию «${p.category === 'floor' ? 'напольные покрытия' : p.category === 'walls' ? 'отделка стен' : p.category === 'prep' ? 'подготовка основания' : 'электрика'}». ${p.wet ? 'Указана влагостойкость: добавлены влажные помещения.' : 'Влагостойкость не подтверждена: предложены сухие помещения.'}`,
    status: 'pending',
  };
}
export function mockBootstrap(): Bootstrap {
  const workspace = read<Workspace>(workspaceKey, {
    projects: loadProjects(),
    favorites: read<string[]>('repaircalc.favorites', []),
  });
  return {
    products: structuredClone(products),
    projects: workspace.projects,
    favorites: Array.isArray(workspace.favorites) ? workspace.favorites : [],
    guides,
    regions: ['Санкт-Петербург', 'Москва', 'Казань', 'Нижний Новгород', 'Екатеринбург', 'Самара'],
  };
}
function recommendation(input: RecommendationInput): RecommendationResult {
  const { room, reserve, priority } = input;
  const groups = (['floor', 'walls'] as const).map((category) => {
    const surface = category === 'floor' ? area(room) : wallArea(room);
    const candidates = products
      .filter((p) => p.category === category && compatible(p, room))
      .map((p) => {
        const quantity = Math.ceil((surface * (1 + reserve / 100)) / p.coverage);
        const relevance =
          p.id === (category === 'floor' ? room.floor : room.wall) ? 0.96 : p.heavy ? 0.93 : 0.89;
        return {
          productId: p.id,
          score: relevance,
          quantity,
          total: quantity * p.price,
          reasons: [
            room.wet ? 'Подходит для повышенной влажности' : 'Подходит для сухой жилой комнаты',
            p.heavy ? 'Выдерживает интенсивную эксплуатацию' : 'Достаточно для обычной домашней нагрузки',
            `${quantity} ${p.unit} покроют поверхность с запасом ${reserve}%`,
          ],
          tradeoff:
            p.texture === 'stone' || p.texture === 'tile'
              ? 'Для укладки отдельно понадобятся клей, затирка и подготовленное основание.'
              : p.texture === 'wood'
                ? 'Проверьте требования к основанию и подложке перед укладкой.'
                : 'Фактический расход зависит от основания и способа нанесения.',
          evidence: [
            {
              title: 'Характеристики материала',
              excerpt: p.description,
              source: 'Демонстрационная карточка товара',
            },
            {
              title: 'Норма расхода',
              excerpt: `${p.coverage} м² / ${p.unit}. Для комнаты: ${surface.toFixed(2)} м², запас ${reserve}%, округление вверх до целой упаковки.`,
              source: 'Демонстрационный справочник расхода',
            },
          ],
        };
      });
    candidates.sort((a, b) =>
      priority === 'budget'
        ? a.total - b.total
        : priority === 'durability'
          ? Number(products.find((p) => p.id === b.productId)!.heavy) -
              Number(products.find((p) => p.id === a.productId)!.heavy) || b.score - a.score
          : b.score - a.score,
    );
    return { category, candidates };
  });
  return {
    summary: `Подбор для комнаты «${room.name}»: учтены ${room.wet ? 'повышенная влажность' : 'сухие условия'}, ${room.heavy ? 'высокая' : 'обычная'} нагрузка и запас ${reserve}%.`,
    groups,
    excluded: products
      .filter((p) => ['floor', 'walls'].includes(p.category) && !compatible(p, room))
      .map((p) => ({
        productId: p.id,
        reason: room.wet && !p.wet ? 'Не подтверждена влагостойкость' : 'Не рассчитан на высокую нагрузку',
      })),
  };
}
function parseRoom(text: string): ParsedRoom {
  const normalized = text.toLowerCase().replaceAll(',', '.');
  const type = /сануз|ванн|туалет/.test(normalized)
    ? 'bathroom'
    : /кухн/.test(normalized)
      ? 'kitchen'
      : /детск/.test(normalized)
        ? 'kids'
        : /спальн/.test(normalized)
          ? 'bedroom'
          : /балкон|лоджи/.test(normalized)
            ? 'balcony'
            : /гостин|зал/.test(normalized)
              ? 'living'
              : null;
  if (!type)
    return {
      draft: null,
      extracted: [],
      assumptions: [],
      clarification:
        'Уточните назначение комнаты: например, кухня, санузел, гостиная или спальня. Можно добавить площадь и высоту потолка.',
    };
  const base = createRoom(type);
  const dimensions = normalized.match(/(\d+(?:\.\d+)?)\s*[xх×]\s*(\d+(?:\.\d+)?)/);
  const surface = normalized.match(/(\d+(?:\.\d+)?)\s*(?:м[²2]|кв\.?\s*м|квадрат)/);
  const height = normalized.match(/(?:высот[а-я]*|потол[а-я]*)[^\d]{0,12}(\d+(?:\.\d+)?)/);
  const assumptions: string[] = [];
  const extracted: string[] = [`Назначение: ${base.name.toLowerCase()}`];
  if (dimensions) {
    base.length = Number(dimensions[1]);
    base.width = Number(dimensions[2]);
    extracted.push(`Размеры: ${base.length} × ${base.width} м`);
  } else if (surface) {
    const value = Number(surface[1]);
    base.width = Math.round(Math.sqrt(value / 1.5) * 100) / 100;
    base.length = Math.round((value / base.width) * 100) / 100;
    extracted.push(`Площадь: ${value} м²`);
    assumptions.push(
      'Длина и ширина предложены по площади для прямоугольной комнаты. Проверьте их по замерам.',
    );
  } else
    assumptions.push('Размеры не указаны — подставлены типовые значения. Уточните их перед добавлением.');
  if (height) {
    base.height = Number(height[1]);
    extracted.push(`Высота: ${base.height} м`);
  } else assumptions.push('Высота не указана: принято 2,7 м.');
  if (/сух/.test(normalized)) base.wet = false;
  else if (/влаж|влаг/.test(normalized)) base.wet = true;
  base.heavy = /питом|собак|кошк|высок[а-я]*\s+нагруз|интенсив|дет[ьи]/.test(normalized) || base.heavy;
  if (base.wet) extracted.push('Повышенная влажность');
  if (base.heavy) extracted.push('Высокая нагрузка');
  assumptions.push(`Проёмы: ${base.windows} окно, ${base.doors} дверь — уточните в параметрах помещения.`);
  if (
    ![base.length, base.width].every((n) => Number.isFinite(n) && n >= 0.5 && n <= 30) ||
    base.height < 2 ||
    base.height > 6
  )
    return {
      draft: null,
      extracted,
      assumptions: [],
      clarification: 'Проверьте размеры: длина и ширина от 0,5 до 30 м, высота от 2 до 6 м.',
    };
  const { id: _id, floor: _floor, wall: _wall, ...draft } = base;
  return { draft, extracted, assumptions, clarification: null };
}
export async function mockRequest(
  path: string,
  body: unknown,
  settings: RuntimeSettings,
  signal: AbortSignal,
): Promise<unknown> {
  // Writes commit before the artificial delay so toggling modes cannot lose local edits.
  if (path === '/workspace') {
    const value = body as Workspace;
    persist(workspaceKey, value);
    return structuredClone(value);
  }
  if (path.startsWith('/ml/assignments/') && body) {
    const value = body as Assignment;
    const all = read<Assignment[]>(assignmentKey, products.map(seedAssignment));
    persist(
      assignmentKey,
      all.map((a) => (a.productId === value.productId ? value : a)),
    );
    return structuredClone(value);
  }
  if (path === '/engagement/events') {
    const event = body as EngagementEvent;
    const events = read<StoredEvent[]>(engagementKey, []);
    const existing = events.find((e) => e.id === event.id);
    if (existing) {
      const { createdAt: _, ...saved } = existing;
      if (JSON.stringify(saved) !== JSON.stringify(event))
        throw new ApiError('Событие уже сохранено.', 'mock');
    } else {
      persist(engagementKey, [...events, { ...event, createdAt: new Date().toISOString() }]);
    }
    return { id: event.id };
  }
  await abortableDelay(settings.delay, signal);
  if (path === '/admin/metrics')
    return {
      ...structuredClone(mockMetrics),
      engagement: summarizeEngagement(read<StoredEvent[]>(engagementKey, [])),
    };
  if (path.startsWith('/ml/') && settings.scenario === 'ml-error')
    throw new ApiError(
      'Тестовая ошибка ML-сервиса. Верните обычный сценарий в тестовой панели или повторите запрос.',
      'mock',
    );
  if (path === '/bootstrap') return mockBootstrap();
  if (path === '/estimate') return estimate(body as Project);
  if (/^\/product\/[^/]+\/calc$/.test(path)) {
    const product = products.find((p) => p.id === decodeURIComponent(path.split('/')[2]));
    if (!product) throw new ApiError('Товар не найден', 'mock');
    const { surface, reserve } = body as { surface: number; reserve: number };
    const quantity = Math.ceil(
      product.category === 'electric' ? surface : (surface * (1 + reserve / 100)) / product.coverage,
    );
    return { quantity, unit: product.unit, total: quantity * product.price };
  }
  if (path === '/ml/recommendations')
    return settings.scenario === 'ml-empty'
      ? {
          summary:
            'Подходящие материалы не найдены. Попробуйте изменить условия или выбрать материал вручную.',
          groups: [],
          excluded: [],
        }
      : recommendation(body as RecommendationInput);
  if (path === '/ml/parse-room')
    return settings.scenario === 'ml-empty'
      ? {
          draft: null,
          extracted: [],
          assumptions: [],
          clarification: 'Недостаточно данных. Укажите назначение и размеры комнаты.',
        }
      : parseRoom((body as { text: string }).text);
  if (path === '/ml/assignments') return read<Assignment[]>(assignmentKey, products.map(seedAssignment));
  if (path === '/ml/classify') {
    if (settings.scenario === 'ml-empty') return [];
    const ids = (body as { productIds: string[] }).productIds;
    return products.filter((p) => ids.includes(p.id)).map(seedAssignment);
  }
  throw new ApiError(`Заглушка для ${path} не найдена`, 'mock');
}
