import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Badge, spring } from './ui';
import { useStore } from '../lib/store';
import { STATUS_META } from '../lib/store';
import { money } from '../lib/format';

interface Result {
  id: string;
  href: string;
  title: string;
  meta: string;
  kind: 'Réparation' | 'Client';
  tone: string;
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { repairs, clients, clientOf } = useStore();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 70);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const repairHits = repairs
      .filter((repair) => {
        if (!q) return true;
        const client = clientOf(repair.clientId);
        return [repair.ref, repair.device, repair.issue, client?.name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 5)
      .map<Result>((repair) => ({
        id: repair.id,
        href: `/reparations?open=${repair.id}`,
        title: `${repair.ref} · ${repair.device}`,
        meta: `${clientOf(repair.clientId)?.name ?? 'Client'} — ${money(repair.estimate)}`,
        kind: 'Réparation',
        tone: STATUS_META[repair.status].tone,
      }));

    const clientHits = clients
      .filter((client) =>
        q ? [client.name, client.email, client.city].join(' ').toLowerCase().includes(q) : false,
      )
      .slice(0, 3)
      .map<Result>((client) => ({
        id: client.id,
        href: `/clients?open=${client.id}`,
        title: client.name,
        meta: `${client.city} · ${client.phone}`,
        kind: 'Client',
        tone: 'slate',
      }));

    return [...repairHits, ...clientHits];
  }, [query, repairs, clients, clientOf]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const go = (result: Result) => {
    onClose();
    navigate(result.href);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="overlay">
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Recherche globale"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
            transition={reduce ? { duration: 0.15 } : spring}
          >
            <div className="palette__search">
              <Icon name="search" size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une réparation, un client…"
                aria-label="Rechercher"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setCursor((c) => Math.min(c + 1, results.length - 1));
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  }
                  if (event.key === 'Enter' && results[cursor]) {
                    event.preventDefault();
                    go(results[cursor]);
                  }
                }}
              />
              <span className="palette__hint">Échap pour fermer</span>
            </div>

            <div className="palette__results">
              {results.length === 0 && (
                <p className="palette__empty">Aucun résultat pour « {query} ».</p>
              )}
              {results.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  className={`palette__item${index === cursor ? ' is-cursor' : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(result)}
                >
                  <span className="palette__kind">
                    <Badge tone={result.tone}>{result.kind}</Badge>
                  </span>
                  <span className="palette__text">
                    <span className="palette__title">{result.title}</span>
                    <span className="palette__meta">{result.meta}</span>
                  </span>
                  <Icon name="arrowUpRight" size={15} className="palette__arrow" />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
