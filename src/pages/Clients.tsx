import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  EmptyState,
  TextInput,
  spring,
} from '../components/ui';
import { Icon } from '../components/Icon';
import NewRepairDialog from '../components/NewRepairDialog';
import { PRIORITY_META, STATUS_META, useStore } from '../lib/store';
import { day, money } from '../lib/format';

export default function Clients() {
  const { clients, repairs } = useStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  const openId = params.get('open');
  const current = clients.find((client) => client.id === openId);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next, { replace: true });
  };

  const enriched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .map((client) => {
        const own = repairs.filter((repair) => repair.clientId === client.id);
        const active = own.filter((repair) => repair.status !== 'delivered');
        const spent = own
          .filter((repair) => repair.status === 'delivered')
          .reduce((sum, repair) => sum + repair.estimate, 0);
        return { client, own, active, spent, last: own[0]?.createdAt };
      })
      .filter(({ client }) => {
        if (!q) return true;
        return [client.name, client.email, client.phone, client.city]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.own.length - a.own.length);
  }, [clients, repairs, query]);

  const currentHistory = useMemo(
    () =>
      repairs
        .filter((repair) => repair.clientId === openId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [repairs, openId],
  );

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Répertoire</p>
          <h2 className="page__title">Clients</h2>
          <p className="page__lede">
            {clients.length} clients enregistrés ·{' '}
            {clients.filter((client) =>
              repairs.some(
                (repair) => repair.clientId === client.id && repair.status !== 'delivered',
              ),
            ).length}{' '}
            avec un dossier ouvert
          </p>
        </div>
        <div className="page__actions">
          <Button variant="primary" icon="plus" onClick={() => setDialogOpen(true)}>
            Nouveau dossier client
          </Button>
        </div>
      </header>

      <section className="toolbar toolbar--simple" aria-label="Recherche de clients">
        <div className="search">
          <Icon name="search" size={16} className="search__icon" />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, ville, téléphone…"
            aria-label="Rechercher un client"
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
      </section>

      {enriched.length === 0 ? (
        <EmptyState
          title="Aucun client trouvé"
          message="Ajustez la recherche ou créez un nouveau dossier client."
        />
      ) : (
        <section className="clients" aria-label="Liste des clients">
          {enriched.map(({ client, own, active, spent }, index) => (
            <motion.button
              key={client.id}
              type="button"
              className="client-card"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('open', client.id);
                setParams(next, { replace: true });
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: Math.min(index * 0.03, 0.24) }}
            >
              <div className="client-card__head">
                <Avatar name={client.name} />
                <span className="client-card__identity">
                  <span className="client-card__name">{client.name}</span>
                  <span className="client-card__city">{client.city}</span>
                </span>
                {active.length > 0 ? (
                  <Badge tone="accent" dot>
                    {active.length} en cours
                  </Badge>
                ) : (
                  <Badge tone="muted">À jour</Badge>
                )}
              </div>

              <dl className="client-card__stats">
                <div>
                  <dt>Interventions</dt>
                  <dd>{own.length}</dd>
                </div>
                <div>
                  <dt>Chiffre</dt>
                  <dd>{money(spent)}</dd>
                </div>
                <div>
                  <dt>Client depuis</dt>
                  <dd>{day(client.since)}</dd>
                </div>
              </dl>

              <div className="client-card__foot">
                <span className="client-card__contact">
                  <Icon name="phone" size={14} />
                  {client.phone}
                </span>
                <span className="client-card__link">
                  Dossier
                  <Icon name="chevronRight" size={14} />
                </span>
              </div>
            </motion.button>
          ))}
        </section>
      )}

      <Drawer
        open={Boolean(current)}
        onClose={close}
        eyebrow={current ? `Client depuis ${day(current.since)}` : undefined}
        title={current?.name ?? 'Client'}
        footer={
          current && (
            <div className="drawer__actions">
              <Button variant="primary" icon="plus" onClick={() => setDialogOpen(true)}>
                Nouvelle réparation
              </Button>
              <a className="btn btn--secondary btn--md" href={`tel:${current.phone.replace(/\s/g, '')}`}>
                <Icon name="phone" size={17} />
                <span>Appeler</span>
              </a>
            </div>
          )
        }
      >
        {current && (
          <div className="detail">
            <dl className="detail__facts detail__facts--tight">
              <div>
                <dt>Téléphone</dt>
                <dd>{current.phone}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{current.email || '—'}</dd>
              </div>
              <div>
                <dt>Ville</dt>
                <dd>{current.city}</dd>
              </div>
              <div>
                <dt>Dossiers</dt>
                <dd>{currentHistory.length}</dd>
              </div>
            </dl>

            <section className="detail__section" aria-labelledby="client-history">
              <div className="detail__section-head">
                <h3 id="client-history" className="detail__section-title">
                  Historique
                </h3>
                <span className="detail__section-hint">
                  {money(
                    currentHistory
                      .filter((repair) => repair.status === 'delivered')
                      .reduce((sum, repair) => sum + repair.estimate, 0),
                  )}{' '}
                  facturés
                </span>
              </div>

              {currentHistory.length === 0 ? (
                <p className="detail__empty">Aucune intervention enregistrée.</p>
              ) : (
                <ul className="history">
                  {currentHistory.map((repair) => (
                    <li key={repair.id}>
                      <button
                        type="button"
                        className="history__row"
                        onClick={() => navigate(`/reparations?open=${repair.id}`)}
                      >
                        <span className="history__main">
                          <span className="history__title">{repair.device}</span>
                          <span className="history__meta">
                            {repair.ref} · {day(repair.createdAt)} ·{' '}
                            {PRIORITY_META[repair.priority].label}
                          </span>
                        </span>
                        <span className="history__side">
                          <Badge tone={STATUS_META[repair.status].tone}>
                            {STATUS_META[repair.status].short}
                          </Badge>
                          <span className="history__amount">{money(repair.estimate)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <NewRepairDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        presetClientId={current?.id}
      />
    </div>
  );
}
