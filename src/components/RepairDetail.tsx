import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Badge,
  Button,
  Drawer,
  spring,
} from './ui';
import { Icon } from './Icon';
import {
  CATEGORY_META,
  PRIORITY_META,
  STATUS_FLOW,
  STATUS_META,
  useStore,
} from '../lib/store';
import { clock, day, money, moneyPrecise, relative } from '../lib/format';
import { toast } from './Toaster';

export default function RepairDetail({
  repairId,
  onClose,
}: {
  repairId: string | null;
  onClose: () => void;
}) {
  const { repairs, clientOf, setStatus, addNote } = useStore();
  const [draft, setDraft] = useState('');
  const reduce = useReducedMotion();
  const repair = repairs.find((entry) => entry.id === repairId) ?? null;
  const client = repair ? clientOf(repair.clientId) : undefined;

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    if (!repair || draft.trim().length < 2) return;
    addNote(repair.id, draft.trim());
    setDraft('');
    toast('Note ajoutée au dossier');
  };

  const currentIndex = repair ? STATUS_FLOW.indexOf(repair.status) : 0;
  const nextStatus =
    repair && currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;

  return (
    <Drawer
      open={Boolean(repair)}
      onClose={onClose}
      eyebrow={repair ? repair.ref : undefined}
      title={repair ? repair.device : 'Réparation'}
      footer={
        repair && (
          <div className="drawer__actions">
            {repair.status === 'ready' ? (
              <Button
                variant="primary"
                icon="check"
                onClick={() => {
                  setStatus(repair.id, 'delivered');
                  toast('Réparation livrée — dossier clôturé');
                }}
              >
                Marquer comme livrée
              </Button>
            ) : nextStatus ? (
              <Button
                variant="primary"
                trailingIcon="chevronRight"
                onClick={() => {
                  setStatus(repair.id, nextStatus);
                  toast(`Étape suivante : ${STATUS_META[nextStatus].label}`);
                }}
              >
                Passer à « {STATUS_META[nextStatus].short} »
              </Button>
            ) : null}
            {client && (
              <a className="btn btn--secondary btn--md" href={`tel:${client.phone.replace(/\s/g, '')}`}>
                <Icon name="phone" size={17} />
                <span>Appeler</span>
              </a>
            )}
          </div>
        )
      }
    >
      {repair && client && (
        <div className="detail">
          <div className="detail__summary">
            <div className="detail__client">
              <p className="eyebrow">Client</p>
              <p className="detail__client-name">{client.name}</p>
              <p className="detail__client-meta">
                {client.phone} · {client.city}
              </p>
            </div>
            <div className="detail__price">
              <p className="eyebrow">Devis</p>
              <p className="detail__amount">{moneyPrecise(repair.estimate)}</p>
              <Badge tone={PRIORITY_META[repair.priority].tone} dot>
                {PRIORITY_META[repair.priority].label}
              </Badge>
            </div>
          </div>

          <div className="detail__problem">
            <p className="eyebrow">Panne signalée</p>
            <p className="detail__issue">{repair.issue}</p>
          </div>

          <dl className="detail__facts">
            <div>
              <dt>Appareil</dt>
              <dd>
                {CATEGORY_META[repair.category].label} · {repair.device}
              </dd>
            </div>
            <div>
              <dt>Technicien</dt>
              <dd>{repair.technician}</dd>
            </div>
            <div>
              <dt>Entrée</dt>
              <dd>{day(repair.createdAt)} à {clock(repair.createdAt)}</dd>
            </div>
            <div>
              <dt>Dernière action</dt>
              <dd>{relative(repair.updatedAt)}</dd>
            </div>
          </dl>

          <section className="detail__section" aria-labelledby="detail-flow">
            <div className="detail__section-head">
              <h3 id="detail-flow" className="detail__section-title">
                Avancement
              </h3>
              <span className="detail__section-hint">
                {currentIndex + 1} / {STATUS_FLOW.length}
              </span>
            </div>
            <ol className="stepper">
              {STATUS_FLOW.map((status, index) => {
                const done = index < currentIndex;
                const current = index === currentIndex;
                return (
                  <li
                    key={status}
                    className={`stepper__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                  >
                    <button
                      type="button"
                      className="stepper__button"
                      onClick={() => {
                        setStatus(repair.id, status);
                        toast(`Statut : ${STATUS_META[status].label}`);
                      }}
                      aria-current={current ? 'step' : undefined}
                    >
                      <span className="stepper__dot">
                        {done ? (
                          <Icon name="check" size={11} strokeWidth={3} />
                        ) : (
                          <span className="stepper__core" />
                        )}
                      </span>
                      <span className="stepper__label">{STATUS_META[status].label}</span>
                      {current && (
                        <motion.span
                          layoutId="stepper-now"
                          className="stepper__now"
                          transition={reduce ? { duration: 0 } : spring}
                        >
                          Actuel
                        </motion.span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="detail__section" aria-labelledby="detail-notes">
            <div className="detail__section-head">
              <h3 id="detail-notes" className="detail__section-title">
                Journal
              </h3>
              <span className="detail__section-hint">{repair.notes.length} note(s)</span>
            </div>

            <form className="note-form" onSubmit={submitNote}>
              <textarea
                className="input input--area"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ajouter une observation technique…"
                rows={2}
                aria-label="Nouvelle note"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon="send"
                disabled={draft.trim().length < 2}
              >
                Ajouter
              </Button>
            </form>

            {repair.notes.length === 0 ? (
              <p className="detail__empty">Aucune note pour l’instant.</p>
            ) : (
              <ol className="timeline">
                {[...repair.notes].reverse().map((note) => (
                  <li key={note.id} className="timeline__item">
                    <span className="timeline__mark" aria-hidden="true" />
                    <p className="timeline__text">{note.text}</p>
                    <p className="timeline__time">{relative(note.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="detail__footprint">
            Devis {money(repair.estimate)} · dossier {repair.ref}
          </p>
        </div>
      )}
    </Drawer>
  );
}
