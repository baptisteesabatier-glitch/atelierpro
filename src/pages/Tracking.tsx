import { useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Badge, IconButton, spring } from '../components/ui';
import { Icon } from '../components/Icon';
import { api, type RepairStatus } from '../lib/api';
import { useApi } from '../lib/hooks';
import { STATUS_META } from '../lib/domain';
import { fullDate, relative } from '../lib/format';

export default function TrackingPage() {
  const { token = '' } = useParams();
  const { data, loading, error } = useApi(() => api.track(token), [token]);
  const reduce = useReducedMotion();

  const tracking = data?.tracking;

  return (
    <div className="track">
      <header className="track__bar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
              <path
                d="M7 22.5V13a9 9 0 0 1 18 0v9.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path d="M7 22.5h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="16" cy="17.4" r="2.1" fill="currentColor" />
            </svg>
          </span>
          <span className="brand__text">
            <strong className="brand__name">AtelierPro</strong>
            <span className="brand__tag">Suivi de réparation</span>
          </span>
        </div>
        <IconButton
          label="Actualiser"
          icon="clock"
          onClick={() => window.location.reload()}
        />
      </header>

      <main className="track__main">
        {loading && (
          <div className="track__card">
            <div className="skeleton skeleton--title" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        )}

        {!loading && error && (
          <div className="track__card track__card--center">
            <span className="empty__mark">
              <Icon name="search" size={22} />
            </span>
            <h1 className="track__title">Lien de suivi invalide</h1>
            <p className="track__lede">
              Ce lien ne correspond à aucun dossier. Vérifiez qu’il a été copié en entier, ou
              contactez votre atelier.
            </p>
          </div>
        )}

        {tracking && (
          <motion.div
            className="track__card"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0.2 } : spring}
          >
            <div className="track__head">
              <div>
                <p className="eyebrow">Dossier {tracking.reference}</p>
                <h1 className="track__title">
                  {tracking.brand} {tracking.model}
                </h1>
                <p className="track__lede">
                  Réceptionné le {fullDate(tracking.receivedAt)} · mis à jour{' '}
                  {relative(tracking.readyAt ?? tracking.receivedAt)}
                </p>
              </div>
              <Badge tone={STATUS_META[tracking.status].tone} dot>
                {STATUS_META[tracking.status].label}
              </Badge>
            </div>

            {tracking.isReady && (
              <div className="track__ready">
                <Icon name="check" size={18} />
                <p>
                  <strong>Votre appareil est prêt.</strong> Vous pouvez venir le récupérer aux
                  horaires d’ouverture de l’atelier.
                </p>
              </div>
            )}

            {tracking.status === 'CANCELLED' && (
              <div className="track__notice">
                <Icon name="clock" size={18} />
                <p>
                  Ce dossier a été annulé. Contactez l’atelier pour toute précision.
                </p>
              </div>
            )}

            <ol className="track__steps">
              {tracking.steps.map((step, index) => {
                const meta = STATUS_META[step.status as RepairStatus];
                const current = index === tracking.currentIndex;
                return (
                  <li
                    key={step.status}
                    className={`track__step${step.reached ? ' is-done' : ''}${
                      current ? ' is-current' : ''
                    }`}
                  >
                    <span className="track__marker">
                      {step.reached ? <Icon name="check" size={13} strokeWidth={2.6} /> : null}
                    </span>
                    <span className="track__step-text">
                      <span className="track__step-label">{meta.label}</span>
                      <span className="track__step-meta">
                        {step.at ? fullDate(step.at) : 'À venir'}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="track__contact">
              <h2 className="track__contact-title">Une question ?</h2>
              <p className="track__lede">
                {tracking.shop.name}
                {tracking.shop.address ? ` · ${tracking.shop.address}` : ''}
              </p>
              <div className="track__contact-actions">
                {tracking.shop.phone && (
                  <a
                    className="btn btn--primary btn--md"
                    href={`tel:${tracking.shop.phone.replace(/\s/g, '')}`}
                  >
                    <Icon name="phone" size={17} />
                    <span>{tracking.shop.phone}</span>
                  </a>
                )}
                {tracking.shop.email && (
                  <a
                    className="btn btn--secondary btn--md"
                    href={`mailto:${tracking.shop.email}?subject=${encodeURIComponent(
                      `Suivi du dossier ${tracking.reference}`,
                    )}`}
                  >
                    <Icon name="send" size={17} />
                    <span>Écrire à l’atelier</span>
                  </a>
                )}
              </div>
            </div>

            <p className="track__privacy">
              Cette page n’affiche que les informations de suivi. Aucune donnée personnelle, note
              interne ou information financière n’est partagée.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
