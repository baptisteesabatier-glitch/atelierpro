import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Segmented,
  TextInput,
  spring,
} from '../components/ui';
import { Icon } from '../components/Icon';
import NewRepairDialog from '../components/NewRepairDialog';
import RepairDetail from '../components/RepairDetail';
import { api, type Repair, type RepairStatus } from '../lib/api';
import { useApi } from '../lib/hooks';
import { PRIORITY_META, STATUS_META } from '../lib/domain';
import { day, money } from '../lib/format';
import { useAuth } from '../lib/auth';

type Filter = 'active' | 'all' | 'ready' | 'returned' | 'cancelled';
type Sort = 'recent' | 'priority' | 'estimate' | 'oldest';

const PRIORITY_WEIGHT = { URGENT: 0, NORMAL: 1, LOW: 2 } as const;

const FILTERS: Record<Filter, (repair: Repair) => boolean> = {
  active: (repair) => !['RETURNED', 'CANCELLED'].includes(repair.status),
  all: () => true,
  ready: (repair) => repair.status === 'READY',
  returned: (repair) => repair.status === 'RETURNED',
  cancelled: (repair) => repair.status === 'CANCELLED',
};

export default function Repairs() {
  const { can } = useAuth();
  const repairs = useApi(() => api.repairs(), []);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [sort, setSort] = useState<Sort>('recent');
  const [dialogOpen, setDialogOpen] = useState(false);

  const openId = params.get('open');
  const rows = repairs.data?.repairs ?? [];

  const openRepair = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('open', id);
    setParams(next, { replace: true });
  };

  const closeRepair = () => {
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next, { replace: true });
  };

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter(FILTERS.active).length,
      ready: rows.filter((repair) => repair.status === 'READY').length,
      returned: rows.filter((repair) => repair.status === 'RETURNED').length,
      cancelled: rows.filter((repair) => repair.status === 'CANCELLED').length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(FILTERS[filter])
      .filter((repair) => {
        if (!q) return true;
        return [
          repair.reference,
          repair.brand,
          repair.model,
          repair.issue,
          repair.client.name,
          repair.client.phone,
          repair.assignedTo?.name ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (sort === 'priority') {
          return (
            PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
            Date.parse(b.receivedAt) - Date.parse(a.receivedAt)
          );
        }
        if (sort === 'estimate') return b.estimateCents - a.estimateCents;
        if (sort === 'oldest') return Date.parse(a.receivedAt) - Date.parse(b.receivedAt);
        return Date.parse(b.receivedAt) - Date.parse(a.receivedAt);
      });
  }, [rows, filter, query, sort]);

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Atelier</p>
          <h2 className="page__title">Réparations</h2>
          <p className="page__lede">
            {counts.active} dossiers ouverts · {counts.ready} prêts à retirer · {counts.returned}{' '}
            restitués
          </p>
        </div>
        <div className="page__actions">
          <Button variant="primary" icon="plus" onClick={() => setDialogOpen(true)}>
            Nouvelle réparation
          </Button>
        </div>
      </header>

      <section className="toolbar" aria-label="Filtres des réparations">
        <div className="search">
          <Icon name="search" size={16} className="search__icon" />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Référence, client, appareil…"
            aria-label="Rechercher dans les réparations"
            className="search__input"
          />
          {query && (
            <button
              type="button"
              className="search__clear"
              onClick={() => setQuery('')}
              aria-label="Effacer la recherche"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <div className="toolbar__filters">
          <Segmented
            layoutId="repairs-filter"
            label="Filtrer les réparations"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'active', label: 'Actives', count: counts.active },
              { value: 'all', label: 'Toutes', count: counts.all },
              { value: 'ready', label: 'Prêtes', count: counts.ready },
              { value: 'returned', label: 'Restituées', count: counts.returned },
              { value: 'cancelled', label: 'Annulées', count: counts.cancelled },
            ]}
          />

          <label className="sort">
            <span className="sort__label">Trier</span>
            <select
              className="sort__select"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
            >
              <option value="recent">Plus récentes</option>
              <option value="oldest">Plus anciennes</option>
              <option value="priority">Priorité</option>
              <option value="estimate">Montant décroissant</option>
            </select>
            <Icon name="chevronDown" size={14} className="sort__chevron" />
          </label>
        </div>
      </section>

      {repairs.error && (
        <EmptyState
          title="Impossible de charger les dossiers"
          message={repairs.error}
          action={
            <Button variant="secondary" icon="clock" onClick={repairs.reload}>
              Réessayer
            </Button>
          }
        />
      )}

      {!repairs.error && repairs.loading && !repairs.data && (
        <div className="stack">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}

      {!repairs.error && repairs.data && visible.length === 0 && (
        <EmptyState
          title="Aucun dossier"
          message={
            query
              ? `Rien ne correspond à « ${query} » avec ce filtre.`
              : 'Aucune réparation dans cette catégorie pour le moment.'
          }
          action={
            can('canEditRepairs') ? (
              <Button variant="secondary" icon="plus" onClick={() => setDialogOpen(true)}>
                Créer un dossier
              </Button>
            ) : undefined
          }
        />
      )}

      {visible.length > 0 && (
        <section className="table" aria-label="Liste des réparations">
          <div className="table__head" role="row">
            <span>Réf.</span>
            <span>Client</span>
            <span>Appareil</span>
            <span>Statut</span>
            <span>Priorité</span>
            <span className="table__right">Montant</span>
          </div>

          <div className="table__body">
            <AnimatePresence initial={false}>
              {visible.map((repair) => (
                <motion.div
                  key={repair.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={spring}
                >
                  <button
                    type="button"
                    className="table__row"
                    onClick={() => openRepair(repair.id)}
                  >
                    <span className="cell cell--ref">
                      {repair.reference}
                      <em className="cell__sub">{day(repair.receivedAt)}</em>
                    </span>
                    <span className="cell cell--client">
                      <Avatar name={repair.client.name} size="sm" />
                      <span className="cell__stack">
                        <span className="cell__strong">{repair.client.name}</span>
                        <span className="cell__sub">{repair.client.city ?? '—'}</span>
                      </span>
                    </span>
                    <span className="cell cell--device">
                      <span className="cell__strong">
                        {repair.brand} {repair.model}
                      </span>
                      <span className="cell__sub">{repair.assignedTo?.name ?? 'Non affecté'}</span>
                    </span>
                    <span className="cell cell--status">
                      <Badge tone={STATUS_META[repair.status as RepairStatus].tone} dot>
                        {STATUS_META[repair.status as RepairStatus].short}
                      </Badge>
                    </span>
                    <span className="cell cell--priority">
                      <Badge tone={PRIORITY_META[repair.priority].tone}>
                        {PRIORITY_META[repair.priority].label}
                      </Badge>
                    </span>
                    <span className="cell cell--money table__right">
                      {money(repair.estimateCents / 100)}
                      <Icon name="chevronRight" size={15} className="cell__chevron" />
                    </span>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      <p className="table__footnote">
        {visible.length} dossier(s) affiché(s) · {counts.all} au total · données synchronisées avec
        PostgreSQL
      </p>

      <NewRepairDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <RepairDetail
        repairId={openId}
        onClose={closeRepair}
        onChanged={() => {
          repairs.reload();
        }}
      />
    </div>
  );
}
