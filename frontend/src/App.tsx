import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Droplets,
  Ellipsis,
  Expand,
  FolderOpen,
  Heart,
  House,
  Layers3,
  Leaf,
  MapPin,
  Menu,
  Pencil,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Counter,
  DimensionInput,
  Logo,
  Modal,
  ProductVisual,
  RoomIcon,
  RoomPlan,
  RoomScene,
  Tip,
  Toggle,
} from './components';
import {
  area,
  categories,
  createProject,
  createRoom as baseCreateRoom,
  money,
  number,
  roomCount,
  roomTypes,
  wallArea,
  type Category,
  type Product,
  type Project,
  type Room,
  type RoomType,
} from './data';
import { Recommendations, RoomBrief, SmartAssistant } from './ml/Assistant';
import { Admin } from './admin/Admin';
import { roomWithCatalog, compatible } from './services/selection';
import { RequestState, useBootstrap, useQuery, useRuntime, useWorkspaceSave } from './services/runtime';
import type { ParsedRoom } from './services/contracts';

type Page = 'calculator' | 'projects' | 'catalog' | 'favorites' | 'guide' | 'assistant' | 'admin';
type Dialog =
  | null
  | 'new-room'
  | 'new-project'
  | 'rename'
  | 'plan'
  | 'region'
  | 'help'
  | 'profile'
  | 'delete-project'
  | { product: Product }
  | { category: 'floor' | 'walls' };
const navItems: { id: Page; name: string; icon: typeof Calculator }[] = [
  { id: 'calculator', name: 'Калькулятор ремонта', icon: Calculator },
  { id: 'assistant', name: 'Умный помощник', icon: Sparkles },
  { id: 'projects', name: 'Мои проекты', icon: FolderOpen },
  { id: 'catalog', name: 'Каталог материалов', icon: Layers3 },
  { id: 'favorites', name: 'Избранное', icon: Heart },
  { id: 'admin', name: 'Админка', icon: SlidersHorizontal },
];
function getPage(): Page {
  const hash = location.hash.slice(1);
  if (hash === 'matching' || hash === 'admin' || hash.startsWith('admin/')) return 'admin';
  return ['projects', 'catalog', 'favorites', 'guide', 'assistant'].includes(hash)
    ? (hash as Page)
    : 'calculator';
}

export default function App() {
  const initialData = useBootstrap();
  const { api, settings } = useRuntime();
  const { products, guides, regions } = initialData;
  const productById = (id: string) => products.find((p) => p.id === id)!;
  const [projects, setProjects] = useState(initialData.projects);
  const [projectId, setProjectId] = useState(() => projects[0].id);
  const project = projects.find((p) => p.id === projectId) || projects[0];
  const [roomId, setRoomId] = useState(project.rooms[0].id);
  const room = project.rooms.find((r) => r.id === roomId) || project.rooms[0];
  const [page, setPage] = useState<Page>(getPage);
  const [step, setStep] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [favorites, setFavorites] = useState<string[]>(initialData.favorites);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [compactNav, setCompactNav] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const [toast, setToast] = useState('');
  const workspaceSave = useWorkspaceSave({ projects, favorites }, initialData);
  const saved = workspaceSave.status === 'saved';
  const [region, setRegion] = useState(regions[0] || 'Регион не выбран');
  const [article, setArticle] = useState<number | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [sort, setSort] = useState('recommended');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const calculationRequest = useQuery(
    `estimate:${JSON.stringify(project)}`,
    (signal) => api.estimate(project, signal),
    100,
  );
  const calculation = calculationRequest.data || {
    items: [],
    materials: 0,
    labor: 0,
    total: 0,
    totalArea: project.rooms.reduce((sum, r) => sum + area(r), 0),
    categories: categories.map((c) => ({ ...c, total: 0 })),
  };
  function createRoom(type: RoomType, name?: string) {
    return roomWithCatalog(baseCreateRoom(type, name), products);
  }
  function addParsedRoom(draft: NonNullable<ParsedRoom['draft']>) {
    const next = roomWithCatalog(
      { ...baseCreateRoom(draft.type), ...draft, id: crypto.randomUUID() },
      products,
    );
    updateProject({ rooms: [...project.rooms, next] });
    setRoomId(next.id);
    notify('Параметры проверены — комната добавлена в проект');
  }
  function applyMaterial(product: Product) {
    updateRoom(product.category === 'floor' ? { floor: product.id } : { wall: product.id });
    notify(`Материал выбран для комнаты «${room.name}»`);
  }
  const visibleProducts = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (page !== 'favorites' || favorites.includes(p.id)) &&
            (filter === 'all' || p.category === filter) &&
            `${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'price-up' ? a.price - b.price : sort === 'price-down' ? b.price - a.price : 0,
        ),
    [page, filter, search, sort, favorites, products],
  );
  useEffect(() => {
    const listener = () => {
      setPage(getPage());
      setMobileMenu(false);
    };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    document.title = `${page === 'calculator' ? project.name : navItems.find((n) => n.id === page)?.name || 'Полезные советы'} — RepairCalc`;
  }, [page, project.name]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const change = () => {
      setCompactNav(media.matches);
      if (!media.matches) setMobileMenu(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!mobileMenu || !compactNav) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenu(false);
      if (e.key === 'Tab') {
        const buttons = sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        if (e.shiftKey && document.activeElement === buttons[0]) {
          e.preventDefault();
          buttons[buttons.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          e.preventDefault();
          buttons[0].focus();
        }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [mobileMenu, compactNav]);
  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  }
  function navigate(next: Page) {
    location.hash = next;
    setPage(next);
    setMobileMenu(false);
    setSearch('');
    setFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function updateProject(patch: Partial<Project>) {
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    );
  }
  function updateRoom(patch: Partial<Room>) {
    let next: Room;
    try {
      next = roomWithCatalog({ ...room, ...patch }, products);
    } catch (cause) {
      notify((cause as Error).message);
      return;
    }
    const replaced = next.floor !== (patch.floor || room.floor) || next.wall !== (patch.wall || room.wall);
    updateProject({ rooms: project.rooms.map((r) => (r.id === room.id ? next : r)) });
    if (replaced) notify('Материалы обновлены с учётом условий комнаты');
  }
  function favorite(id: string) {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function nextStep(next: number) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function exportCsv() {
    if (!calculationRequest.data) {
      notify('Дождитесь актуального расчёта сметы');
      return;
    }
    const escape = (v: string | number) => '"' + String(v).replaceAll('"', '""') + '"';
    const lines = [
      ['Проект', project.name],
      [
        settings.mode === 'mock' ? 'MOCK: демонстрационные цены. Запас' : 'Серверный расчёт. Запас',
        `${project.reserve}%`,
      ],
      ['Материал', 'Помещения', 'Количество', 'Единица', 'Цена, руб.', 'Сумма, руб.'],
      ...calculation.items.map((r) => [
        r.product.name,
        r.rooms.join(', '),
        r.quantity,
        r.product.unit,
        r.product.price,
        r.cost,
      ]),
      ['Материалы', '', '', '', '', calculation.materials],
      ['Работы (ориентировочно)', '', '', '', '', calculation.labor],
      ['Итого', '', '', '', '', calculation.total],
    ];
    const blob = new Blob(['\uFEFF' + lines.map((row) => row.map(escape).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Смета — ${project.name.replace(/[<>:"/\\|?*]/g, '')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Смета сохранена в CSV — её можно открыть в Excel');
  }
  function applyPreset(preset: 'economy' | 'comfort' | 'premium') {
    const nextRooms = project.rooms.map((r) => {
      const choose = (category: 'floor' | 'walls') => {
        const eligible = products.filter((p) => p.category === category && compatible(p, r));
        eligible.sort((a, b) =>
          preset === 'economy'
            ? a.price / a.coverage - b.price / b.coverage
            : preset === 'premium'
              ? b.price / b.coverage - a.price / a.coverage
              : Number(b.heavy) - Number(a.heavy),
        );
        return eligible[0]?.id;
      };
      return { ...r, floor: choose('floor') || r.floor, wall: choose('walls') || r.wall };
    });
    updateProject({ rooms: nextRooms });
    notify('Комплект материалов обновлён для всех помещений');
  }
  const roomTabs = (
    <div className="room-tabs-row">
      <div className="room-tabs" role="tablist" aria-label="Помещения">
        {project.rooms.map((r, index) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={r.id === room.id}
            tabIndex={r.id === room.id ? 0 : -1}
            className={`room-tab ${r.id === room.id ? 'active' : ''}`}
            onClick={() => setRoomId(r.id)}
            onKeyDown={(e) => {
              const target =
                e.key === 'ArrowRight'
                  ? (index + 1) % project.rooms.length
                  : e.key === 'ArrowLeft'
                    ? (index - 1 + project.rooms.length) % project.rooms.length
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? project.rooms.length - 1
                        : null;
              if (target !== null) {
                e.preventDefault();
                setRoomId(project.rooms[target].id);
                (e.currentTarget.parentElement?.children[target] as HTMLElement)?.focus();
              }
            }}
          >
            <RoomIcon type={r.type} />
            <span>
              <strong>{r.name}</strong>
              <small>{number(area(r))} м²</small>
            </span>
            {r.id === room.id && <span className="room-selected" />}
          </button>
        ))}
      </div>
      <button className="add-room" onClick={() => setDialog('new-room')} aria-label="Добавить помещение">
        <Plus size={21} />
        <span>Добавить</span>
      </button>
    </div>
  );

  return (
    <div className="app" data-page={page}>
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      {mobileMenu && <div className="sidebar-scrim" onClick={() => setMobileMenu(false)} />}
      <aside
        ref={sidebarRef}
        inert={compactNav && !mobileMenu}
        className={`sidebar ${mobileMenu ? 'is-open' : ''}`}
      >
        <button
          className="mobile-close icon-button"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenu(false)}
        >
          <X size={18} />
        </button>
        <button
          className="logo-button"
          aria-label="RepairCalc — калькулятор"
          onClick={() => navigate('calculator')}
        >
          <Logo />
        </button>
        <div className="workspace-label">ВАША МАСТЕРСКАЯ</div>
        <nav aria-label="Основная навигация">
          {navItems
            .filter((item) => item.id !== 'admin')
            .map(({ id, icon: Icon, name }) => (
              <button
                key={id}
                className={`nav-item ${page === id ? 'active' : ''}`}
                onClick={() => navigate(id)}
                aria-current={page === id ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{name}</span>
                {id === 'projects' && <small>{projects.length}</small>}
                {id === 'favorites' && favorites.length > 0 && <small>{favorites.length}</small>}
              </button>
            ))}
        </nav>
        <div className="sidebar-divider" />
        <button className={`nav-item ${page === 'guide' ? 'active' : ''}`} onClick={() => navigate('guide')}>
          <BookOpen size={19} strokeWidth={1.7} />
          <span>Полезные советы</span>
          <ArrowUpRight size={15} />
        </button>
        <div className="workspace-label admin-nav-label">ДЛЯ ПЕРСОНАЛА</div>
        <nav aria-label="Ресурсы персонала">
          <button
            className={`nav-item ${page === 'admin' ? 'active' : ''}`}
            onClick={() => navigate('admin')}
            aria-current={page === 'admin' ? 'page' : undefined}
          >
            <SlidersHorizontal size={19} strokeWidth={1.7} />
            <span>Админка</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-stars">✳</span>
            <h3>
              Большие перемены.
              <br />
              Понятный план.
            </h3>
            <p>
              От первой идеи до последней
              <br />
              банки краски — всё учтём.
            </p>
            <button
              onClick={() => {
                setMobileMenu(false);
                setDialog('new-project');
              }}
            >
              Начать новый проект <Plus size={15} />
            </button>
          </div>
          <button
            className="help-link"
            onClick={() => {
              setMobileMenu(false);
              setDialog('help');
            }}
          >
            <CircleHelp size={18} /> Как это работает <ArrowUpRight size={15} />
          </button>
          <div className="partner">
            <span>
              <svg width="38" height="17" viewBox="-1 -1 133 44" fill="currentColor" aria-hidden="true">
                <path d="m12 28 14-14 14 14-14 14Zm26-14L52 0l14 14-14 14Zm26 14 14-14 14 14-14 14Zm26-14L104 0l14 14-14 14Zm15 14 13-13 13 13-13 14Z" />
                <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M26 14H14L0 28l14 14h12M0 28h12M14 14 28 0h24M26 14 40 0M26 14h12M40 28h12l14-14h12M40 28l14 14h24M52 28l14 14M52 28h12M66 14 80 0h24M78 14 92 0M78 14h12M92 28h12l14 14h-12L92 28" />
                </g>
              </svg>
              МАКСИДОМ
            </span>
          </div>
        </div>
      </aside>

      <div className="workspace" inert={compactNav && mobileMenu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Открыть меню"
              onClick={() => setMobileMenu((v) => !v)}
            >
              <Menu size={22} />
            </button>
            <button onClick={() => navigate('projects')}>Моя мастерская</button>
            <ChevronRight size={13} />
            <span>
              {page === 'calculator'
                ? 'Калькулятор ремонта'
                : navItems.find((n) => n.id === page)?.name || 'Полезные советы'}
            </span>
          </div>
          <div className="topbar-actions">
            <button className="region-button" onClick={() => setDialog('region')}>
              <MapPin size={15} />
              {region}
              <ChevronDown size={13} />
            </button>
            <span className="topbar-divider" />
            <button
              className="profile-button"
              onClick={() => setDialog('profile')}
              aria-label="Профиль гостя"
            >
              <span>Г</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <RequestState error={workspaceSave.error} retry={workspaceSave.retry} />
          {page === 'assistant' && (
            <SmartAssistant
              project={project}
              room={room}
              selectRoom={setRoomId}
              addRoom={addParsedRoom}
              applyMaterial={applyMaterial}
            />
          )}
          {page === 'admin' && <Admin />}
          {page === 'calculator' && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow1">
                    <span />
                  </div>
                  <h1>
                    Хороший ремонт
                    <br className="mobile-break" /> начинается с плана<span className="accent-dot">.</span>
                  </h1>
                  <p>Расскажите о пространстве — мы поможем рассчитать всё остальное.</p>
                </div>
                <span className="heading-mark" aria-hidden="true">
                  ⌘
                </span>
              </section>
              <div className="project-toolbar">
                <div className="project-title">
                  <span className="project-icon">
                    <House size={18} />
                  </span>
                  <div>
                    <button onClick={() => setDialog('rename')}>
                      {project.name}
                      <Pencil size={13} />
                    </button>
                    <small>
                      <span className={`save-dot ${saved ? '' : 'unsaved'}`} />
                      {workspaceSave.status === 'saving'
                        ? 'Сохраняем изменения…'
                        : saved
                          ? settings.mode === 'mock'
                            ? 'Сохранено в этом браузере'
                            : 'Сохранено на сервере'
                          : 'Не сохранено — повторите запрос'}
                    </small>
                  </div>
                </div>
                <button className="text-button" onClick={() => navigate('projects')}>
                  Все проекты <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="steps" aria-label="Этапы расчёта">
                {['Помещения', 'Материалы', 'Ваша смета'].map((title, i) => (
                  <button
                    key={title}
                    className={`step ${step === i ? 'active' : ''} ${step > i ? 'complete' : ''}`}
                    onClick={() => nextStep(i)}
                    aria-current={step === i ? 'step' : undefined}
                  >
                    <span className="step-number">{step > i ? <Check size={15} /> : `0${i + 1}`}</span>
                    <span>
                      {title}
                      <small>
                        {['Размеры и особенности', 'Подбор под вашу задачу', 'Всё по полочкам'][i]}
                      </small>
                    </span>
                    {i < 2 && <ChevronRight className="step-chevron" size={18} />}
                  </button>
                ))}
              </div>
              <div className="calculator-layout">
                <div className="calculator-main">
                  {step === 0 && (
                    <>
                      <RoomBrief addRoom={addParsedRoom} compact />
                      <div className="project-options">
                        <label>
                          <span>Тип объекта</span>
                          <select
                            aria-label="Тип объекта"
                            value={project.object}
                            onChange={(e) => updateProject({ object: e.target.value })}
                          >
                            <option>Квартира</option>
                            <option>Дом</option>
                            <option>Студия</option>
                          </select>
                        </label>
                        <span className="option-divider" />
                        <label className="repair-option">
                          <span>Какой ремонт планируете?</span>
                          <div className="segmented">
                            {['Косметический', 'Капитальный', 'Дизайнерский'].map((item) => (
                              <button
                                key={item}
                                aria-pressed={project.repair === item}
                                onClick={() => updateProject({ repair: item })}
                                className={project.repair === item ? 'active' : ''}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </label>
                      </div>
                      <div className="section-label">
                        <h2>
                          Ваши помещения <span>{project.rooms.length.toString().padStart(2, '0')}</span>
                        </h2>
                        <span>{number(calculation.totalArea)} м² общая площадь</span>
                      </div>
                      {roomTabs}
                      <section className="room-editor panel">
                        <div className="panel-heading">
                          <div>
                            <RoomIcon type={room.type} />
                            <h2>{room.name}</h2>
                            <span className="subtle-badge">Параметры комнаты</span>
                          </div>
                          <button
                            className="icon-button delete-room"
                            disabled={project.rooms.length <= 1}
                            aria-label={`Удалить помещение ${room.name}`}
                            title={
                              project.rooms.length <= 1
                                ? 'В проекте должно быть хотя бы одно помещение'
                                : 'Удалить помещение'
                            }
                            onClick={() => {
                              updateProject({ rooms: project.rooms.filter((r) => r.id !== room.id) });
                              notify('Помещение удалено из проекта');
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="room-editor-body">
                          <div className="room-fields">
                            <div className="dimension-grid">
                              <DimensionInput
                                label="Длина"
                                value={room.length}
                                onChange={(length) => updateRoom({ length })}
                              />
                              <DimensionInput
                                label="Ширина"
                                value={room.width}
                                onChange={(width) => updateRoom({ width })}
                              />
                              <DimensionInput
                                label="Высота потолка"
                                value={room.height}
                                min={2}
                                max={6}
                                onChange={(height) => updateRoom({ height })}
                              />
                              <div className="area-readout">
                                <span>Площадь пола</span>
                                <strong>
                                  {number(area(room))}
                                  <small> м²</small>
                                </strong>
                              </div>
                            </div>
                            <div className="openings">
                              <Counter
                                label="Окна"
                                value={room.windows}
                                onChange={(windows) => updateRoom({ windows })}
                              />
                              <Counter
                                label="Двери"
                                value={room.doors}
                                onChange={(doors) => updateRoom({ doors })}
                              />
                            </div>
                            <p className="field-note">
                              Проёмы вычтем из площади стен.
                              <br /> Окно — 2,1 м², дверь — 1,6 м².
                            </p>
                          </div>
                          <div className="plan-wrap">
                            <span className="plan-label">
                              <span /> ПЛАН ПОМЕЩЕНИЯ
                            </span>
                            <button
                              className="icon-button expand-plan"
                              onClick={() => setDialog('plan')}
                              aria-label="Увеличить план помещения"
                            >
                              <Expand size={15} />
                            </button>
                            <RoomPlan room={room} />
                          </div>
                        </div>
                        <div className="room-metrics">
                          <span>
                            Пол <b>{number(area(room))} м²</b>
                          </span>
                          <span>
                            Стены <b>{number(wallArea(room))} м²</b>
                          </span>
                          <span>
                            Периметр <b>{number(2 * (room.length + room.width))} м</b>
                          </span>
                        </div>
                      </section>
                      <section className="conditions">
                        <div className="section-label">
                          <h2>У каждого пространства свой характер</h2>
                          <CircleHelp size={15} aria-label="Условия влияют на выбор материалов" />
                        </div>
                        <div className="condition-grid">
                          <div className={`condition ${room.wet ? 'enabled' : ''}`}>
                            <Droplets size={20} />
                            <Toggle
                              label="Повышенная влажность"
                              description="Кухня, санузел или балкон"
                              checked={room.wet}
                              onChange={() => updateRoom({ wet: !room.wet })}
                            />
                          </div>
                          <div className={`condition ${room.heavy ? 'enabled' : ''}`}>
                            <TrendingUp size={20} />
                            <Toggle
                              label="Высокая нагрузка"
                              description="Дети, питомцы, частая уборка"
                              checked={room.heavy}
                              onChange={() => updateRoom({ heavy: !room.heavy })}
                            />
                          </div>
                        </div>
                      </section>
                      <Tip title={room.wet ? 'Влага под контролем' : 'Подбираем с заботой о вашем доме'}>
                        {room.wet
                          ? 'Для этой комнаты выбраны влагостойкие покрытия и цементная штукатурка.'
                          : 'Учтём особенности комнаты, расход материалов и небольшой запас на подрезку.'}
                      </Tip>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <div className="section-label">
                        <h2>Материалы, которые подходят</h2>
                        <span>{roomCount(project.rooms.length)}</span>
                      </div>
                      <div className="preset-grid">
                        {[
                          {
                            key: 'economy' as const,
                            title: 'Разумный минимум',
                            desc: 'Практично и доступно',
                            icon: Leaf,
                          },
                          {
                            key: 'comfort' as const,
                            title: 'Золотая середина',
                            desc: 'Баланс цены и качества',
                            icon: ShieldCheck,
                          },
                          {
                            key: 'premium' as const,
                            title: 'Больше комфорта',
                            desc: 'Внимание к деталям',
                            icon: Sparkles,
                          },
                        ].map((p) => (
                          <button className="preset" key={p.key} onClick={() => applyPreset(p.key)}>
                            <p.icon size={21} />
                            <strong>{p.title}</strong>
                            <small>{p.desc}</small>
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>
                      {roomTabs}
                      <Tip title={`Учтены условия: ${room.name.toLowerCase()}`}>
                        {room.wet ? 'Только влагостойкие материалы. ' : 'Материалы для сухого помещения. '}
                        {room.heavy
                          ? 'Покрытия выдерживают высокую нагрузку.'
                          : 'Для обычной домашней нагрузки.'}
                      </Tip>
                      <Recommendations
                        room={room}
                        reserve={project.reserve}
                        applyMaterial={applyMaterial}
                        compact
                      />
                      <div className="selected-materials">
                        {(['floor', 'walls'] as const).map((category) => {
                          const p = productById(category === 'floor' ? room.floor : room.wall);
                          return (
                            <div className="selected-material panel" key={category}>
                              <ProductVisual product={p} />
                              <div className="selected-material-info">
                                <small className="eyebrow">
                                  {category === 'floor' ? 'НАПОЛЬНОЕ ПОКРЫТИЕ' : 'ОТДЕЛКА СТЕН'}
                                </small>
                                <button
                                  className="product-name-button"
                                  onClick={() => setDialog({ product: p })}
                                >
                                  {p.name}
                                </button>
                                <span>
                                  {p.brand} · {number(p.coverage)} м² / {p.unit}
                                </span>
                                <div className="material-tags">
                                  <span>
                                    <Check size={12} />
                                    Подходит комнате
                                  </span>
                                  {p.wet && (
                                    <span>
                                      <Droplets size={12} />
                                      Влагостойкий
                                    </span>
                                  )}
                                </div>
                                <div className="selected-material-bottom">
                                  <MaterialPrice
                                    product={p}
                                    surface={category === 'floor' ? area(room) : wallArea(room)}
                                    reserve={project.reserve}
                                  />
                                  <button className="text-button" onClick={() => setDialog({ category })}>
                                    Заменить <ArrowRight size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="included panel">
                        <span className="included-icon">
                          <Layers3 size={20} />
                        </span>
                        <div>
                          <h3>Основа тоже учтена</h3>
                          <p>
                            Грунтовка{project.repair !== 'Косметический' ? ', штукатурка и розетки' : ''} уже
                            в смете. Клей, крепёж и дополнительные работы уточняются после осмотра помещения.
                          </p>
                        </div>
                      </div>
                      <button className="text-button back-step" onClick={() => nextStep(0)}>
                        <ArrowLeft size={15} /> Вернуться к помещениям
                      </button>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <div className="estimate-intro">
                        <span className="estimate-check">
                          <CheckCheck size={24} />
                        </span>
                        <div>
                          <h2>Ваш ремонт в цифрах</h2>
                          <p>
                            {roomCount(project.rooms.length)} · {number(calculation.totalArea)} м² ·{' '}
                            {project.repair.toLowerCase()} ремонт
                          </p>
                        </div>
                      </div>
                      <div className="estimate-actions">
                        <button
                          className="button secondary"
                          disabled={!calculationRequest.data}
                          onClick={exportCsv}
                        >
                          <ArrowDownToLine size={16} /> Скачать CSV
                        </button>
                        <button
                          className="button secondary"
                          disabled={!calculationRequest.data}
                          onClick={() => window.print()}
                        >
                          <Printer size={16} /> Печать / PDF
                        </button>
                        <span>Запас {project.reserve}% включён</span>
                      </div>
                      <div className="estimate-table panel">
                        <div className="table-head">
                          <span>МАТЕРИАЛ / КОЛИЧЕСТВО</span>
                          <span>СТОИМОСТЬ</span>
                        </div>
                        {calculation.categories
                          .filter((c) => c.total > 0)
                          .map((category) => (
                            <section key={category.id}>
                              <div className="estimate-category">
                                <h3>
                                  <span style={{ background: category.color }} />
                                  {category.name}
                                </h3>
                                <strong>{money(category.total)}</strong>
                              </div>
                              {calculation.items
                                .filter((r) => r.product.category === category.id)
                                .map((r) => (
                                  <div className="estimate-row" key={r.product.id}>
                                    <ProductVisual product={r.product} />
                                    <div>
                                      <button onClick={() => setDialog({ product: r.product })}>
                                        {r.product.name}
                                      </button>
                                      <small>{r.rooms.join(', ')}</small>
                                      <span>
                                        {r.quantity} {r.product.unit} × {money(r.product.price)}
                                      </span>
                                    </div>
                                    <strong>{money(r.cost)}</strong>
                                  </div>
                                ))}
                            </section>
                          ))}
                      </div>
                      <Tip title="Понятно, откуда каждая цифра">
                        Считаем расход для каждой комнаты, добавляем запас {project.reserve}% и округляем до
                        целой упаковки. Работы — ориентир по площади; доставка и дополнительные расходники не
                        включены.
                      </Tip>
                      <button className="text-button back-step" onClick={() => nextStep(1)}>
                        <ArrowLeft size={15} /> Изменить материалы
                      </button>
                    </>
                  )}
                </div>
                <aside className="summary-column">
                  <div className="inspiration-card">
                    <h2>
                      Сначала — план.
                      <br />
                      Потом — ремонтваш дом.
                    </h2>
                    <RoomScene />
                  </div>
                  <div className="budget-card panel">
                    <RequestState
                      loading={calculationRequest.status === 'loading'}
                      error={calculationRequest.error}
                      retry={calculationRequest.refresh}
                      label="Пересчитываем смету…"
                    />
                    <div className="budget-heading">
                      <h2>Ориентир по бюджету</h2>
                    </div>
                    <div className="budget-total" data-testid="budget-total">
                      {calculationRequest.data ? money(calculation.total) : '—'}
                    </div>
                    <p className="budget-subtitle">
                      На {roomCount(project.rooms.length)} · {number(calculation.totalArea)} м²
                    </p>
                    <div className="budget-bar">
                      {calculation.categories
                        .filter((c) => c.total > 0)
                        .map((c) => (
                          <span
                            key={c.id}
                            style={{
                              background: c.color,
                              width: `${(c.total / calculation.materials) * 100}%`,
                            }}
                          />
                        ))}
                    </div>
                    <div className="budget-lines">
                      {calculation.categories.map((c) => (
                        <div key={c.id}>
                          <span>
                            <i style={{ background: c.color }} />
                            {c.name}
                          </span>
                          <strong>{money(c.total)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="budget-controls">
                      <label className="reserve-row">
                        <span>
                          Запас материалов <span className="muted">на подрезку</span>
                        </span>
                        <select
                          aria-label="Запас материалов"
                          value={project.reserve}
                          onChange={(e) => updateProject({ reserve: Number(e.target.value) })}
                        >
                          <option value={5}>5%</option>
                          <option value={10}>10%</option>
                          <option value={15}>15%</option>
                        </select>
                      </label>
                      <Toggle
                        label="Добавить стоимость работ"
                        checked={project.labor}
                        onChange={() => updateProject({ labor: !project.labor })}
                      />
                      {project.labor && (
                        <div className="labor-price">
                          <span>Работы, ориентировочно</span>
                          <strong>{money(calculation.labor)}</strong>
                        </div>
                      )}
                    </div>
                    <button
                      className="button primary summary-cta"
                      onClick={() => (step < 2 ? nextStep(step + 1) : exportCsv())}
                    >
                      {step === 0
                        ? 'Подобрать материалы'
                        : step === 1
                          ? 'Перейти к смете'
                          : 'Скачать готовую смету'}
                      {step === 2 ? <ArrowDownToLine size={17} /> : <ArrowRight size={17} />}
                    </button>
                    <p className="budget-disclaimer">
                      Итоговая стоимость зависит от материалов и условий работ.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}

          {page === 'projects' && (
            <>
              <section className="page-heading page-heading-row">
                <div>
                  <h1>
                    Ваши большие планы<span className="accent-dot">.</span>
                  </h1>
                  <p>Каждому пространству — свой продуманный проект.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    setMobileMenu(false);
                    setDialog('new-project');
                  }}
                >
                  <Plus size={17} /> Новый проект
                </button>
              </section>
              <div className="page-tools">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    placeholder="Найти проект"
                    aria-label="Найти проект"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                  />
                  {projectSearch && (
                    <button
                      className="icon-button"
                      aria-label="Очистить поиск проектов"
                      onClick={() => setProjectSearch('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <span>
                  {projects.length} {projects.length === 1 ? 'проект' : 'проектов'} в вашей мастерской
                </span>
              </div>
              <div className="projects-grid">
                {projects
                  .filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                  .map((p, i) => (
                    <article className="project-card panel" key={p.id}>
                      <button
                        className={`project-card-art variant-${i % 3}`}
                        aria-label={`Открыть ${p.name}`}
                        onClick={() => {
                          setProjectId(p.id);
                          setRoomId(p.rooms[0].id);
                          setStep(0);
                          navigate('calculator');
                        }}
                      >
                        <RoomScene variant={i % 2 ? 'clay' : 'green'} />
                        <span className="project-status">
                          <span /> В работе
                        </span>
                        <span className="project-open">
                          <ArrowUpRight size={23} />
                        </span>
                      </button>
                      <div className="project-card-body">
                        <small>
                          {p.object.toUpperCase()} · {p.repair.toUpperCase()}
                        </small>
                        <h2>{p.name}</h2>
                        <p>
                          {roomCount(p.rooms.length)} <span>·</span>{' '}
                          {number(p.rooms.reduce((sum, r) => sum + area(r), 0))} м²
                        </p>
                        <div>
                          <ProjectPrice project={p} />
                          <button
                            className="icon-button"
                            aria-label={`Дублировать проект ${p.name}`}
                            onClick={() => {
                              const clone = structuredClone(p);
                              clone.id = crypto.randomUUID();
                              clone.name += ' — копия';
                              setProjects((prev) => [...prev, clone]);
                              notify('Копия проекта создана');
                            }}
                          >
                            <Copy size={17} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Удалить проект ${p.name}`}
                            disabled={projects.length <= 1}
                            onClick={() => {
                              setProjectId(p.id);
                              setDialog('delete-project');
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                {!projectSearch && (
                  <button
                    className="new-project-card"
                    onClick={() => {
                      setMobileMenu(false);
                      setDialog('new-project');
                    }}
                  >
                    <span>
                      <Plus size={26} />
                    </span>
                    <h3>Здесь начинается что-то новое</h3>
                    <p>
                      Квартира, дом или одна комната.
                      <br />
                      Давайте всё рассчитаем.
                    </p>
                    <b>
                      Создать проект <ArrowRight size={16} />
                    </b>
                  </button>
                )}
              </div>
              {projectSearch &&
                !projects.some((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase())) && (
                  <EmptyState
                    title="Проект не найден"
                    text="Попробуйте другое название."
                    action={() => setProjectSearch('')}
                    actionText="Показать все проекты"
                  />
                )}
            </>
          )}

          {(page === 'catalog' || page === 'favorites') && (
            <>
              <section className="page-heading">
                <h1>
                  {page === 'catalog' ? 'Найдите идеальные материалы' : 'То, что вам приглянулось'}
                  <span className="accent-dot">.</span>
                </h1>
                <p>
                  {page === 'catalog'
                    ? 'Выбирайте фактуры, сравнивайте и рассчитывайте нужное количество.'
                    : 'Сохранённые материалы для ваших будущих решений.'}
                </p>
              </section>

              <div className="page-tools">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    placeholder="Название материала или бренд"
                    aria-label="Поиск материалов"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="icon-button"
                      aria-label="Очистить поиск материалов"
                      onClick={() => setSearch('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <label className="sort-select">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Сортировка материалов"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recommended">По умолчанию</option>
                    <option value="price-up">Сначала дешевле</option>
                    <option value="price-down">Сначала дороже</option>
                  </select>
                </label>
              </div>
              <div className="filter-chips">
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                  Все материалы
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={filter === c.id ? 'active' : ''}
                    onClick={() => setFilter(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
                <span>{visibleProducts.length} позиций</span>
              </div>
              <div className="product-grid">
                {visibleProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    saved={favorites.includes(p.id)}
                    onFavorite={() => favorite(p.id)}
                    open={() => setDialog({ product: p })}
                  />
                ))}
              </div>
              {!visibleProducts.length && (
                <EmptyState
                  title={
                    page === 'favorites' && !favorites.length
                      ? 'Сохраните то, что нравится'
                      : 'Пока ничего не найдено'
                  }
                  text={
                    page === 'favorites' && !favorites.length
                      ? 'Нажмите на сердечко в карточке материала — он появится здесь.'
                      : 'Попробуйте изменить запрос или выбрать другую категорию.'
                  }
                  action={() => {
                    if (page === 'favorites' && !favorites.length) navigate('catalog');
                    else {
                      setFilter('all');
                      setSearch('');
                    }
                  }}
                  actionText={
                    page === 'favorites' && !favorites.length ? 'Посмотреть материалы' : 'Сбросить фильтры'
                  }
                />
              )}
            </>
          )}

          {page === 'guide' && (
            <>
              <section className="page-heading">
                <h1>
                  Чуть больше уверенности<span className="accent-dot">.</span>
                </h1>
                <p>Понятные ответы на вопросы, с которых начинается ремонт.</p>
              </section>
              <div className="guide-banner">
                <div>
                  <span className="eyebrow">НЕБОЛЬШАЯ ПОДГОТОВКА. БОЛЬШАЯ РАЗНИЦА.</span>
                  <h2>
                    Дом складывается
                    <br />
                    из верных решений.
                  </h2>
                  <p>
                    Собрали самое нужное, чтобы вам было
                    <br />
                    проще сделать следующий шаг.
                  </p>
                </div>
                <RoomScene />
              </div>
              <div className="guide-list">
                {guides.map((g, i) => (
                  <article className={`guide-item ${article === i ? 'open' : ''}`} key={g.title}>
                    <button
                      onClick={() => setArticle(article === i ? null : i)}
                      aria-expanded={article === i}
                      aria-controls={`article-${i}`}
                    >
                      <span className="guide-number">0{i + 1}</span>
                      <div>
                        <small>
                          {g.tag} <span>· {g.time}</span>
                        </small>
                        <h2>{g.title}</h2>
                      </div>
                      <span className="guide-plus">
                        {article === i ? <X size={20} /> : <Plus size={20} />}
                      </span>
                    </button>
                    {article === i && (
                      <div className="guide-content" id={`article-${i}`}>
                        <p>{g.text}</p>
                        <button className="text-button" onClick={() => navigate('calculator')}>
                          Попробовать в калькуляторе <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
          <footer className="footer" aria-hidden="true" />
        </main>
      </div>

      {page === 'calculator' && !mobileMenu && (
        <div className="mobile-budget-bar" aria-label="Бюджет проекта">
          <div>
            <small>Ориентир по бюджету</small>
            <strong>{calculationRequest.data ? money(calculation.total) : '—'}</strong>
          </div>
          <button className="button primary" onClick={() => (step < 2 ? nextStep(step + 1) : exportCsv())}>
            {step === 0 ? 'К материалам' : step === 1 ? 'К смете' : 'Скачать CSV'}
            {step < 2 ? <ArrowRight size={16} /> : <ArrowDownToLine size={16} />}
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={17} />
          </span>
          {toast}
          <button className="icon-button" onClick={() => setToast('')} aria-label="Скрыть уведомление">
            <X size={16} />
          </button>
        </div>
      )}
      {(dialog === 'new-room' || dialog === 'new-project' || dialog === 'rename') && (
        <NameDialog
          kind={dialog}
          project={project}
          close={() => setDialog(null)}
          submit={(name, type) => {
            if (dialog === 'new-room') {
              const next = createRoom(type, name);
              updateProject({ rooms: [...project.rooms, next] });
              setRoomId(next.id);
              notify('Новое помещение добавлено');
            } else if (dialog === 'new-project') {
              const next = createProject(name);
              next.rooms = [createRoom('living')];
              setProjects((prev) => [...prev, next]);
              setProjectId(next.id);
              setRoomId(next.rooms[0].id);
              setStep(0);
              navigate('calculator');
              notify('Ваш новый проект готов к работе');
            } else updateProject({ name });
            setDialog(null);
          }}
        />
      )}
      {dialog === 'plan' && (
        <Modal title={`${room.name} — план помещения`} close={() => setDialog(null)} wide>
          <RoomPlan room={room} expanded />
          <p className="modal-note">
            Длина {number(room.length)} м · ширина {number(room.width)} м · высота {number(room.height)} м.
            Мебель и положение проёмов показаны схематично.
          </p>
        </Modal>
      )}
      {dialog === 'region' && (
        <Modal title="Ваш город" close={() => setDialog(null)}>
          <p className="modal-description">
            Выберите город проекта.
          </p>
          <div className="region-list">
            {regions.map((city) => (
              <button
                key={city}
                onClick={() => {
                  setRegion(city);
                  setDialog(null);
                }}
              >
                <MapPin size={17} />
                {city}
                {region === city && <Check size={17} />}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === 'profile' && (
        <Modal title="Ваша мастерская" close={() => setDialog(null)}>
          <div className="guest-profile">
            <span>Г</span>
            <div>
              <h3>Гость</h3>
              <p>Ваше пространство для планов</p>
            </div>
          </div>
          <p className="modal-description">
            {settings.mode === 'mock'
              ? 'Проекты и избранное сохраняются в локальной заглушке этого браузера.'
              : 'Проекты и избранное сохраняются на настроенном сервере.'}{' '}
            Для переноса сметы на другое устройство скачайте CSV.
          </p>
          <button
            className="button primary full-width"
            onClick={() => {
              setDialog(null);
              navigate('projects');
            }}
          >
            Открыть мои проекты <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {dialog === 'help' && (
        <Modal title="От замеров до понятной сметы" close={() => setDialog(null)}>
          <div className="help-steps">
            {[
              'Добавьте помещения и укажите размеры. Учитывайте окна, двери, влажность и нагрузку.',
              'Выберите материалы для каждой комнаты. Калькулятор покажет расход и целое количество упаковок.',
              'Проверьте смету, добавьте ориентир по работам и сохраните результат в CSV или PDF через печать.',
            ].map((text, i) => (
              <div key={text}>
                <span>0{i + 1}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {dialog === 'delete-project' && (
        <Modal title="Удалить проект?" close={() => setDialog(null)}>
          <p className="modal-description">
            «{project.name}» и его помещения будут удалены{' '}
            {settings.mode === 'mock' ? 'из локальной заглушки' : 'на сервере'}. Скачанные сметы сохранятся.
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setDialog(null)}>
              Оставить проект
            </button>
            <button
              className="button danger"
              onClick={() => {
                const remaining = projects.filter((p) => p.id !== project.id);
                setProjects(remaining);
                setProjectId(remaining[0].id);
                setDialog(null);
                notify('Проект удалён');
              }}
            >
              Удалить
            </button>
          </div>
        </Modal>
      )}
      {dialog && typeof dialog === 'object' && 'category' in dialog && (
        <Modal
          title={dialog.category === 'floor' ? 'Выбрать напольное покрытие' : 'Выбрать отделку стен'}
          close={() => setDialog(null)}
          wide
        >
          <p className="modal-description">
            Материалы для комнаты «{room.name}»{room.wet ? ' с повышенной влажностью' : ''}
            {room.heavy ? ' и высокой нагрузкой' : ''}.{' '}
            {settings.mode === 'mock' ? 'Цены демонстрационные.' : 'Цены из серверного каталога.'}
          </p>
          <div className="replacement-grid">
            {products
              .filter(
                (p) => p.category === dialog.category && (!room.wet || p.wet) && (!room.heavy || p.heavy),
              )
              .map((p) => (
                <button
                  className={`replacement-option ${p.id === (dialog.category === 'floor' ? room.floor : room.wall) ? 'selected' : ''}`}
                  key={p.id}
                  onClick={() => {
                    updateRoom(dialog.category === 'floor' ? { floor: p.id } : { wall: p.id });
                    setDialog(null);
                    notify('Материал заменён, смета пересчитана');
                  }}
                >
                  <ProductVisual product={p} />
                  <strong>{p.name}</strong>
                  <span>
                    {money(p.price)} / {p.unit}
                  </span>
                  <small>{number(p.coverage)} м² в упаковке</small>
                  {p.id === (dialog.category === 'floor' ? room.floor : room.wall) && (
                    <span className="replacement-check">
                      <Check size={16} />
                    </span>
                  )}
                </button>
              ))}
          </div>
        </Modal>
      )}
      {dialog && typeof dialog === 'object' && 'product' in dialog && (
        <ProductDialog
          product={dialog.product}
          room={room}
          reserve={project.reserve}
          isFavorite={favorites.includes(dialog.product.id)}
          toggleFavorite={() => favorite(dialog.product.id)}
          close={() => setDialog(null)}
          apply={() => {
            const p = dialog.product;
            updateRoom(p.category === 'floor' ? { floor: p.id } : { wall: p.id });
            setDialog(null);
            notify(`Материал выбран для комнаты «${room.name}»`);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
  actionText,
}: {
  title: string;
  text: string;
  action: () => void;
  actionText: string;
}) {
  return (
    <div className="empty-state">
      <Search size={32} strokeWidth={1.3} />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="button secondary" onClick={action}>
        {actionText}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function ProductCard({
  product: p,
  saved,
  onFavorite,
  open,
}: {
  product: Product;
  saved: boolean;
  onFavorite: () => void;
  open: () => void;
}) {
  return (
    <article className="product-card panel">
      <div className="product-card-image">
        <button className="product-art-button" onClick={open} aria-label={`Подробнее: ${p.name}`}>
          <ProductVisual product={p} large />
        </button>
        <button
          className={`favorite-button ${saved ? 'saved' : ''}`}
          onClick={onFavorite}
          aria-pressed={saved}
          aria-label={`${saved ? 'Убрать из избранного' : 'В избранное'}: ${p.name}`}
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
        {p.wet && (
          <span className="wet-badge">
            <Droplets size={12} />
            Влагостойкий
          </span>
        )}
      </div>
      <div className="product-card-info">
        <div className="product-brand">
          <span>{p.brand}</span>
          <span>
            <Star size={12} fill="currentColor" />
            {p.rating}
          </span>
        </div>
        <button className="product-name-button" onClick={open}>
          {p.name}
        </button>
        <p>{p.category === 'electric' ? 'Цена за одну точку' : `${number(p.coverage)} м² / ${p.unit}`}</p>
        <div className="product-price">
          <strong>
            {money(p.price)} <small>/ {p.unit}</small>
          </strong>
          <button aria-label={`Рассчитать: ${p.name}`} className="product-calc-button" onClick={open}>
            <Calculator size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

function NameDialog({
  kind,
  project,
  close,
  submit,
}: {
  kind: 'new-room' | 'new-project' | 'rename';
  project: Project;
  close: () => void;
  submit: (name: string, type: RoomType) => void;
}) {
  const [type, setType] = useState<RoomType>('bedroom');
  const [name, setName] = useState(
    kind === 'rename' ? project.name : kind === 'new-room' ? 'Спальня' : 'Мой новый дом',
  );
  const [formError, setFormError] = useState('');
  return (
    <Modal
      title={
        kind === 'new-room'
          ? 'Добавим новое пространство'
          : kind === 'rename'
            ? 'Название вашего проекта'
            : 'С чего начнём перемены?'
      }
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFormError('');
          try {
            if (name.trim()) submit(name.trim(), type);
          } catch (cause) {
            setFormError((cause as Error).message);
          }
        }}
      >
        <p className="modal-description">
          {kind === 'new-room'
            ? 'Каждую комнату рассчитаем отдельно и соберём в общую смету.'
            : 'Дайте проекту имя — так его будет проще найти в мастерской.'}
        </p>
        {kind === 'new-room' && (
          <div className="room-type-grid">
            {roomTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                className={type === t.id ? 'selected' : ''}
                aria-pressed={type === t.id}
                onClick={() => {
                  setType(t.id);
                  setName(t.name);
                }}
              >
                <RoomIcon type={t.id} size={24} />
                <span>{t.name}</span>
                {type === t.id && <Check size={13} />}
              </button>
            ))}
          </div>
        )}
        <label className="form-field">
          <span>{kind === 'new-room' ? 'Название помещения' : 'Название проекта'}</span>
          <input
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, наша новая квартира"
          />
        </label>
        <RequestState error={formError} />
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={close}>
            Отмена
          </button>
          <button className="button primary" disabled={!name.trim()} type="submit">
            {kind === 'new-room' ? 'Добавить помещение' : kind === 'rename' ? 'Сохранить' : 'Создать проект'}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ProductDialog({
  product: p,
  room,
  reserve,
  isFavorite,
  toggleFavorite,
  close,
  apply,
}: {
  product: Product;
  room: Room;
  reserve: number;
  isFavorite: boolean;
  toggleFavorite: () => void;
  close: () => void;
  apply: () => void;
}) {
  const { api, settings } = useRuntime();
  const [surface, setSurface] = useState(
    p.category === 'floor' ? area(room) : p.category === 'electric' ? 4 : wallArea(room),
  );
  const [withReserve, setWithReserve] = useState(true);
  const calculationInput = { surface, reserve: withReserve ? reserve : 0 };
  const result = useQuery(
    `product:${p.id}:${JSON.stringify(calculationInput)}`,
    (signal) => api.productCalculation(p.id, calculationInput, signal),
    100,
  );
  const suitable = (!room.wet || p.wet) && (!room.heavy || p.heavy);
  const selectable = p.category === 'floor' || p.category === 'walls';
  return (
    <Modal title="Материал в деталях" close={close} wide>
      <div className="product-detail">
        <div>
          <ProductVisual product={p} large />
          <button className={`detail-favorite ${isFavorite ? 'saved' : ''}`} onClick={toggleFavorite}>
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? 'В избранном' : 'Сохранить в избранное'}
          </button>
        </div>
        <div>
          <div className="eyebrow">
            {p.brand}{' '}
            <span className="rating">
              <Star size={12} fill="currentColor" />
              {p.rating}
            </span>
          </div>
          <h2>{p.name}</h2>
          <p className="product-description">{p.description}</p>
          <div className="detail-price">
            {money(p.price)} <span>/ {p.unit}</span>
          </div>
          <div className="product-calculator">
            <h3>
              <Calculator size={17} /> Сколько понадобится?
            </h3>
            <DimensionInput
              label={p.category === 'electric' ? 'Количество точек' : 'Площадь поверхности'}
              value={surface}
              min={1}
              max={1000}
              unit={p.category === 'electric' ? 'шт.' : 'м²'}
              onChange={setSurface}
            />
            {p.category !== 'electric' && (
              <Toggle
                label={`С запасом ${reserve}%`}
                checked={withReserve}
                onChange={() => setWithReserve((v) => !v)}
              />
            )}
            <RequestState
              loading={result.status === 'loading'}
              error={result.error}
              retry={result.refresh}
              label="Рассчитываем количество…"
            />
            <div className="product-calc-result" aria-live="polite">
              <span>
                <strong>
                  {result.data?.quantity ?? '—'} {p.unit}
                </strong>
                <small>Округлено до целого</small>
              </span>
              <b>{result.data ? money(result.data.total) : '—'}</b>
            </div>
          </div>
          {selectable ? (
            <>
              <button className="button primary full-width" disabled={!suitable} onClick={apply}>
                {suitable ? `Выбрать для комнаты «${room.name}»` : 'Не подходит условиям комнаты'}
                {suitable && <ArrowRight size={16} />}
              </button>
              <p className="modal-note">
                {suitable
                  ? 'В смете количество будет рассчитано по размерам выбранной комнаты.'
                  : 'Проверьте влагостойкость и устойчивость к нагрузке. Для этой комнаты доступны другие покрытия.'}
              </p>
            </>
          ) : (
            <p className="modal-note">
              Подготовительные материалы и электрика добавляются в смету автоматически в зависимости от типа
              ремонта и условий комнаты.
            </p>
          )}
          <span className="detail-demo">
            {settings.mode === 'mock' ? 'MOCK · демонстрационный товар и цена' : 'NOT MOCK · данные сервера'}
          </span>
        </div>
      </div>
    </Modal>
  );
}

function MaterialPrice({
  product,
  surface,
  reserve,
}: {
  product: Product;
  surface: number;
  reserve: number;
}) {
  const { api } = useRuntime();
  const query = useQuery(
    `material:${product.id}:${surface}:${reserve}`,
    (signal) => api.productCalculation(product.id, { surface, reserve }, signal),
    100,
  );
  if (query.error) return <RequestState error={query.error} retry={query.refresh} />;
  return (
    <strong>
      {query.data ? money(query.data.total) : 'Рассчитываем…'}{' '}
      <small>{query.data ? `${query.data.quantity} ${query.data.unit}` : ''}</small>
    </strong>
  );
}
function ProjectPrice({ project }: { project: Project }) {
  const { api } = useRuntime();
  const query = useQuery(`project-card:${JSON.stringify(project)}`, (signal) =>
    api.estimate(project, signal),
  );
  return (
    <strong>
      {query.data ? (
        money(query.data.total)
      ) : query.error ? (
        <button className="text-button" onClick={query.refresh} title={query.error}>
          Повторить расчёт
        </button>
      ) : (
        'Рассчитываем…'
      )}
    </strong>
  );
}
