import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { area, number, type Room } from './data';

const FRAME = { width: 400, height: 300, left: 44, right: 24, top: 40, bottom: 44 };

function usePlanDimensions(room: Room) {
  const [dimensions, setDimensions] = useState({ id: room.id, length: room.length, width: room.width });
  const current = useRef(dimensions);
  useLayoutEffect(() => {
    const target = { id: room.id, length: room.length, width: room.width };
    const from = current.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    function publish(value: typeof target) {
      current.current = value;
      setDimensions(value);
    }
    function finish() {
      cancelAnimationFrame(frame);
      publish(target);
    }
    if (
      motion.matches ||
      from.id !== target.id ||
      (from.length === target.length && from.width === target.width)
    ) {
      finish();
      return;
    }
    // Interpolate metres once for the entire drawing. Separate CSS transitions
    // on scale and wall width would put dimension lines out of sync mid-resize.
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / 450);
      const eased = 1 - (1 - progress) ** 3;
      publish({
        id: target.id,
        length: from.length + (target.length - from.length) * eased,
        width: from.width + (target.width - from.width) * eased,
      });
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    const onMotionChange = () => {
      if (motion.matches) finish();
    };
    motion.addEventListener('change', onMotionChange);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', onMotionChange);
    };
  }, [room.id, room.length, room.width]);
  return dimensions.id === room.id ? dimensions : room;
}

export function RoomPlan({ room, expanded = false }: { room: Room; expanded?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const { length: L, width: W } = usePlanDimensions(room);
  const availableWidth = FRAME.width - FRAME.left - FRAME.right;
  const availableHeight = FRAME.height - FRAME.top - FRAME.bottom;
  const scale = Math.min(availableWidth / L, availableHeight / W, 90);
  const width = L * scale;
  const height = W * scale;
  const x = FRAME.left + (availableWidth - width) / 2;
  const y = FRAME.top + (availableHeight - height) / 2;
  const floorId = `${uid}-floor`;
  const tiled = room.type === 'kitchen' || room.type === 'bathroom';
  const windowWidth = Math.min(1.8, L * 0.45);
  const windowX = (L - windowWidth) / 2;
  // Openings are illustrative; keep even the swing inside the smallest allowed room.
  const doorWidth = Math.min(0.9, L - 0.2, W - 0.2);
  const doorX = Math.max(0.1, L - 0.3 - doorWidth);
  const dimensionY = y - 20;
  const dimensionX = x - 20;

  return (
    <svg
      className={`room-plan ${expanded ? 'expanded' : ''}`}
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      role="img"
      aria-label={`План комнаты ${room.name}: ${number(room.length)} на ${number(room.width)} метра`}
      aria-describedby={`${uid}-description`}
    >
      <desc id={`${uid}-description`}>
        Вид сверху, площадь {number(area(room))} м². Мебель и положение проёмов показаны схематично.
        Масштабная линейка соответствует одному метру.
      </desc>
      <defs>
        <pattern
          id={floorId}
          width={tiled ? 0.6 : 1.6}
          height={tiled ? 0.6 : 0.28}
          patternUnits="userSpaceOnUse"
        >
          <path
            className="plan-floor-joint"
            strokeWidth={0.5 / scale}
            d={tiled ? 'M0 .6V0H.6' : 'M0 0H1.6M0 .14H1.6M0 0V.14M.8 .14V.28'}
          />
        </pattern>
      </defs>

      <g className="plan-room" style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}>
        <rect className="plan-floor" width={L} height={W} />
        <rect className="plan-floor-pattern" width={L} height={W} fill={`url(#${floorId})`} />
        <g className="plan-furniture" key={room.type}>
          <Furniture room={{ ...room, length: L, width: W }} doorX={doorX} doorWidth={doorWidth} />
        </g>
        <rect className="plan-wall" width={L} height={W} />
        {room.windows > 0 && (
          <g className="plan-window">
            <path className="plan-gap" d={`M${windowX} 0h${windowWidth}`} />
            <rect className="plan-fixture" x={windowX} y={-0.06} width={windowWidth} height={0.12} />
            <path className="plan-glass" d={`M${windowX} 0h${windowWidth}`} />
          </g>
        )}
        {room.doors > 0 && (
          <g className="plan-door">
            <path className="plan-gap" d={`M${doorX} ${W}h${doorWidth}`} />
            <path className="plan-leaf" d={`M${doorX} ${W}v${-doorWidth}`} />
            <path
              className="plan-swing"
              d={`M${doorX} ${W - doorWidth}A${doorWidth} ${doorWidth} 0 0 1 ${doorX + doorWidth} ${W}`}
            />
          </g>
        )}
      </g>

      <g className="plan-dimensions">
        <path
          d={`M${x} ${dimensionY - 7}V${y - 6}M${x + width} ${dimensionY - 7}V${y - 6}M${x} ${dimensionY}H${x + width}M${x - 3} ${dimensionY + 3}l6-6M${x + width - 3} ${dimensionY + 3}l6-6`}
        />
        <path
          d={`M${dimensionX - 7} ${y}H${x - 6}M${dimensionX - 7} ${y + height}H${x - 6}M${dimensionX} ${y}V${y + height}M${dimensionX - 3} ${y + 3}l6-6M${dimensionX - 3} ${y + height + 3}l6-6`}
        />
        <text
          x={x + width / 2}
          y={dimensionY}
          textAnchor="middle"
          dominantBaseline="central"
          className="plan-measure"
        >
          {number(room.length)} м
        </text>
        <text
          transform={`translate(${dimensionX} ${y + height / 2}) rotate(-90)`}
          textAnchor="middle"
          dominantBaseline="central"
          className="plan-measure"
        >
          {number(room.width)} м
        </text>
      </g>

      <text x={FRAME.left} y={284} className="plan-caption">
        <tspan className="plan-area">{number(area(room))}</tspan> м²
      </text>
      <g className="plan-scale plan-dimensions">
        <path
          d={`M${FRAME.width - FRAME.right - scale} 279v8M${FRAME.width - FRAME.right} 279v8M${FRAME.width - FRAME.right - scale} 283H${FRAME.width - FRAME.right}`}
        />
        <text
          x={FRAME.width - FRAME.right - scale - 8}
          y={283}
          textAnchor="end"
          dominantBaseline="central"
          className="plan-caption"
        >
          1 м
        </text>
      </g>
    </svg>
  );
}

function Furniture({ room, doorX, doorWidth }: { room: Room; doorX: number; doorWidth: number }) {
  const L = room.length;
  const W = room.width;
  // Coordinates and fixture sizes are metres. Omit a fixture that does not fit,
  // instead of stretching it or clipping it at a wall or in the doorway.
  function place(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    children: ReactNode,
    rug = false,
  ) {
    const inside =
      x >= 0.08 && y >= 0.08 && width > 0 && height > 0 && x + width <= L - 0.08 && y + height <= W - 0.08;
    const blocksDoor =
      !rug &&
      room.doors > 0 &&
      x + width > doorX - 0.05 &&
      x < doorX + doorWidth + 0.05 &&
      y + height > W - doorWidth - 0.05;
    if (!inside || blocksDoor) return null;
    return (
      <g key={id} className="plan-item" data-fixture={id} transform={`translate(${x} ${y})`}>
        {children}
      </g>
    );
  }

  switch (room.type) {
    case 'living':
      return (
        <>
          {place(
            'rug',
            1.3,
            (W - 2.2) / 2,
            1.8,
            2.2,
            <rect className="plan-rug" width={1.8} height={2.2} rx={0.06} />,
            true,
          )}
          {place(
            'sofa',
            0.15,
            (W - 2.2) / 2,
            0.95,
            2.2,
            <>
              <rect className="plan-fixture" width={0.95} height={2.2} rx={0.1} />
              <rect className="plan-fixture plan-tint" width={0.24} height={2.2} rx={0.08} />
              <rect className="plan-fixture" x={0.28} y={0.2} width={0.58} height={0.86} rx={0.06} />
              <rect className="plan-fixture" x={0.28} y={1.14} width={0.58} height={0.86} rx={0.06} />
            </>,
          )}
          {place(
            'coffee-table',
            1.6,
            (W - 1) / 2,
            0.6,
            1,
            <rect className="plan-fixture" width={0.6} height={1} rx={0.08} />,
          )}
          {place(
            'media-unit',
            L - 0.55,
            (W - 1.6) / 2,
            0.4,
            1.6,
            <>
              <rect className="plan-fixture plan-tint" width={0.4} height={1.6} rx={0.03} />
              <path className="plan-detail" d="M.22 .15V1.45" />
            </>,
          )}
        </>
      );
    case 'bedroom': {
      const bedY = (W - 1.6) / 2;
      return (
        <>
          {place(
            'bed',
            0.15,
            bedY,
            2,
            1.6,
            <>
              <rect className="plan-fixture" width={2} height={1.6} rx={0.06} />
              <rect
                className="plan-fixture plan-tint"
                x={0.85}
                y={0.04}
                width={1.11}
                height={1.52}
                rx={0.04}
              />
              <rect className="plan-fixture" x={0.15} y={0.15} width={0.4} height={0.6} rx={0.08} />
              <rect className="plan-fixture" x={0.15} y={0.85} width={0.4} height={0.6} rx={0.08} />
            </>,
          )}
          {place(
            'nightstand-top',
            0.15,
            bedY - 0.5,
            0.4,
            0.4,
            <rect className="plan-fixture" width={0.4} height={0.4} rx={0.03} />,
          )}
          {place(
            'nightstand-bottom',
            0.15,
            bedY + 1.7,
            0.4,
            0.4,
            <rect className="plan-fixture" width={0.4} height={0.4} rx={0.03} />,
          )}
          {L >= 3.2 &&
            place(
              'wardrobe',
              L - 0.7,
              0.15,
              0.55,
              1.8,
              <>
                <rect className="plan-fixture plan-tint" width={0.55} height={1.8} rx={0.03} />
                <path className="plan-detail" d="M0 .6H.55M0 1.2H.55" />
              </>,
            )}
        </>
      );
    }
    case 'kids':
      return (
        <>
          {place(
            'rug',
            (L - 1.6) / 2,
            (W - 1.6) / 2,
            1.6,
            1.6,
            <circle className="plan-rug" cx={0.8} cy={0.8} r={0.8} />,
            true,
          )}
          {place(
            'child-bed',
            0.15,
            0.15,
            1.8,
            0.8,
            <>
              <rect className="plan-fixture" width={1.8} height={0.8} rx={0.06} />
              <rect
                className="plan-fixture plan-tint"
                x={0.7}
                y={0.04}
                width={1.06}
                height={0.72}
                rx={0.04}
              />
              <rect className="plan-fixture" x={0.12} y={0.14} width={0.32} height={0.52} rx={0.06} />
            </>,
          )}
          {L >= 3 &&
            place(
              'desk',
              L - 0.7,
              0.15,
              0.55,
              1.2,
              <rect className="plan-fixture plan-tint" width={0.55} height={1.2} rx={0.04} />,
            )}
          {L >= 3.2 &&
            place(
              'desk-chair',
              L - 1.2,
              0.55,
              0.35,
              0.35,
              <rect className="plan-fixture" width={0.35} height={0.35} rx={0.08} />,
            )}
          {W >= 2 &&
            place(
              'storage',
              0.15,
              W - 0.65,
              1.2,
              0.5,
              <rect className="plan-fixture plan-tint" width={1.2} height={0.5} rx={0.03} />,
            )}
        </>
      );
    case 'kitchen': {
      const counterLength = Math.min(3.6, L - 0.2);
      const sideLength = Math.min(2.4, W - 0.1) - 0.7;
      return (
        <>
          {place(
            'counter',
            0.1,
            0.1,
            counterLength,
            0.6,
            <>
              <rect className="plan-fixture plan-tint" width={counterLength} height={0.6} />
              {counterLength >= 1.3 && (
                <rect className="plan-fixture" x={0.7} y={0.08} width={0.5} height={0.44} rx={0.06} />
              )}
              {counterLength >= 2.4 && (
                <>
                  <rect
                    className="plan-fixture"
                    x={counterLength - 0.8}
                    y={0.05}
                    width={0.6}
                    height={0.5}
                    rx={0.03}
                  />
                  {[0.15, 0.45].flatMap((dx) =>
                    [0.18, 0.42].map((dy) => (
                      <circle
                        key={`${dx}-${dy}`}
                        className="plan-detail"
                        cx={counterLength - 0.8 + dx}
                        cy={dy}
                        r={0.075}
                      />
                    )),
                  )}
                </>
              )}
            </>,
          )}
          {W >= 1.5 &&
            place(
              'side-counter',
              0.1,
              0.7,
              0.6,
              sideLength,
              <rect className="plan-fixture plan-tint" width={0.6} height={sideLength} />,
            )}
          {place(
            'dining-set',
            Math.max(1.1, (L - 1.1) / 2),
            Math.max(1, (W - 1.7) / 2),
            1.1,
            1.7,
            <>
              <rect className="plan-fixture" x={0.35} width={0.4} height={0.4} rx={0.06} />
              <rect className="plan-fixture" x={0.35} y={1.3} width={0.4} height={0.4} rx={0.06} />
              <rect className="plan-fixture" y={0.45} width={1.1} height={0.8} rx={0.06} />
            </>,
          )}
        </>
      );
    }
    case 'bathroom':
      return (
        <>
          {place(
            'bath',
            0.1,
            0.1,
            1.7,
            0.75,
            <>
              <rect className="plan-fixture" width={1.7} height={0.75} rx={0.08} />
              <rect
                className="plan-fixture plan-tint"
                x={0.08}
                y={0.08}
                width={1.54}
                height={0.59}
                rx={0.18}
              />
              <circle className="plan-detail" cx={0.25} cy={0.375} r={0.03} />
            </>,
          )}
          {L >= 2.5 &&
            place(
              'toilet',
              L - 0.65,
              0.1,
              0.42,
              0.65,
              <>
                <rect className="plan-fixture" width={0.42} height={0.18} rx={0.03} />
                <ellipse className="plan-fixture" cx={0.21} cy={0.4} rx={0.19} ry={0.25} />
              </>,
            )}
          {W >= 1.65 &&
            place(
              'basin',
              0.1,
              W - 0.6,
              0.55,
              0.5,
              <>
                <rect className="plan-fixture" width={0.55} height={0.5} rx={0.05} />
                <ellipse className="plan-fixture plan-tint" cx={0.275} cy={0.25} rx={0.18} ry={0.15} />
              </>,
            )}
        </>
      );
    case 'balcony':
      return (
        <>
          {place(
            'planter-left',
            0.15,
            0.15,
            0.44,
            0.44,
            <circle className="plan-fixture plan-tint" cx={0.22} cy={0.22} r={0.22} />,
          )}
          {L >= 1.2 &&
            place(
              'planter-right',
              L - 0.59,
              0.15,
              0.44,
              0.44,
              <circle className="plan-fixture plan-tint" cx={0.22} cy={0.22} r={0.22} />,
            )}
          {L >= 2.4 &&
            place(
              'balcony-table',
              L / 2 - 0.28,
              W / 2 - 0.28,
              0.56,
              0.56,
              <circle className="plan-fixture" cx={0.28} cy={0.28} r={0.28} />,
            )}
          {L >= 2.4 &&
            W >= 1.8 &&
            place(
              'chair-left',
              L / 2 - 0.75,
              W / 2 - 0.17,
              0.34,
              0.34,
              <circle className="plan-fixture" cx={0.17} cy={0.17} r={0.17} />,
            )}
          {L >= 2.4 &&
            W >= 1.8 &&
            place(
              'chair-right',
              L / 2 + 0.41,
              W / 2 - 0.17,
              0.34,
              0.34,
              <circle className="plan-fixture" cx={0.17} cy={0.17} r={0.17} />,
            )}
        </>
      );
  }
}
