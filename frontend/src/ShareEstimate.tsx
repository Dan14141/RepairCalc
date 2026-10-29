import { useRef, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { Modal } from './components';
import { money, number, type Project } from './data';
import type { EngagementEvent, Estimate } from './services/contracts';
import { visitorId } from './services/engagement';
import { useRuntime } from './services/runtime';

export function ShareEstimate({ project, estimate }: { project: Project; estimate?: Estimate }) {
  const { settings } = useRuntime();
  const [snapshot, setSnapshot] = useState<{ title: string; text: string } | null>(null);
  return (
    <>
      <button
        className="button secondary"
        disabled={!estimate}
        onClick={() => {
          if (!estimate) return;
          const title = `Смета — ${project.name}`;
          setSnapshot({
            title,
            text: [
              title,
              settings.mode === 'mock' ? 'MOCK · Демонстрационные цены' : 'Расчёт RepairCalc',
              `${project.object} · ${project.repair} ремонт · ${number(estimate.totalArea)} м²`,
              `Запас ${project.reserve}% включён`,
              '',
              ...estimate.items.map(
                (item) =>
                  `${item.product.name} — ${item.quantity} ${item.product.unit} × ${money(item.product.price)} = ${money(item.cost)} (${item.rooms.join(', ')})`,
              ),
              '',
              `Материалы: ${money(estimate.materials)}`,
              `Работы (ориентировочно): ${money(estimate.labor)}`,
              `Итого: ${money(estimate.total)}`,
              ...(estimate.warnings || []),
            ].join('\n'),
          });
        }}
      >
        <Share2 size={16} /> Поделиться сметой
      </button>
      {snapshot && <ShareDialog {...snapshot} projectId={project.id} close={() => setSnapshot(null)} />}
    </>
  );
}

function ShareDialog({
  title,
  text,
  projectId,
  close,
}: {
  title: string;
  text: string;
  projectId: string;
  close: () => void;
}) {
  const { api } = useRuntime();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<EngagementEvent | null>(null);
  const [shared, setShared] = useState(false);
  async function record(event: EngagementEvent) {
    try {
      await api.recordEngagement(event, new AbortController().signal);
      setPending(null);
    } catch {
      setPending(event);
      setError('Смета готова к отправке, но не удалось учесть действие. Повторите сохранение статистики.');
    }
  }
  async function share(method: 'native' | 'clipboard') {
    if (lock.current || shared) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (method === 'native') await navigator.share({ title, text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
      setMessage(
        method === 'native'
          ? 'Смета передана в меню отправки.'
          : 'Смета скопирована. Вставьте её в сообщение.',
      );
      await record({ id: crypto.randomUUID(), visitorId: visitorId(), kind: 'share', projectId, method });
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError')
        setError(
          method === 'native'
            ? 'Не удалось открыть меню отправки. Попробуйте скопировать смету.'
            : 'Буфер обмена недоступен. Разрешите копирование в браузере и повторите попытку.',
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal title="Поделиться сметой" close={close}>
      <div className="share-content">
        <p>Отправьте состав, количество материалов и итоговую стоимость ремонта.</p>
        <label>
          Текст сметы
          <textarea aria-label="Текст сметы" readOnly value={text} />
        </label>
        <div className="engagement-actions">
          {typeof navigator.share === 'function' && (
            <button className="button primary" disabled={busy || shared} onClick={() => void share('native')}>
              <Share2 size={16} /> Отправить
            </button>
          )}
          <button
            className="button secondary"
            disabled={busy || shared}
            onClick={() => void share('clipboard')}
          >
            <Copy size={16} /> Скопировать смету
          </button>
        </div>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {pending && (
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError('');
              await record(pending);
              lock.current = false;
              setBusy(false);
            }}
          >
            Повторить сохранение статистики
          </button>
        )}
      </div>
    </Modal>
  );
}
