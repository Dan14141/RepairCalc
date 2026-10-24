import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  X,
  Minus,
  Plus,
  Sofa,
  CookingPot,
  Bath,
  BedDouble,
  Baby,
  Sun,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { area, number, type Product, type Room, type RoomType } from './data';

export const roomIcons = {
  living: Sofa,
  kitchen: CookingPot,
  bathroom: Bath,
  bedroom: BedDouble,
  kids: Baby,
  balcony: Sun,
};
export function RoomIcon({ type, size = 20 }: { type: RoomType; size?: number }) {
  const Icon = roomIcons[type];
  return <Icon size={size} strokeWidth={1.65} />;
}
export function Logo() {
  return (
    <div className="logo">
      <span>
        Repair<span className="logo-light">Calc</span>
        <small>УМНЫЙ КАЛЬКУЛЯТОР</small>
      </span>
    </div>
  );
}

export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, a[href], [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        }
        if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`modal ${wide ? 'modal-wide' : ''}`}
      >
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Закрыть">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DimensionInput({
  label,
  value,
  onChange,
  min = 0.5,
  max = 30,
  unit = 'м',
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState(false);
  const editing = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!editing.current) {
      setDraft(String(value));
      setError(false);
    }
  }, [value]);
  const parse = (v: string) => Number(v.replace(',', '.'));
  return (
    <label className="dimension-field" htmlFor={id}>
      <span>{label}</span>
      <div className={error ? 'input-unit invalid' : 'input-unit'}>
        <input
          id={id}
          aria-label={label}
          inputMode="decimal"
          value={draft}
          aria-invalid={error}
          aria-describedby={error ? `${id}-error` : undefined}
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            const n = parse(next);
            const valid = next.trim() !== '' && Number.isFinite(n) && n >= min && n <= max;
            setError(!valid);
            if (valid) onChange(Math.round(n * 100) / 100);
          }}
          onBlur={() => {
            editing.current = false;
            setDraft(String(value));
            setError(false);
          }}
        />
        <span aria-hidden="true">{unit}</span>
      </div>
      {error && (
        <small id={`${id}-error`} className="field-error">
          От {min} до {max} {unit}
        </small>
      )}
    </label>
  );
}
export function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="counter-row">
      <span>{label}</span>
      <div className="counter">
        <button aria-label={`Уменьшить: ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)}>
          <Minus size={13} />
        </button>
        <span>{value}</span>
        <button aria-label={`Увеличить: ${label}`} disabled={value >= 10} onClick={() => onChange(value + 1)}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}) {
  return (
    <button role="switch" aria-checked={checked} onClick={onChange} className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className={`toggle ${checked ? 'on' : ''}`}>
        <span />
      </span>
    </button>
  );
}

export function RoomPlan({ room, expanded = false }: { room: Room; expanded?: boolean }) {
  const patternId = useId();
  const w = Math.min(228, (185 * room.length) / room.width),
    h = Math.min(175, (200 * room.width) / room.length);
  const x = (350 - w) / 2,
    y = (260 - h) / 2;
  return (
    <svg
      className={`room-plan ${expanded ? 'expanded' : ''}`}
      viewBox="0 0 350 280"
      role="img"
      aria-label={`План комнаты ${room.name}: ${number(room.length)} на ${number(room.width)} метра`}
    >
      <defs>
        <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".65" fill="#d2d4c9" />
        </pattern>
        <pattern id={`${patternId}-floor`} width="35" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 0H35V14H0Z" fill="none" stroke="#d8ccaf" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="350" height="280" fill={`url(#${patternId})`} />
      <path
        d={`M${x} ${y - 17}v-13 M${x + w} ${y - 17}v-13 M${x} ${y - 23}h${w}`}
        fill="none"
        stroke="#9caa9f"
        strokeWidth=".8"
      />
      <path
        d={`M${x - 18} ${y}h-12 M${x - 18} ${y + h}h-12 M${x - 24} ${y}v${h}`}
        fill="none"
        stroke="#9caa9f"
        strokeWidth=".8"
      />
      <rect x={155} y={y - 32} width="40" height="17" rx="3" fill="#f4f5ef" />
      <text x="175" y={y - 20} textAnchor="middle" className="plan-measure">
        {number(room.length)} м
      </text>
      <text
        transform={`translate(${x - 30},${y + h / 2}) rotate(-90)`}
        textAnchor="middle"
        className="plan-measure"
      >
        {number(room.width)} м
      </text>
      <rect x={x} y={y} width={w} height={h} fill="#eee7d7" stroke="#6b7569" strokeWidth="6" />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill={`url(#${patternId}-floor)`} />
      {room.windows > 0 && (
        <g>
          <path d={`M${x + w * 0.35} ${y}h${w * 0.4}`} stroke="#f4f5ef" strokeWidth="7" />
          <path
            d={`M${x + w * 0.35} ${y - 1.5}h${w * 0.4}m0 3h-${w * 0.4}`}
            stroke="#95b7b9"
            strokeWidth="1.2"
          />
        </g>
      )}
      <g transform={`translate(${x + 6},${y + 7}) scale(${(w - 12) / 220},${(h - 14) / 160})`}>
        {(room.type === 'living' || room.type === 'kids') && (
          <>
            <rect x="14" y="20" width="51" height="110" rx="6" fill="#c1c4ae" stroke="#9a9f86" />
            <rect x="16" y="29" width="12" height="92" rx="3" fill="#aeb39b" stroke="#9a9f86" />
            <rect x="30" y="30" width="30" height="40" rx="4" fill="#d0d1bd" stroke="#a1a58f" />
            <rect x="30" y="77" width="30" height="40" rx="4" fill="#d0d1bd" stroke="#a1a58f" />
            <rect x="82" y="47" width="71" height="69" rx="24" fill="#e5deca" stroke="#d4c9af" />
            <rect x="96" y="65" width="43" height="34" rx="13" fill="#ba9470" stroke="#a68562" />
            <circle cx="126" cy="75" r="6" fill="#ece3cd" />
            <rect x="188" y="47" width="13" height="64" fill="#b9a485" stroke="#a78f71" />
            <path d="M194 54v50" stroke="#657067" strokeWidth="3" />
          </>
        )}
        {room.type === 'bedroom' && (
          <>
            <rect x="54" y="8" width="110" height="120" rx="4" fill="#c0b19d" stroke="#a1907c" />
            <rect x="59" y="13" width="100" height="109" rx="5" fill="#e6dfd0" stroke="#c0b19d" />
            <rect x="65" y="20" width="39" height="24" rx="5" fill="#f3eee3" />
            <rect x="114" y="20" width="39" height="24" rx="5" fill="#f3eee3" />
            <rect x="59" y="68" width="100" height="48" fill="#a4af9a" />
            <rect x="27" y="12" width="22" height="24" fill="#c6a47b" />
            <rect x="169" y="12" width="22" height="24" fill="#c6a47b" />
          </>
        )}
        {room.type === 'kitchen' && (
          <>
            <path d="M7 6H210V37H42V118H7Z" fill="#c9cbb8" stroke="#9fa88e" />
            <rect x="70" y="11" width="35" height="22" rx="5" fill="#ede9da" stroke="#9da593" />
            <circle cx="156" cy="17" r="7" fill="none" stroke="#8a9180" />
            <circle cx="177" cy="17" r="7" fill="none" stroke="#8a9180" />
            <rect x="84" y="66" width="78" height="49" rx="7" fill="#c0a17b" stroke="#a98b66" />
            <rect x="96" y="54" width="23" height="9" rx="4" fill="#909a80" />
            <rect x="130" y="54" width="23" height="9" rx="4" fill="#909a80" />
            <rect x="96" y="118" width="23" height="9" rx="4" fill="#909a80" />
          </>
        )}
        {room.type === 'bathroom' && (
          <>
            <rect x="7" y="8" width="71" height="140" rx="5" fill="#e2e6dd" stroke="#a1ada1" />
            <rect x="14" y="16" width="57" height="123" rx="23" fill="#f7f5ed" stroke="#b8c2b6" />
            <circle cx="42" cy="32" r="3" fill="#929c91" />
            <rect x="155" y="8" width="54" height="42" fill="#c1b398" stroke="#a39982" />
            <ellipse cx="181" cy="28" rx="20" ry="12" fill="#f5f2e9" stroke="#a9ae9e" />
            <rect x="163" y="89" width="41" height="19" rx="3" fill="#f1f0e7" stroke="#aab5a7" />
            <ellipse cx="184" cy="124" rx="18" ry="23" fill="#f8f6ee" stroke="#aab5a7" />
          </>
        )}
        {room.type === 'balcony' && (
          <>
            <rect x="18" y="12" width="184" height="19" fill="#c8b796" />
            <circle cx="165" cy="95" r="30" fill="#bca480" />
            <rect x="72" y="83" width="38" height="44" rx="12" fill="#b7c3a5" />
          </>
        )}
        <circle cx="193" cy="138" r="13" fill="#b2bca1" />
        <path d="m193 147-7-12 9 4 6-12-1 16" stroke="#75886a" fill="none" strokeWidth="2" />
      </g>
      {room.doors > 0 && (
        <g>
          <path d={`M${x + w * 0.52} ${y + h}h34`} stroke="#f4f5ef" strokeWidth="8" />
          <path
            d={`M${x + w * 0.52} ${y + h}v-34a34 34 0 0 1 34 34`}
            fill="none"
            stroke="#9ca58e"
            strokeWidth="1"
          />
          <path d={`M${x + w * 0.52} ${y + h}v-34`} stroke="#6b7569" strokeWidth="2" />
        </g>
      )}
      <g transform="translate(291,237)">
        <path d="m0 12 5-15 5 15-5-3Z" fill="#a5aea0" />
        <text x="5" y="-8" textAnchor="middle" fill="#91998d" fontSize="8">
          С
        </text>
      </g>
      <text x="175" y="261" textAnchor="middle" className="plan-caption">
        {number(area(room))} м² · ВИД СВЕРХУ
      </text>
    </svg>
  );
}

export function RoomScene({ variant = 'green' }: { variant?: 'green' | 'clay' }) {
  const id = useId();
  return (
    <svg viewBox="0 0 440 300" className={`room-scene ${variant}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#dedaca" />
          <stop offset="1" stopColor="#c2c8b3" />
        </linearGradient>
        <linearGradient id={`${id}floor`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#debe95" />
          <stop offset="1" stopColor="#b58e67" />
        </linearGradient>
        <filter id={`${id}shadow`}>
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <ellipse cx="238" cy="253" rx="168" ry="22" fill="#536446" opacity=".12" filter={`url(#${id}shadow)`} />
      <path d="m42 184 176 88 187-99-178-89Z" fill={`url(#${id}floor)`} />
      <path d="m42 184 176 88v9L42 193Z" fill="#b5936b" />
      <path d="m218 272 187-99v9L218 281Z" fill="#947b5d" />
      <path d="M42 184V48l185-9v145l-9 88Z" fill={`url(#${id}wall)`} />
      <path d="M42 48 219 137l8-4V39Z" fill="#e9e5d9" />
      <path d="M42 48v136l176 88V137Z" fill="#d1d5c3" />
      <path d="M218 137 405 38v135L218 272Z" fill="#eee9dd" />
      <path
        d="m230 264 175-93m-156 104 156-84M63 194l187-99m-166 110 187-99m-166 110 187-99m-166 110 187-99m-165 110 187-99m-166 110 187-99m-166 110 187-99"
        fill="none"
        stroke="#977a53"
        strokeWidth=".7"
        opacity=".25"
      />
      <path d="M275 114v66l80-42V72Z" fill="#c3cbbd" stroke="#d7d2c5" strokeWidth="7" />
      <path d="m282 120 66-35v48l-66 35Z" fill="#f7f3dd" />
      <path d="m315 99 0 52m-33-8 66-35" stroke="#ddd9c8" strokeWidth="3" />
      <path d="m284 169 60-32 45 57-60 32Z" fill="#f6e7c8" opacity=".5" />
      <path d="m118 191 93 47 80-42-96-46Z" fill="#dbd3be" />
      <path d="m120 195 91 45 78-41" fill="none" stroke="#beb498" strokeWidth="2" />
      <path d="m74 160 78 39 58-30-78-39Z" fill="#7c8969" />
      <path d="M74 160v29l78 39v-29Z" fill="#788765" />
      <path d="m152 199 58-30v29l-58 30Z" fill="#596b4e" />
      <path d="M77 136v29l76 39v-29Z" fill="#a9b293" />
      <path d="m77 136 10-6 76 39-10 6Z" fill="#bdc3a8" />
      <path d="m153 175 10-6v28l-10 7Z" fill="#879577" />
      <path d="m89 167 35 17 21-11-35-17Z" fill="#c0c6ab" stroke="#a6b18f" />
      <path d="m127 187 26 13 39-21-27-13Z" fill="#bdc3a6" stroke="#a6b18f" />
      <path d="m73 162 10-5 17 9v18l-10 5-17-9Z" fill="#9aa788" />
      <path d="m151 203 10-5 43-23v16l-43 23-10 5Z" fill="#a0ad8b" />
      <path d="m189 206 35 17 38-20-35-17Z" fill="#a47d58" />
      <path d="m189 206 35 17v6l-35-17Z" fill="#896448" />
      <path d="m224 223 38-20v6l-38 20Z" fill="#71513c" />
      <path d="m196 214v16m58-18v14m-30 2v14" stroke="#846446" strokeWidth="3" />
      <ellipse cx="228" cy="201" rx="10" ry="5" fill="#e9dcc5" />
      <path d="M225 199v-12h7v12" fill="#c9a080" />
      <path d="m229 186-8-13m8 13 6-19" stroke="#839374" strokeWidth="1.5" />
      <path d="m294 194 66-35v28l-66 35Z" fill="#baa184" />
      <path d="m285 190 66-35 9 4-66 35Z" fill="#d3b693" />
      <path d="m285 190 9 4v28l-9-4Z" fill="#a68b6d" />
      <path d="m316 184v22m23-34v22" stroke="#978366" />
      <path d="m300 177 40-21v-30l-40 21Z" fill="#505c4e" />
      <path d="m304 171 31-16v-20l-31 16Z" fill="#697663" />
      <path d="m359 183 10 5 12-6-2-25-18 2Z" fill="#b18d6e" />
      <ellipse cx="370" cy="158" rx="10" ry="5" fill="#bca181" />
      <path d="m369 160-1-48m1 33-16-13m16 4 15-13" stroke="#627954" strokeWidth="2.5" />
      <ellipse cx="354" cy="129" rx="7" ry="16" transform="rotate(-45 354 129)" fill="#81916c" />
      <ellipse cx="380" cy="118" rx="7" ry="18" transform="rotate(35 380 118)" fill="#788b61" />
      <ellipse cx="366" cy="109" rx="8" ry="18" transform="rotate(-10 366 109)" fill="#93a17c" />
      <path d="m122 113 28 14V91l-28-14Z" fill="#ede5d3" stroke="#ad977b" strokeWidth="2" />
      <path d="m128 108 16 8V98l-16-8Z" fill="#b59073" />
      <circle cx="138" cy="102" r="5" fill="#c6c6a8" />
    </svg>
  );
}

export function ProductVisual({ product, large = false }: { product: Product; large?: boolean }) {
  return (
    <div
      className={`product-visual texture-${product.texture} ${large ? 'large' : ''}`}
      style={{ '--swatch': product.color } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="product-object">
        {['paint', 'can', 'bag'].includes(product.texture) ? (
          <>
            <div className="pack-top" />
            <div className="pack-label">
              <b>{product.brand}</b>
              <span>
                {product.texture === 'paint' ? 'COLOUR' : product.texture === 'can' ? 'GRUND' : 'PRO'}
                <br />
                <small>{product.texture === 'paint' ? 'для вашего дома' : 'основа хорошего ремонта'}</small>
              </span>
              <i />
            </div>
          </>
        ) : product.texture === 'socket' ? (
          <div className="socket-inner">
            <i />
            <i />
          </div>
        ) : (
          <>
            <span />
            <span />
            <span />
          </>
        )}
      </div>
    </div>
  );
}
export function Tip({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: () => void;
}) {
  return (
    <div className="tip">
      <span className="tip-check">
        <Check size={14} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      {action && (
        <button className="icon-button" aria-label="Подробнее" onClick={action}>
          <ArrowUpRight size={19} />
        </button>
      )}
    </div>
  );
}
