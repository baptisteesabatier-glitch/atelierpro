import { useMemo, useState } from 'react';
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
import { PRIORITY_META, STATUS_FLOW, STATUS_META, useStore } from '../lib/store';
import { day, daysBetween, money, relative } from '../lib/format';

function localKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { repairs, settings, clientOf } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const delivered = repairs.filter((repair) => repair.status === 'delivered');
    const active = repairs.filter((repair) => repair.status !== 'delivered');
    const now = new Date();
    const monthDelivered = delivered.filter((repair) => {
      if (!repair.deliveredAt) return false;
      const d = new Date(repair.deliveredAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const revenue = monthDelivered.reduce((sum, repair) => sum + repair.estimate, 0);
    const pendingValue = active.reduce((sum, repair) => sum + repair.estimate, 0);
    const avgDays = delivered.length
      ? delivered.reduce(
          (sum, repair) => sum + daysBetween(repair.createdAt, repair.deliveredAt ?? repair.updatedAt),
          0,
        ) / delivered.length
      : 0;
    const goal = settings.monthlyGoal > 0 ? settings.monthlyGoal : 1;

    return {
      delivered,
      active,
      monthDelivered,
      revenue,
      pendingValue,
      avgDays,
      goalPct: (revenue / goal) * 100,
      urgent: active.filter((repair) => repair.priority === 'urgent').length,
    };
  }, [repairs, settings.monthlyGoal]);

  const series = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - index));
      return d;
    });
    const inbound = days.map(
      (d) => repairs.filter((repair) => localKey(repair.createdAt) === localKey(d)).length,
    );
    const outbound = days.map(
      (d) =>
        repairs.filter(
          (repair) => repair.deliveredAt && localKey(repair.deliveredAt) === localKey(d),
        ).length,
    );
    const dailyRevenue = days.map((d) =>
      repairs
        .filter((repair) => repair.deliveredAt && localKey(repair.deliveredAt) === localKey(d))
        .reduce((sum, repair) => sum + repair.estimate, 0),
    );
    let running = 0;
    const cumulative = dailyRevenue.map((value) => (running += value));
    return { days, inbound, outbound, cumulative, max: Math.max(...inbound, ...outbound, 1) };
  }, [repairs]);

  const distribution = useMemo(
    () =>
      STATUS_FLOW.map((status) => ({
        status,
        count: repairs.filter((repair) => repair.status === status).length,
      })),
    [repairs],
  );

  const priorities = useMemo(() => {
    const weight = { urgent: 0, normal: 1, low: 2 } as const;
    return stats.active
      .slice()
      .sort(
        (a, b) =>
          weight[a.priority] - weight[b.priority] || b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 4);
  }, [stats.active]);

  const recent = useMemo(
    () =>
      repairs
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5),
    [repairs],
  );

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Vue d’ensemble</p>
          <h2 className="page__title">Bonjour {settings.technician}.</h2>
          <p className="page__lede">
            {stats.active.length} dossiers ouverts · {stats.urgent} urgents ·{' '}
            {stats.monthDelivered.length} livraisons ce mois
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="wrench" onClick={() => setDialogOpen(true)}>
            Enregistrer une réception
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setDialogOpen(true)}>
            Nouvelle réparation
          </Button>
        </div>
      </header>

      <section className="kpis" aria-label="Indicateurs clés">
        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">Chiffre d’affaires</span>
            <span className="kpi__icon">
              <Icon name="euro" size={16} />
            </span>
          </div>
          <p className="kpi__value">
            <AnimatedNumber value={stats.revenue} format={money} />
          </p>
          <div className="kpi__foot">
            <span className="kpi__note">
              {stats.monthDelivered.length} livraisons · {money(stats.pendingValue)} en attente
            </span>
            <Sparkline data={series.cumulative} tone="accent" />
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
            <AnimatedNumber value={stats.active.length} />
          </p>
          <div className="kpi__foot">
            <span className="kpi__note">
              {stats.urgent > 0 ? `${stats.urgent} dossiers urgents` : 'Aucune urgence'}
            </span>
            <span className="kpi__chips">
              {STATUS_FLOW.slice(0, 4).map((status) => {
                const count = distribution.find((entry) => entry.status === status)?.count ?? 0;
                if (!count) return null;
                return (
                  <span key={status} className={`chip chip--${STATUS_META[status].tone}`}>
                    {count}
                  </span>
                );
              })}
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
              value={stats.avgDays}
              format={(value) => value.toFixed(1).replace('.', ',')}
            />
            <span className="kpi__unit">jours</span>
          </p>
          <div className="kpi__foot">
            <span className="kpi__note">
              Sur {stats.delivered.length} dossiers livrés au total
            </span>
          </div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">Objectif du mois</span>
            <span className="kpi__badge">{Math.round(stats.goalPct)} %</span>
          </div>
          <p className="kpi__value">
            <AnimatedNumber value={stats.revenue} format={money} />
          </p>
          <div className="kpi__foot kpi__foot--stack">
            <Progress value={stats.goalPct} />
            <span className="kpi__note">Cible {money(settings.monthlyGoal)}</span>
          </div>
        </article>
      </section>

      <div className="layout-2">
        <article className="card card--chart">
          <header className="card__head">
            <div>
              <h3 className="card__title">Flux de l’atelier</h3>
              <p className="card__hint">Réparations reçues et livrées, 14 derniers jours</p>
            </div>
            <div className="legend">
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--in" /> Reçues
              </span>
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--out" /> Livrées
              </span>
            </div>
          </header>

          <div
            className="chart"
            role="img"
            aria-label="Réparations reçues et livrées sur les quatorze derniers jours"
          >
            <div className="chart__plot">
              {series.days.map((d, index) => (
                <div className="chart__col" key={index}>
                  <div className="chart__pair">
                    <motion.span
                      className="chart__bar chart__bar--in"
                      initial={{ height: 0 }}
                      animate={{ height: `${(series.inbound[index] / series.max) * 100}%` }}
                      transition={{ ...spring, delay: index * 0.015 }}
                    />
                    <motion.span
                      className="chart__bar chart__bar--out"
                      initial={{ height: 0 }}
                      animate={{ height: `${(series.outbound[index] / series.max) * 100}%` }}
                      transition={{ ...spring, delay: index * 0.015 + 0.04 }}
                    />
                  </div>
                  <span className="chart__tick">
                    {index % 2 === 0 ? day(d.toISOString()) : ''}
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
              <p className="card__hint">Tous dossiers confondus</p>
            </div>
          </header>
          <ul className="distribution">
            {distribution.map((entry) => {
              const total = repairs.length || 1;
              const pct = (entry.count / total) * 100;
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
            <Badge tone="rose">{stats.urgent} urgents</Badge>
          </header>

          {priorities.length === 0 ? (
            <EmptyState
              title="Atelier à jour"
              message="Aucun dossier en attente : tout est livré."
            />
          ) : (
            <ul className="mini-list">
              {priorities.map((repair) => (
                <li key={repair.id}>
                  <button
                    type="button"
                    className="mini-row"
                    onClick={() => setDetailId(repair.id)}
                  >
                    <Avatar name={clientOf(repair.clientId)?.name ?? 'Client'} size="sm" />
                    <span className="mini-row__main">
                      <span className="mini-row__title">{repair.device}</span>
                      <span className="mini-row__meta">
                        {clientOf(repair.clientId)?.name} · {repair.ref} · {money(repair.estimate)}
                      </span>
                    </span>
                    <span className="mini-row__side">
                      <Badge tone={PRIORITY_META[repair.priority].tone} dot>
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
              <h3 className="card__title">Dernières interventions</h3>
              <p className="card__hint">Activité récente du dossier</p>
            </div>
          </header>

          <ul className="activity">
            {recent.map((repair) => (
              <li key={repair.id}>
                <button
                  type="button"
                  className="activity__row"
                  onClick={() => setDetailId(repair.id)}
                >
                  <span className="activity__time">{relative(repair.updatedAt)}</span>
                  <span className="activity__text">
                    <strong>{repair.ref}</strong> {repair.device}
                    <em>{STATUS_META[repair.status].label}</em>
                  </span>
                  <span className={`dot dot--${STATUS_META[repair.status].tone}`} />
                </button>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <NewRepairDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <RepairDetail repairId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
