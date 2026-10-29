import { useEffect, useId, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { visitorId } from '../services/engagement';
import { useRuntime } from '../services/runtime';

export function RatingPrompt({ available }: { available: boolean }) {
  const { api } = useRuntime();
  const titleId = useId();
  const [id] = useState(() => crypto.randomUUID());
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState(false);
  // Keep the same payload on retry, even if the first acknowledgement was lost.
  const attemptedRating = useRef<number | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setClosed(true), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function submit(value: number) {
    if (lock.current || saved) return;
    lock.current = true;
    attemptedRating.current ??= value;
    setRating(attemptedRating.current);
    setBusy(true);
    setError(false);
    try {
      await api.recordEngagement(
        { id, visitorId: visitorId(), kind: 'rating', rating: attemptedRating.current },
        new AbortController().signal,
      );
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (closed || !available) return null;
  return (
    <aside
      className="rating-prompt"
      aria-label="Оценка подбора ИИ"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setClosed(true);
      }}
    >
      <div className="rating-prompt-heading">
        <h2 id={titleId}>Как Вам подбор?</h2>
        <button className="icon-button" aria-label="Закрыть оценку подбора" onClick={() => setClosed(true)}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="rating-stars" role="group" aria-labelledby={titleId} onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className={value <= (rating || hovered) ? 'selected' : ''}
            aria-label={`${value} из 5`}
            aria-pressed={rating === value}
            disabled={busy || attemptedRating.current !== null}
            onMouseEnter={() => setHovered(value)}
            onFocus={() => setHovered(value)}
            onBlur={() => setHovered(0)}
            onClick={() => void submit(value)}
          >
            <Star
              size={26}
              fill={value <= (rating || hovered) ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <p className="rating-prompt-status" role="status">
        {saved
          ? `Спасибо! Оценка ${rating} из 5 сохранена.`
          : busy
            ? 'Сохраняем оценку…'
            : 'Нажмите на звезду, чтобы оценить'}
      </p>
      {error && (
        <div className="rating-prompt-error">
          <p role="alert">Не удалось сохранить оценку.</p>
          <button className="text-button" onClick={() => void submit(rating)}>
            Повторить отправку
          </button>
        </div>
      )}
    </aside>
  );
}
