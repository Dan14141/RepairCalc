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
import roomSceneImage from './assets/scandinavian-room.webp';

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
        <small>Умный калькулятор</small>
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
          <circle cx="1" cy="1" r=".65" fill="var(--drawing-pigment-1)" />
        </pattern>
        <pattern id={`${patternId}-floor`} width="35" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 0H35V14H0Z" fill="none" stroke="var(--drawing-pigment-2)" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="350" height="280" fill={`url(#${patternId})`} />
      <path
        d={`M${x} ${y - 17}v-13 M${x + w} ${y - 17}v-13 M${x} ${y - 23}h${w}`}
        fill="none"
        stroke="var(--drawing-pigment-3)"
        strokeWidth=".8"
      />
      <path
        d={`M${x - 18} ${y}h-12 M${x - 18} ${y + h}h-12 M${x - 24} ${y}v${h}`}
        fill="none"
        stroke="var(--drawing-pigment-3)"
        strokeWidth=".8"
      />
      <rect x={155} y={y - 32} width="40" height="17" rx="3" fill="var(--drawing-pigment-4)" />
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
      <rect x={x} y={y} width={w} height={h} fill="var(--drawing-pigment-5)" stroke="var(--drawing-pigment-6)" strokeWidth="6" />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill={`url(#${patternId}-floor)`} />
      {room.windows > 0 && (
        <g>
          <path d={`M${x + w * 0.35} ${y}h${w * 0.4}`} stroke="var(--drawing-pigment-4)" strokeWidth="7" />
          <path
            d={`M${x + w * 0.35} ${y - 1.5}h${w * 0.4}m0 3h-${w * 0.4}`}
            stroke="var(--drawing-pigment-7)"
            strokeWidth="1.2"
          />
        </g>
      )}
      <g transform={`translate(${x + 6},${y + 7}) scale(${(w - 12) / 220},${(h - 14) / 160})`}>
        {(room.type === 'living' || room.type === 'kids') && (
          <>
            <rect x="14" y="20" width="51" height="110" rx="6" fill="var(--drawing-pigment-8)" stroke="var(--drawing-pigment-9)" />
            <rect x="16" y="29" width="12" height="92" rx="3" fill="var(--drawing-pigment-10)" stroke="var(--drawing-pigment-9)" />
            <rect x="30" y="30" width="30" height="40" rx="4" fill="var(--drawing-pigment-11)" stroke="var(--drawing-pigment-12)" />
            <rect x="30" y="77" width="30" height="40" rx="4" fill="var(--drawing-pigment-11)" stroke="var(--drawing-pigment-12)" />
            <rect x="82" y="47" width="71" height="69" rx="24" fill="var(--drawing-pigment-13)" stroke="var(--drawing-pigment-14)" />
            <rect x="96" y="65" width="43" height="34" rx="13" fill="var(--drawing-pigment-15)" stroke="var(--drawing-pigment-16)" />
            <circle cx="126" cy="75" r="6" fill="var(--drawing-pigment-17)" />
            <rect x="188" y="47" width="13" height="64" fill="var(--drawing-pigment-18)" stroke="var(--drawing-pigment-19)" />
            <path d="M194 54v50" stroke="var(--drawing-pigment-20)" strokeWidth="3" />
          </>
        )}
        {room.type === 'bedroom' && (
          <>
            <rect x="54" y="8" width="110" height="120" rx="4" fill="var(--drawing-pigment-21)" stroke="var(--drawing-pigment-22)" />
            <rect x="59" y="13" width="100" height="109" rx="5" fill="var(--drawing-pigment-23)" stroke="var(--drawing-pigment-21)" />
            <rect x="65" y="20" width="39" height="24" rx="5" fill="var(--drawing-pigment-24)" />
            <rect x="114" y="20" width="39" height="24" rx="5" fill="var(--drawing-pigment-24)" />
            <rect x="59" y="68" width="100" height="48" fill="var(--drawing-pigment-25)" />
            <rect x="27" y="12" width="22" height="24" fill="var(--drawing-pigment-26)" />
            <rect x="169" y="12" width="22" height="24" fill="var(--drawing-pigment-26)" />
          </>
        )}
        {room.type === 'kitchen' && (
          <>
            <path d="M7 6H210V37H42V118H7Z" fill="var(--drawing-pigment-27)" stroke="var(--drawing-pigment-28)" />
            <rect x="70" y="11" width="35" height="22" rx="5" fill="var(--drawing-pigment-29)" stroke="var(--drawing-pigment-30)" />
            <circle cx="156" cy="17" r="7" fill="none" stroke="var(--drawing-pigment-31)" />
            <circle cx="177" cy="17" r="7" fill="none" stroke="var(--drawing-pigment-31)" />
            <rect x="84" y="66" width="78" height="49" rx="7" fill="var(--drawing-pigment-32)" stroke="var(--drawing-pigment-33)" />
            <rect x="96" y="54" width="23" height="9" rx="4" fill="var(--drawing-pigment-34)" />
            <rect x="130" y="54" width="23" height="9" rx="4" fill="var(--drawing-pigment-34)" />
            <rect x="96" y="118" width="23" height="9" rx="4" fill="var(--drawing-pigment-34)" />
          </>
        )}
        {room.type === 'bathroom' && (
          <>
            <rect x="7" y="8" width="71" height="140" rx="5" fill="var(--drawing-pigment-35)" stroke="var(--drawing-pigment-36)" />
            <rect x="14" y="16" width="57" height="123" rx="23" fill="var(--drawing-pigment-37)" stroke="var(--drawing-pigment-38)" />
            <circle cx="42" cy="32" r="3" fill="var(--drawing-pigment-39)" />
            <rect x="155" y="8" width="54" height="42" fill="var(--drawing-pigment-40)" stroke="var(--drawing-pigment-41)" />
            <ellipse cx="181" cy="28" rx="20" ry="12" fill="var(--drawing-pigment-42)" stroke="var(--drawing-pigment-43)" />
            <rect x="163" y="89" width="41" height="19" rx="3" fill="var(--drawing-pigment-44)" stroke="var(--drawing-pigment-45)" />
            <ellipse cx="184" cy="124" rx="18" ry="23" fill="var(--drawing-pigment-46)" stroke="var(--drawing-pigment-45)" />
          </>
        )}
        {room.type === 'balcony' && (
          <>
            <rect x="18" y="12" width="184" height="19" fill="var(--drawing-pigment-47)" />
            <circle cx="165" cy="95" r="30" fill="var(--drawing-pigment-48)" />
            <rect x="72" y="83" width="38" height="44" rx="12" fill="var(--drawing-pigment-49)" />
          </>
        )}
        <circle cx="193" cy="138" r="13" fill="var(--drawing-pigment-50)" />
        <path d="m193 147-7-12 9 4 6-12-1 16" stroke="var(--drawing-pigment-51)" fill="none" strokeWidth="2" />
      </g>
      {room.doors > 0 && (
        <g>
          <path d={`M${x + w * 0.52} ${y + h}h34`} stroke="var(--drawing-pigment-4)" strokeWidth="8" />
          <path
            d={`M${x + w * 0.52} ${y + h}v-34a34 34 0 0 1 34 34`}
            fill="none"
            stroke="var(--drawing-pigment-52)"
            strokeWidth="1"
          />
          <path d={`M${x + w * 0.52} ${y + h}v-34`} stroke="var(--drawing-pigment-6)" strokeWidth="2" />
        </g>
      )}
      <g transform="translate(291,237)">
        <path d="m0 12 5-15 5 15-5-3Z" fill="var(--drawing-pigment-53)" />
        <text x="5" y="-8" textAnchor="middle" fill="var(--drawing-pigment-54)" fontSize="8">
          С
        </text>
      </g>
      <text x="175" y="261" textAnchor="middle" className="plan-caption">
        {number(area(room))} м², вид сверху
      </text>
    </svg>
  );
}

export function RoomScene() {
  return (
    <img
      src={roomSceneImage}
      className="room-scene"
      width={1491}
      height={1055}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
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
