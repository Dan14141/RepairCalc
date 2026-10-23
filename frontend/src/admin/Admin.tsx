import { useEffect, useState } from 'react';
import { ChartNoAxesCombined, SlidersHorizontal } from 'lucide-react';
import { MatchingStudio } from '../ml/Matching';
import { SuccessMetrics } from './SuccessMetrics';

const tabs = [
  { id: 'matching', label: 'ML-мастерская', icon: SlidersHorizontal },
  { id: 'metrics', label: 'Метрики успеха', icon: ChartNoAxesCombined },
] as const;
type Tab = (typeof tabs)[number]['id'];
const currentTab = (): Tab => (location.hash === '#admin/metrics' ? 'metrics' : 'matching');

export function Admin() {
  const [tab, setTab] = useState<Tab>(currentTab);
  useEffect(() => {
    const sync = () => {
      setTab(currentTab());
      if (location.hash === '#matching' || location.hash === '#admin') {
        history.replaceState(null, '', '#admin/matching');
      }
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function select(next: Tab) {
    setTab(next);
    if (location.hash !== `#admin/${next}`) location.hash = `admin/${next}`;
  }
  return (
    <>
      <section className="page-heading">
        <div className="eyebrow">
          <span /> РЕСУРСЫ ДЛЯ ПЕРСОНАЛА
        </div>
        <h1>
          Админка<span className="accent-dot">.</span>
        </h1>
        <p>Разметка каталога и контроль качества сервиса в одном рабочем пространстве.</p>
      </section>
      <div className="admin-tabs" role="tablist" aria-label="Ресурсы админки">
        {tabs.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            id={`admin-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`admin-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => select(id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index - 1 + tabs.length) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                select(tabs[next].id);
                document.getElementById(`admin-tab-${tabs[next].id}`)?.focus();
              }
            }}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {tabs.map(({ id }) => (
        <section
          key={id}
          id={`admin-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`admin-tab-${id}`}
          hidden={tab !== id}
          tabIndex={0}
        >
          {tab === id && (id === 'matching' ? <MatchingStudio /> : <SuccessMetrics />)}
        </section>
      ))}
    </>
  );
}
