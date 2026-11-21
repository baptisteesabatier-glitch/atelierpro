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
import {
  PRIORITY_META,
  STATUS_FLOW,
  STATUS_META,
  useStore,
  type Repair,
} from '../lib/store';
import { day, money } from '../lib/format';

type Filter = 'active' | 'all' | 'parts' | 'ready' | 'delivered';
type Sort = 'recent' | 'priority' | 'estimate';

const PRIORITY_WEIGHT = { urgent: 0, normal: 1, low: 2 } as const;

function matchesFilter(repair: Repair, filter: Filter): boolean {
  switch (filter) {
    case 'active':
      return repair.status !== 'delivered';
    case 'all':
      return true;
    case 'delivered':
      return repair.status === 'delivered';
    case 'parts':
      return repair.status === 'parts' || repair.status === 'diagnostic';
    case 'ready':
      return repair.status === 'ready';
    default:
      return true;
  }
}

export default function Repairs() {
  const { repairs, clientOf } = useStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [sort, setSort] = useState<Sort>('recent');
  const [dialogOpen, setDialogOpen] = useState(false);

  const openId = params.get('open');

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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repairs
      .filter((repair) => matchesFilter(repair, filter))
      .filter((repair) => {
        if (!q) return true;
        const client = clientOf(repair.clientId);
        return [repair.ref, repair.device, repair.issue, client?.name ?? '', repair.technician]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (sort === 'priority') {
          return (
            PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
            b.createdAt.localeCompare(a.createdAt)
          );
        }
        if (sort === 'estimate') return b.estimate - a.estimate;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [repairs, filter, query, sort, clientOf]);

  const counts = useMemo(
    () => ({
      all: repairs.length,
      active: repairs.filter((repair) => repair.status !== 'delivered').length,
      parts: repairs.filter((repair) => repair.status === 'parts').length,
      ready: repairs.filter((repair) => repair.status === 'ready').length,
      delivered: repairs.filter((repair) => repair.status === 'delivered').length,
    }),
    [repairs],
  );

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Atelier</p>
          <h2 className="page__title">Réparations</h2>
          <p className="page__lede">
            {counts.active} dossiers ouverts · {counts.ready} prêts à retirer ·{' '}
            {counts.delivered} livrés
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
              { value: 'parts', label: 'En attente', count: counts.parts },
              { value: 'ready', label: 'Prêtes', count: counts.ready },
              { value: 'delivered', label: 'Livrées', count: counts.delivered },
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
              <option value="priority">Priorité</option>
              <option value="estimate">Devis décroissant</option>
            </select>
            <Icon name="chevronDown" size={14} className="sort__chevron" />
          </label>
        </div>
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun dossier"
          message={
            query
              ? `Rien ne correspond à « ${query} » avec ce filtre.`
              : 'Aucune réparation dans cette catégorie pour le moment.'
          }
          action={
            <Button variant="secondary" icon="plus" onClick={() => setDialogOpen(true)}>
              Créer un dossier
            </Button>
          }
        />
      ) : (
        <section className="table" aria-label="Liste des réparations">
          <div className="table__head" role="row">
            <span>Réf.</span>
            <span>Client</span>
            <span>Appareil</span>
            <span>Statut</span>
            <span>Priorité</span>
            <span className="table__right">Devis</span>
          </div>

          <div className="table__body">
            <AnimatePresence initial={false}>
              {rows.map((repair) => {
                const client = clientOf(repair.clientId);
                return (
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
                        {repair.ref}
                        <em className="cell__sub">{day(repair.createdAt)}</em>
                      </span>
                      <span className="cell cell--client">
                        <Avatar name={client?.name ?? 'Client'} size="sm" />
                        <span className="cell__stack">
                          <span className="cell__strong">{client?.name ?? 'Client'}</span>
                          <span className="cell__sub">{client?.city}</span>
                        </span>
                      </span>
                      <span className="cell cell--device">
                        <span className="cell__strong">{repair.device}</span>
                        <span className="cell__sub">{repair.technician}</span>
                      </span>
                      <span className="cell cell--status">
                        <Badge tone={STATUS_META[repair.status].tone} dot>
                          {STATUS_META[repair.status].short}
                        </Badge>
                      </span>
                      <span className="cell cell--priority">
                        <Badge tone={PRIORITY_META[repair.priority].tone}>
                          {PRIORITY_META[repair.priority].label}
                        </Badge>
                      </span>
                      <span className="cell cell--money table__right">
                        {money(repair.estimate)}
                        <Icon name="chevronRight" size={15} className="cell__chevron" />
                      </span>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      <p className="table__footnote">
        {rows.length} dossier(s) affiché(s) · {STATUS_FLOW.length} étapes de production
      </p>

      <NewRepairDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <RepairDetail repairId={openId} onClose={closeRepair} />
    </div>
  );
}
