export type RoomType = 'living' | 'kitchen' | 'bathroom' | 'bedroom' | 'kids' | 'balcony';
export type Category = 'floor' | 'walls' | 'prep' | 'electric';
export type Product = {
  id: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  unit: string;
  coverage: number;
  color: string;
  texture: string;
  wet: boolean;
  heavy: boolean;
  rating: string;
  description: string;
};
export type Room = {
  id: string;
  name: string;
  type: RoomType;
  length: number;
  width: number;
  height: number;
  windows: number;
  doors: number;
  wet: boolean;
  heavy: boolean;
  floor: string;
  wall: string;
};
export type Project = {
  id: string;
  name: string;
  object: string;
  repair: string;
  rooms: Room[];
  reserve: number;
  labor: boolean;
  updatedAt: string;
};
export const roomTypes: { id: RoomType; name: string; short: string }[] = [
  { id: 'living', name: 'Гостиная', short: 'Гостиная' },
  { id: 'kitchen', name: 'Кухня', short: 'Кухня' },
  { id: 'bathroom', name: 'Санузел', short: 'Санузел' },
  { id: 'bedroom', name: 'Спальня', short: 'Спальня' },
  { id: 'kids', name: 'Детская', short: 'Детская' },
  { id: 'balcony', name: 'Балкон', short: 'Балкон' },
];
export const categories: { id: Category; name: string; color: string }[] = [
  { id: 'floor', name: 'Напольные покрытия', color: '#bd7853' },
  { id: 'walls', name: 'Отделка стен', color: '#83917c' },
  { id: 'prep', name: 'Подготовка поверхностей', color: '#c4bba6' },
  { id: 'electric', name: 'Электрика', color: '#697f88' },
];
export const products: Product[] = [
  {
    id: 'oak',
    name: 'Ламинат Дуб натуральный',
    brand: 'TARKETT',
    category: 'floor',
    price: 2490,
    unit: 'упак.',
    coverage: 2.13,
    color: '#c3a17a',
    texture: 'wood',
    wet: false,
    heavy: true,
    rating: '4,8',
    description:
      'Тёплый оттенок дуба и выразительная текстура дерева. 33 класс износостойкости, толщина 8 мм. В упаковке 2,13 м².',
  },
  {
    id: 'oak-light',
    name: 'Ламинат Дуб скандинавский',
    brand: 'KRONOSPAN',
    category: 'floor',
    price: 1890,
    unit: 'упак.',
    coverage: 2.22,
    color: '#d8c7ac',
    texture: 'wood',
    wet: false,
    heavy: false,
    rating: '4,6',
    description:
      'Светлое матовое покрытие для спальни и гостиной с обычной нагрузкой. 32 класс, 8 мм. В упаковке 2,22 м².',
  },
  {
    id: 'stone',
    name: 'Керамогранит Тёплый камень',
    brand: 'KERAMA MARAZZI',
    category: 'floor',
    price: 2190,
    unit: 'упак.',
    coverage: 1.44,
    color: '#c7c0b1',
    texture: 'stone',
    wet: true,
    heavy: true,
    rating: '4,9',
    description:
      'Матовый керамогранит 60 × 60 см. Не боится воды и подходит для кухни, санузла и прихожей. В упаковке 1,44 м².',
  },
  {
    id: 'vinyl',
    name: 'Кварцвинил Дуб тёплый',
    brand: 'ALPINE FLOOR',
    category: 'floor',
    price: 3690,
    unit: 'упак.',
    coverage: 2.24,
    color: '#a48564',
    texture: 'wood',
    wet: true,
    heavy: true,
    rating: '4,8',
    description:
      'Влагостойкое покрытие с древесной текстурой для жилых помещений и кухни. 43 класс. В упаковке 2,24 м².',
  },
  {
    id: 'paint',
    name: 'Краска для стен, матовая',
    brand: 'DULUX',
    category: 'walls',
    price: 3290,
    unit: 'ведро',
    coverage: 35,
    color: '#dce0d1',
    texture: 'paint',
    wet: true,
    heavy: true,
    rating: '4,9',
    description:
      'Моющаяся интерьерная краска, 5 л. Демонстрационный расход: 35 м² в два слоя на подготовленной поверхности.',
  },
  {
    id: 'wallpaper',
    name: 'Обои Льняная фактура',
    brand: 'PALITRA',
    category: 'walls',
    price: 2290,
    unit: 'рулон',
    coverage: 8,
    color: '#d8cdb8',
    texture: 'linen',
    wet: false,
    heavy: false,
    rating: '4,7',
    description:
      'Флизелиновые обои 1,06 × 10 м с тонкой текстильной фактурой. Полезная площадь рулона в деморасчёте — 8 м².',
  },
  {
    id: 'tile',
    name: 'Плитка Керамика молочная',
    brand: 'KERAMA MARAZZI',
    category: 'walls',
    price: 1690,
    unit: 'упак.',
    coverage: 1.2,
    color: '#e5dfd2',
    texture: 'tile',
    wet: true,
    heavy: true,
    rating: '4,8',
    description: 'Глазурованная настенная плитка 20 × 30 см. Для влажных помещений. В упаковке 1,2 м².',
  },
  {
    id: 'primer',
    name: 'Грунтовка глубокого проникновения',
    brand: 'KNAUF',
    category: 'prep',
    price: 890,
    unit: 'канистра',
    coverage: 60,
    color: '#ced8d5',
    texture: 'can',
    wet: true,
    heavy: true,
    rating: '4,8',
    description:
      'Подготовка впитывающих оснований перед отделкой. 10 л, демонстрационный расход 60 м² на канистру.',
  },
  {
    id: 'plaster',
    name: 'Штукатурка выравнивающая',
    brand: 'KNAUF',
    category: 'prep',
    price: 590,
    unit: 'мешок',
    coverage: 3.5,
    color: '#ddd4c3',
    texture: 'bag',
    wet: false,
    heavy: true,
    rating: '4,7',
    description: 'Для выравнивания стен сухих помещений. 30 кг, площадь 3,5 м² при условном слое 10 мм.',
  },
  {
    id: 'cement',
    name: 'Штукатурка цементная',
    brand: 'WEBER',
    category: 'prep',
    price: 690,
    unit: 'мешок',
    coverage: 2.5,
    color: '#bfc4bb',
    texture: 'bag',
    wet: true,
    heavy: true,
    rating: '4,7',
    description: 'Для стен во влажных помещениях. 25 кг, площадь 2,5 м² при условном слое 10 мм.',
  },
  {
    id: 'socket',
    name: 'Розетка с заземлением',
    brand: 'SCHNEIDER ELECTRIC',
    category: 'electric',
    price: 490,
    unit: 'шт.',
    coverage: 1,
    color: '#ece8dc',
    texture: 'socket',
    wet: false,
    heavy: true,
    rating: '4,8',
    description:
      'Матовая розетка скрытого монтажа для сухих помещений. Количество в демосмете: одна точка на 4 м², минимум две.',
  },
  {
    id: 'socket-wet',
    name: 'Розетка с крышкой IP44',
    brand: 'SCHNEIDER ELECTRIC',
    category: 'electric',
    price: 790,
    unit: 'шт.',
    coverage: 1,
    color: '#d2d8cf',
    texture: 'socket',
    wet: true,
    heavy: true,
    rating: '4,8',
    description:
      'Розетка с защитной крышкой. Расположение во влажной зоне и электробезопасность необходимо согласовать со специалистом.',
  },
];
export const productById = (id: string) => products.find((p) => p.id === id)!;
export const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
export const number = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
export function plural(n: number, forms: [string, string, string]) {
  const last = n % 10;
  const teens = n % 100;
  return forms[teens >= 11 && teens <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2];
}
export const roomCount = (n: number) => `${n} ${plural(n, ['помещение', 'помещения', 'помещений'])}`;
export const area = (r: Room) => r.length * r.width;
export const wallArea = (r: Room) =>
  Math.max(0, 2 * (r.length + r.width) * r.height - r.windows * 2.1 - r.doors * 1.6);
export function createRoom(type: RoomType, name?: string): Room {
  const wet = type === 'bathroom' || type === 'kitchen' || type === 'balcony';
  return {
    id: crypto.randomUUID(),
    type,
    name: name || roomTypes.find((t) => t.id === type)!.name,
    length: type === 'bathroom' ? 3 : type === 'kitchen' ? 4 : 4.5,
    width: type === 'bathroom' ? 2 : type === 'kitchen' ? 3 : 4,
    height: 2.7,
    windows: type === 'bathroom' ? 0 : 1,
    doors: 1,
    wet,
    heavy: type === 'kitchen',
    floor: wet ? 'stone' : 'oak',
    wall: type === 'bathroom' ? 'tile' : 'paint',
  };
}
export function createProject(name = 'Квартира на Петроградской'): Project {
  return {
    id: crypto.randomUUID(),
    name,
    object: 'Квартира',
    repair: 'Капитальный',
    rooms: [createRoom('living'), createRoom('kitchen'), createRoom('bathroom')],
    reserve: 10,
    labor: false,
    updatedAt: new Date().toISOString(),
  };
}
export type EstimateRow = {
  product: Product;
  quantity: number;
  cost: number;
  rooms: string[];
  surface: number;
};
export function estimate(project: Project) {
  const rows = new Map<string, EstimateRow>();
  const add = (id: string, surface: number, room: Room, direct = false) => {
    const product = productById(id);
    const quantity = Math.ceil(direct ? surface : (surface * (1 + project.reserve / 100)) / product.coverage);
    const previous = rows.get(id);
    rows.set(id, {
      product,
      quantity: quantity + (previous?.quantity || 0),
      cost: quantity * product.price + (previous?.cost || 0),
      rooms: [...(previous?.rooms || []), room.name],
      surface: surface + (previous?.surface || 0),
    });
  };
  project.rooms.forEach((room) => {
    add(room.floor, area(room), room);
    add(room.wall, wallArea(room), room);
    add('primer', wallArea(room), room);
    if (project.repair !== 'Косметический') {
      add(room.wet ? 'cement' : 'plaster', wallArea(room), room);
      add(room.wet ? 'socket-wet' : 'socket', Math.max(2, Math.ceil(area(room) / 4)), room, true);
    }
  });
  const items = Array.from(rows.values());
  const materials = items.reduce((sum, r) => sum + r.cost, 0);
  const totalArea = project.rooms.reduce((sum, r) => sum + area(r), 0);
  const labor = project.labor
    ? Math.round(
        totalArea *
          (project.repair === 'Косметический' ? 900 : project.repair === 'Дизайнерский' ? 2800 : 1800),
      )
    : 0;
  return {
    items,
    materials,
    labor,
    total: materials + labor,
    totalArea,
    categories: categories.map((c) => ({
      ...c,
      total: items.filter((r) => r.product.category === c.id).reduce((s, r) => s + r.cost, 0),
    })),
  };
}
const STORAGE_KEY = 'repaircalc.projects.v1';
export function loadProjects(): Project[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length && saved.every(isProject)) return saved;
  } catch {
    /* An unavailable or old browser store starts a fresh project. */
  }
  return [createProject()];
}
function isProject(p: Project): boolean {
  return (
    !!p &&
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    ['Квартира', 'Дом', 'Студия'].includes(p.object) &&
    ['Косметический', 'Капитальный', 'Дизайнерский'].includes(p.repair) &&
    [5, 10, 15].includes(p.reserve) &&
    typeof p.labor === 'boolean' &&
    Array.isArray(p.rooms) &&
    p.rooms.length > 0 &&
    p.rooms.every(
      (r) =>
        r &&
        typeof r.id === 'string' &&
        typeof r.name === 'string' &&
        roomTypes.some((t) => t.id === r.type) &&
        [r.length, r.width].every((n) => Number.isFinite(n) && n >= 0.5 && n <= 30) &&
        Number.isFinite(r.height) &&
        r.height >= 2 &&
        r.height <= 6 &&
        typeof r.wet === 'boolean' &&
        typeof r.heavy === 'boolean' &&
        [r.windows, r.doors].every((n) => Number.isInteger(n) && n >= 0 && n <= 10) &&
        products.some((p) => p.id === r.floor && p.category === 'floor') &&
        products.some((p) => p.id === r.wall && p.category === 'walls'),
    )
  );
}
export function saveProjects(projects: Project[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}
export const guides = [
  {
    title: 'Сколько материала брать про запас?',
    tag: 'Расчёт материалов',
    time: '3 минуты',
    text: 'Для прямой укладки пола обычно закладывают 5–10% на подрезку, для сложного рисунка — 15% и больше. В калькуляторе можно выбрать 5, 10 или 15%. После добавления запаса результат округляется до целой упаковки отдельно для каждой комнаты. Точный запас зависит от раскладки и рекомендаций производителя.',
  },
  {
    title: 'Что учесть при ремонте санузла',
    tag: 'Влажные помещения',
    time: '5 минут',
    text: 'Для пола и стен нужны материалы, рассчитанные на контакт с влагой. Включите повышенную влажность — калькулятор предложит керамогранит, влагостойкую краску или плитку и цементную штукатурку. Гидроизоляция, затирка и плиточный клей зависят от основания и технологии работ: их нужно уточнить отдельно перед покупкой.',
  },
  {
    title: 'Как правильно измерить комнату',
    tag: 'С чего начать',
    time: '4 минуты',
    text: 'Измерьте длину и ширину пола, затем высоту стен в нескольких точках. Для прямоугольной комнаты площадь пола равна произведению длины и ширины. Площадь стен — периметр, умноженный на высоту, за вычетом проёмов. Здесь окно принимается за 2,1 м², дверь — за 1,6 м². Ниши и сложную геометрию лучше рассчитывать отдельными зонами.',
  },
  {
    title: 'Ламинат, кварцвинил или плитка?',
    tag: 'Выбор покрытий',
    time: '6 минут',
    text: 'Ламинат подходит для сухих жилых комнат. Для кухни и санузла выбирайте покрытия с подтверждённой влагостойкостью: керамогранит или подходящий кварцвинил. При высокой нагрузке обращайте внимание на класс износостойкости. Характеристики конкретного товара всегда проверяйте по документации производителя.',
  },
];
