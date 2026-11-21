import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AnimatedNumber,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Progress,
  Sparkline,
  spring,
} from '../components/ui';
import { Icon } from '../components/Icon';
import NewRepairDialog from '../components/NewRepairDialog';
import RepairDetail from '../components/RepairDetail';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { STATUS_META } from '../lib/domain';
import { day, money, relative } from '../lib/format';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { user } = useAuth();
  const summary = useApi(() => api.dashboard(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const data = summary.data;

  if (summary.loading && !data) {
    return (
      <div className="page">
        <div className="skeleton skeleton--title" />
        <div className="kpis">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton skeleton--card" />
          ))}
        </div>
      </div>
    );
  }

  if (summary.error && !data) {
    return (
      <div className="page">
        <EmptyState
          title="Tableau de bord indisponible"
          message={summary.error}
          action={
            <Button variant="secondary" icon="clock" onClick={summary.reload}>
              Réessayer
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) return null;

  const inbound = data.series.map((entry) => entry.received);
  const outbound = data.series.map((entry) => entry.returned);
  const max = Math.max(...inbound, ...outbound, 1);
  const totalRepairs = data.statuses.reduce((sum, entry) => sum + entry.count, 0);

  let running = 0;
  const cumulative = data.series.map((entry) => (running += entry.paidCents));

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Vue d’ensemble</p>
          <h2 className="page__title">Bonjour {user?.name.split(' ')[0] ?? ''}.</h2>
          <p className="page__lede">
            {data.counts.active} dossiers ouverts · {data.counts.urgent} urgents ·{' '}
            {data.counts.ready} prêts à retirer · {data.counts.awaitingQuotes} devis en attente
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="clock" onClick={summary.reload}>
            Actualiser
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setDialogOpen(true)}>
            Nouvelle réparation
          </Button>
        </div>
      </header>

      <section className="kpis" aria-label="Indicateurs clés">
        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">Encaissé ce mois</span>
            <span className="kpi__icon">
              <Icon name="euro" size={16} />
            </span>
          </div>
          <p className="kpi__value">
            <AnimatedNumber value={data.revenue.billedMonthCents} format={(v) => money(v / 100)} />
          </p>
          <div className="kpi__foot">
            <span className="kpi__note">
              {money(data.revenue.pendingCents / 100)} de devis en cours (non encaissés)
            </span>
            <Sparkline data={cumulative} tone="accent" />
          </div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">En atelier</span>
            <span className="kpi__icon">
              <Icon name="wrench" size={16} />
            </span>
          </div>
          <p className="kpi__value">
            <AnimatedNumber value={data.counts.active} />
          </p>
          <div className="kpi__foot">
            <span className="kpi__note">
              {data.counts.urgent > 0
                ? `${data.counts.urgent} dossiers urgents`
                : 'Aucune urgence'}
            </span>
            <span className="kpi__chips">
              {data.statuses
                .filter((entry) =>
                  ['DIAGNOSIS', 'QUOTE_SENT', 'PART_ORDERED', 'IN_PROGRESS'].includes(entry.status),
                )
                .filter((entry) => entry.count > 0)
                .slice(0, 4)
                .map((entry) => (
                  <span key={entry.status} className={`chip chip--${STATUS_META[entry.status].tone}`}>
                    {entry.count}
                  </span>
                ))}
            </span>
          </div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">Délai moyen</span>
            <span className="kpi__icon">
              <Icon name="clock" size={16} />
            </span>
          </div>
          <p className="kpi__value">
            <AnimatedNumber
              value={data.avgRepairDays}
              format={(value) => value.toFixed(1).replace('.', ',')}
            />
            <span className="kpi__unit">jours</span>
          </p>
          <div className="kpi__foot">
            <span className="kpi__note">
              Sur {data.counts.returnedTotal} dossiers restitués au total
            </span>
          </div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">Objectif du mois</span>
            <span className="kpi__badge">{data.revenue.goalProgress} %</span>
          </div>
          <p className="kpi__value">
            <AnimatedNumber value={data.revenue.billedMonthCents} format={(v) => money(v / 100)} />
          </p>
          <div className="kpi__foot kpi__foot--stack">
            <Progress value={data.revenue.goalProgress} />
            <span className="kpi__note">
              Cible {money(data.revenue.monthlyGoalCents / 100)}
            </span>
          </div>
        </article>
      </section>

      <div className="layout-2">
        <article className="card card--chart">
          <header className="card__head">
            <div>
              <h3 className="card__title">Flux de l’atelier</h3>
              <p className="card__hint">Réparations reçues et restituées, 14 derniers jours</p>
            </div>
            <div className="legend">
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--in" /> Reçues
              </span>
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--out" /> Restituées
              </span>
            </div>
          </header>

          <div className="chart" role="img" aria-label="Réparations reçues et restituées">
            <div className="chart__plot">
              {data.series.map((entry, index) => (
                <div className="chart__col" key={entry.date}>
                  <div className="chart__pair">
                    <motion.span
                      className="chart__bar chart__bar--in"
                      initial={{ height: 0 }}
                      animate={{ height: `${(entry.received / max) * 100}%` }}
                      transition={{ ...spring, delay: index * 0.015 }}
                    />
                    <motion.span
                      className="chart__bar chart__bar--out"
                      initial={{ height: 0 }}
                      animate={{ height: `${(entry.returned / max) * 100}%` }}
                      transition={{ ...spring, delay: index * 0.015 + 0.04 }}
                    />
                  </div>
                  <span className="chart__tick">
                    {index % 2 === 0 ? day(`${entry.date}T12:00:00`) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="card">
          <header className="card__head">
            <div>
              <h3 className="card__title">Répartition</h3>
              <p className="card__hint">{totalRepairs} dossiers en base</p>
            </div>
          </header>
          <ul className="distribution">
            {data.statuses.map((entry) => {
              const pct = totalRepairs ? (entry.count / totalRepairs) * 100 : 0;
              return (
                <li key={entry.status} className="distribution__item">
                  <div className="distribution__head">
                    <span className={`dot dot--${STATUS_META[entry.status].tone}`} />
                    <span className="distribution__label">{STATUS_META[entry.status].label}</span>
                    <span className="distribution__count">{entry.count}</span>
                  </div>
                  <div className="distribution__track">
                    <motion.span
                      className={`distribution__fill distribution__fill--${STATUS_META[entry.status].tone}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={spring}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      <div className="layout-2">
        <article className="card">
          <header className="card__head">
            <div>
              <h3 className="card__title">À traiter en priorité</h3>
              <p className="card__hint">Urgences et dossiers bloqués</p>
            </div>
            <Badge tone="rose">{data.counts.urgent} urgents</Badge>
          </header>

          {data.priorities.length === 0 ? (
            <EmptyState title="Atelier à jour" message="Aucun dossier en attente." />
          ) : (
            <ul className="mini-list">
              {data.priorities.map((repair) => (
                <li key={repair.id}>
                  <button
                    type="button"
                    className="mini-row"
                    onClick={() => setDetailId(repair.id)}
                  >
                    <Avatar name={repair.client.name} size="sm" />
                    <span className="mini-row__main">
                      <span className="mini-row__title">
                        {repair.brand} {repair.model}
                      </span>
                      <span className="mini-row__meta">
                        {repair.client.name} · {repair.reference} ·{' '}
                        {money(repair.estimateCents / 100)}
                      </span>
                    </span>
                    <span className="mini-row__side">
                      <Badge tone={STATUS_META[repair.status].tone} dot>
                        {STATUS_META[repair.status].short}
                      </Badge>
                      <Icon name="chevronRight" size={15} className="mini-row__chevron" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <header className="card__head">
            <div>
              <h3 className="card__title">Activité récente</h3>
              <p className="card__hint">Journal des dossiers</p>
            </div>
          </header>

          {data.recentEvents.length === 0 ? (
            <p className="card__footnote">Aucune activité enregistrée.</p>
          ) : (
            <ul className="activity">
              {data.recentEvents.slice(0, 6).map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className="activity__row"
                    onClick={() => setDetailId(event.repair.id)}
                  >
                    <span className="activity__time">{relative(event.createdAt)}</span>
                    <span className="activity__text">
                      <strong>{event.repair.reference}</strong> {event.repair.brand}{' '}
                      {event.repair.model}
                      <em>
                        {event.message ??
                          (event.type === 'NOTE'
                            ? 'Note ajoutée'
                            : event.type === 'STATUS_CHANGE'
                              ? 'Changement de statut'
                              : event.type === 'CREATED'
                                ? 'Dossier créé'
                                : event.type.replaceAll('_', ' ').toLowerCase())}
                        {event.actorName ? ` — ${event.actorName}` : ''}
                      </em>
                    </span>
                    <Icon name="chevronRight" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="card">
        <header className="card__head">
          <div>
            <h3 className="card__title">Performance des techniciens</h3>
            <p className="card__hint">Dossiers actifs, restitués et encaissements rattachés</p>
          </div>
        </header>

        {data.technicians.length === 0 ? (
          <p className="card__footnote">
            Aucun technicien actif. Créez un compte depuis Paramètres → Utilisateurs.
          </p>
        ) : (
          <ul className="perf">
            {data.technicians.map((technician) => {
              const total = technician.active + technician.completed;
              const pct = total ? Math.round((technician.completed / total) * 100) : 0;
              return (
                <li key={technician.id} className="perf__row">
                  <Avatar name={technician.name} size="sm" />
                  <span className="perf__name">{technician.name}</span>
                  <span className="perf__metric">
                    <strong>{technician.active}</strong> actifs
                  </span>
                  <span className="perf__metric">
                    <strong>{technician.completed}</strong> restitués
                  </span>
                  <span className="perf__metric perf__metric--money">
                    {money(technician.billedCents / 100)} encaissés
                  </span>
                  <span className="perf__bar">
                    <Progress value={pct} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <NewRepairDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <RepairDetail repairId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
