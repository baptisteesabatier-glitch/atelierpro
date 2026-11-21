import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Drawer,
  Field,
  IconButton,
  Modal,
  Select,
  TextArea,
  TextInput,
} from './ui';
import { Icon } from './Icon';
import { toast } from './Toaster';
import { openPdf, ApiError, type Quote, type RepairStatus } from '../lib/api';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { NEXT_STATUS, PRIORITY_META, QUOTE_STATUS_META, STATUS_META } from '../lib/domain';
import { clock, day, fullDate, money, relative } from '../lib/format';
import { useAuth } from '../lib/auth';

interface QuoteDraftItem {
  key: string;
  kind: 'LABOR' | 'PART' | 'SUPPLY';
  label: string;
  quantity: string;
  unit: string;
}

const emptyItem = (): QuoteDraftItem => ({
  key: crypto.randomUUID(),
  kind: 'LABOR',
  label: '',
  quantity: '1',
  unit: '',
});

function QuoteEditor({
  open,
  onClose,
  repairId,
  defaultVat,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  repairId: string;
  defaultVat: number;
  onCreated: () => void;
}) {
  const [items, setItems] = useState<QuoteDraftItem[]>([emptyItem()]);
  const [vat, setVat] = useState(String(defaultVat));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems([emptyItem()]);
    setVat(String(defaultVat));
    setNotes('');
    setError(null);
  }, [open, defaultVat]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const quantity = Number(item.quantity.replace(',', '.')) || 0;
      const unit = Math.round((Number(item.unit.replace(',', '.')) || 0) * 100);
      return sum + Math.round(quantity * unit);
    }, 0);
    const rate = Number(vat.replace(',', '.')) || 0;
    const vatCents = Math.round((subtotal * rate) / 100);
    return { subtotal, vatCents, total: subtotal + vatCents };
  }, [items, vat]);

  const submit = async () => {
    const payload = items
      .map((item) => ({
        kind: item.kind,
        label: item.label.trim(),
        quantity: Number(item.quantity.replace(',', '.')) || 0,
        unitPriceCents: Math.round((Number(item.unit.replace(',', '.')) || 0) * 100),
      }))
      .filter((item) => item.label.length > 0 && item.quantity > 0);

    if (payload.length === 0) {
      setError('Ajoutez au moins une ligne avec une désignation.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.createQuote({
        repairId,
        vatRate: Number(vat.replace(',', '.')) || 0,
        notes: notes.trim() || undefined,
        items: payload,
      });
      toast('Devis créé');
      onCreated();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau devis"
      description="Lignes de prestation, TVA et totaux calculés en centimes."
      width={720}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={busy}>
            {busy ? 'Création…' : 'Créer le devis'}
          </Button>
        </>
      }
    >
      <div className="quote">
        <div className="quote__rows">
          {items.map((item, index) => (
            <div className="quote__row" key={item.key}>
              <Select
                aria-label={`Type de la ligne ${index + 1}`}
                value={item.kind}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((entry) =>
                      entry.key === item.key
                        ? { ...entry, kind: event.target.value as QuoteDraftItem['kind'] }
                        : entry,
                    ),
                  )
                }
              >
                <option value="LABOR">Main d’œuvre</option>
                <option value="PART">Pièce</option>
                <option value="SUPPLY">Fourniture</option>
              </Select>
              <TextInput
                aria-label={`Désignation de la ligne ${index + 1}`}
                value={item.label}
                placeholder="Désignation"
                onChange={(event) =>
                  setItems((current) =>
                    current.map((entry) =>
                      entry.key === item.key ? { ...entry, label: event.target.value } : entry,
                    ),
                  )
                }
              />
              <TextInput
                aria-label={`Quantité de la ligne ${index + 1}`}
                value={item.quantity}
                inputMode="decimal"
                placeholder="Qté"
                onChange={(event) =>
                  setItems((current) =>
                    current.map((entry) =>
                      entry.key === item.key ? { ...entry, quantity: event.target.value } : entry,
                    ),
                  )
                }
              />
              <TextInput
                aria-label={`Prix unitaire de la ligne ${index + 1}`}
                value={item.unit}
                inputMode="decimal"
                placeholder="P.U. €"
                onChange={(event) =>
                  setItems((current) =>
                    current.map((entry) =>
                      entry.key === item.key ? { ...entry, unit: event.target.value } : entry,
                    ),
                  )
                }
              />
              <IconButton
                label="Retirer la ligne"
                icon="trash"
                onClick={() =>
                  setItems((current) =>
                    current.length === 1
                      ? [emptyItem()]
                      : current.filter((entry) => entry.key !== item.key),
                  )
                }
              />
            </div>
          ))}
        </div>

        <Button
          variant="quiet"
          size="sm"
          icon="plus"
          onClick={() => setItems((current) => [...current, emptyItem()])}
        >
          Ajouter une ligne
        </Button>

        <div className="quote__footer">
          <Field label="TVA (%)" htmlFor="quote-vat">
            <TextInput
              id="quote-vat"
              value={vat}
              inputMode="decimal"
              onChange={(event) => setVat(event.target.value)}
            />
          </Field>
          <dl className="quote__totals">
            <div>
              <dt>Total HT</dt>
              <dd>{money(totals.subtotal / 100)}</dd>
            </div>
            <div>
              <dt>TVA</dt>
              <dd>{money(totals.vatCents / 100)}</dd>
            </div>
            <div className="quote__total">
              <dt>Total TTC</dt>
              <dd>{money(totals.total / 100)}</dd>
            </div>
          </dl>
        </div>

        <Field label="Mentions du devis" htmlFor="quote-notes" hint="Facultatif">
          <TextArea
            id="quote-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Conditions particulières, garantie…"
          />
        </Field>

        {error && <p className="form__error">{error}</p>}
      </div>
    </Modal>
  );
}

export default function RepairDetail({
  repairId,
  onClose,
  onChanged,
}: {
  repairId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user, can } = useAuth();
  const detail = useApi(
    () => (repairId ? api.repair(repairId) : Promise.resolve(null)),
    [repairId],
  );
  const settings = useApi(() => api.settings(), []);

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<RepairStatus | null>(null);
  const [force, setForce] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [estimate, setEstimate] = useState('');
  const [payment, setPayment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const repair = detail.data?.repair ?? null;

  useEffect(() => {
    if (!repair) return;
    setDiagnosis(repair.diagnosis ?? '');
    setEstimate((repair.estimateCents / 100).toString());
    setPayment((repair.estimateCents / 100).toString());
  }, [repair?.id, repair?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!repairId) {
      setNote('');
      setQuoteOpen(false);
      setConfirmStatus(null);
      setConfirmDelete(false);
    }
  }, [repairId]);

  const refresh = () => {
    detail.reload();
    onChanged?.();
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast(message);
      refresh();
    } catch (failure) {
      const text =
        failure instanceof ApiError || failure instanceof Error
          ? failure.message
          : 'Action impossible.';
      toast(text, 'error');
    } finally {
      setBusy(false);
    }
  };

  const applyStatus = async (status: RepairStatus, forced = false) => {
    if (!repair) return;
    await run(
      () => api.setStatus(repair.id, status, undefined, forced),
      `Statut : ${STATUS_META[status].label}`,
    );
    setConfirmStatus(null);
    setForce(false);
  };

  const trackingUrl = repair
    ? `${window.location.origin}/suivi/${repair.trackingToken}`
    : '';

  const totals = repair?.quotes?.reduce(
    (acc, quote) => {
      if (quote.status === 'ACCEPTED') acc.accepted += quote.totalCents;
      return acc;
    },
    { accepted: 0 },
  );

  return (
    <>
      <Drawer
        open={Boolean(repairId)}
        onClose={onClose}
        eyebrow={repair ? `Reçu le ${fullDate(repair.receivedAt)}` : undefined}
        title={repair ? `${repair.brand} ${repair.model}` : 'Dossier'}
        footer={
          repair && (
            <div className="drawer__actions">
              <Button
                variant="secondary"
                icon="arrowUpRight"
                onClick={() =>
                  void openPdf(`/repairs/${repair.id}/deposit-slip.pdf`).catch((error) =>
                    toast(error.message, 'error'),
                  )
                }
              >
                Bon de dépôt
              </Button>
              <Button
                variant="secondary"
                icon="arrowUpRight"
                onClick={() =>
                  void openPdf(`/repairs/${repair.id}/return-slip.pdf`).catch((error) =>
                    toast(error.message, 'error'),
                  )
                }
              >
                Bon de restitution
              </Button>
            </div>
          )
        }
      >
        {detail.loading && !repair && (
          <div className="stack">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        )}

        {detail.error && !repair && <p className="detail__empty">{detail.error}</p>}

        {repair && (
          <div className="detail">
            <div className="detail__banner">
              <span className="detail__ref">{repair.reference}</span>
              <Badge tone={STATUS_META[repair.status].tone} dot>
                {STATUS_META[repair.status].label}
              </Badge>
              <Badge tone={PRIORITY_META[repair.priority].tone}>
                {PRIORITY_META[repair.priority].label}
              </Badge>
              {repair.paidAt && <Badge tone="green">Payé</Badge>}
            </div>

            <dl className="detail__facts">
              <div>
                <dt>Client</dt>
                <dd>
                  {repair.client.name}
                  <span className="detail__sub">{repair.client.phone}</span>
                </dd>
              </div>
              <div>
                <dt>Technicien</dt>
                <dd>{repair.assignedTo?.name ?? 'Non affecté'}</dd>
              </div>
              <div>
                <dt>N° de série</dt>
                <dd>{repair.serialNumber || '—'}</dd>
              </div>
              <div>
                <dt>Montant</dt>
                <dd>{money(repair.estimateCents / 100)}</dd>
              </div>
            </dl>

            <section className="detail__section">
              <div className="detail__section-head">
                <h3 className="detail__section-title">Panne signalée</h3>
              </div>
              <p className="detail__text">{repair.issue}</p>
            </section>

            <section className="detail__section">
              <div className="detail__section-head">
                <h3 className="detail__section-title">Diagnostic</h3>
                {!can('canEditRepairs') && <span className="detail__section-hint">Lecture seule</span>}
              </div>
              {can('canEditRepairs') ? (
                <div className="detail__editor">
                  <TextArea
                    rows={3}
                    value={diagnosis}
                    aria-label="Diagnostic technique"
                    placeholder="Constats, pièces à changer…"
                    onChange={(event) => setDiagnosis(event.target.value)}
                  />
                  <div className="detail__editor-row">
                    <TextInput
                      value={estimate}
                      inputMode="decimal"
                      aria-label="Montant estimé en euros"
                      onChange={(event) => setEstimate(event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="check"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            api.updateRepair(repair.id, {
                              diagnosis: diagnosis.trim() || undefined,
                              estimateCents: Math.round(
                                (Number(estimate.replace(',', '.')) || 0) * 100,
                              ),
                            }),
                          'Dossier mis à jour',
                        )
                      }
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="detail__text">{repair.diagnosis || 'Pas encore de diagnostic.'}</p>
              )}
            </section>

            {can('canChangeStatus') && NEXT_STATUS[repair.status].length > 0 && (
              <section className="detail__section">
                <div className="detail__section-head">
                  <h3 className="detail__section-title">Étape suivante</h3>
                </div>
                <div className="detail__actions">
                  {NEXT_STATUS[repair.status].map((status) => (
                    <Button
                      key={status}
                      variant="secondary"
                      size="sm"
                      icon="chevronRight"
                      disabled={busy}
                      onClick={() => setConfirmStatus(status)}
                    >
                      {STATUS_META[status].label}
                    </Button>
                  ))}
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="close"
                    disabled={busy}
                    onClick={() => setConfirmStatus('CANCELLED')}
                  >
                    Annuler le dossier
                  </Button>
                </div>
              </section>
            )}

            {user?.role === 'ADMIN' && (
              <section className="detail__section">
                <div className="detail__section-head">
                  <h3 className="detail__section-title">Correction administrative</h3>
                  <span className="detail__section-hint">Réservé aux administrateurs</span>
                </div>
                <div className="detail__editor-row">
                  <Select
                    aria-label="Forcer un statut"
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setForce(true);
                      setConfirmStatus(event.target.value as RepairStatus);
                      event.target.value = '';
                    }}
                  >
                    <option value="">Forcer un statut…</option>
                    {Object.keys(STATUS_META).map((status) => (
                      <option key={status} value={status}>
                        {STATUS_META[status as RepairStatus].label}
                      </option>
                    ))}
                  </Select>
                </div>
              </section>
            )}

            <section className="detail__section">
              <div className="detail__section-head">
                <h3 className="detail__section-title">Devis</h3>
                <span className="detail__section-hint">
                  {money((totals?.accepted ?? 0) / 100)} acceptés
                </span>
              </div>

              {repair.quotes && repair.quotes.length > 0 ? (
                <ul className="history">
                  {repair.quotes.map((quote: Quote) => {
                    const meta = QUOTE_STATUS_META[quote.status];
                    return (
                      <li key={quote.id}>
                        <div className="history__row">
                          <span className="history__main">
                            <span className="history__title">
                              {quote.number} · {money(quote.totalCents / 100)}
                            </span>
                            <span className="history__meta">
                              {quote.items?.length ?? 0} ligne(s) · TVA {quote.vatRate} % · valable
                              jusqu’au {day(quote.validUntil)}
                            </span>
                          </span>
                          <span className="history__side">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            <span className="history__actions">
                              <IconButton
                                label={`PDF du devis ${quote.number}`}
                                icon="arrowUpRight"
                                size={16}
                                onClick={() =>
                                  void openPdf(`/quotes/${quote.id}/pdf`).catch((error) =>
                                    toast(error.message, 'error'),
                                  )
                                }
                              />
                              {quote.status === 'DRAFT' && can('canCreateQuotes') && (
                                <Button
                                  variant="quiet"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void run(
                                      () => api.setQuoteStatus(quote.id, 'SENT'),
                                      'Devis marqué comme envoyé',
                                    )
                                  }
                                >
                                  Envoyer
                                </Button>
                              )}
                              {(quote.status === 'SENT' || quote.status === 'DRAFT') &&
                                can('canCreateQuotes') && (
                                  <Button
                                    variant="quiet"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() =>
                                      void run(
                                        () => api.setQuoteStatus(quote.id, 'ACCEPTED'),
                                        'Devis accepté',
                                      )
                                    }
                                  >
                                    Accepter
                                  </Button>
                                )}
                            </span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="detail__empty">Aucun devis pour ce dossier.</p>
              )}

              {can('canCreateQuotes') && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={() => setQuoteOpen(true)}
                >
                  Créer un devis
                </Button>
              )}
            </section>

            <section className="detail__section">
              <div className="detail__section-head">
                <h3 className="detail__section-title">Notes internes</h3>
                <span className="detail__section-hint">Jamais visibles par le client</span>
              </div>

              {repair.notes && repair.notes.length > 0 ? (
                <ul className="notes">
                  {repair.notes.map((entry) => (
                    <li key={entry.id} className="notes__item">
                      <p className="notes__body">{entry.body}</p>
                      <p className="notes__meta">
                        {entry.author?.name ?? '—'} · {relative(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="detail__empty">Aucune note pour l’instant.</p>
              )}

              <div className="detail__editor">
                <TextArea
                  rows={2}
                  value={note}
                  aria-label="Nouvelle note interne"
                  placeholder="Échange avec le client, pièce commandée…"
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon="note"
                  disabled={busy || note.trim().length < 1}
                  onClick={() =>
                    void run(async () => {
                      await api.addNote(repair.id, note.trim());
                      setNote('');
                    }, 'Note ajoutée')
                  }
                >
                  Ajouter la note
                </Button>
              </div>
            </section>

            <section className="detail__section">
              <div className="detail__section-head">
                <h3 className="detail__section-title">Suivi client</h3>
                <span className="detail__section-hint">Lien public, sans données privées</span>
              </div>
              <div className="detail__editor-row">
                <TextInput readOnly value={trackingUrl} aria-label="Lien de suivi client" />
                <Button
                  variant="secondary"
                  size="sm"
                  icon="send"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(trackingUrl)
                      .then(() => toast('Lien de suivi copié'))
                      .catch(() => toast('Copie impossible', 'error'));
                  }}
                >
                  Copier
                </Button>
              </div>
            </section>

            {user?.role === 'ADMIN' && (
              <section className="detail__section">
                <div className="detail__section-head">
                  <h3 className="detail__section-title">Encaissement</h3>
                  <span className="detail__section-hint">
                    {repair.paidAt
                      ? `Encaissé le ${fullDate(repair.paidAt)} à ${clock(repair.paidAt)}`
                      : 'Aucun paiement enregistré'}
                  </span>
                </div>
                <div className="detail__editor-row">
                  <TextInput
                    value={payment}
                    inputMode="decimal"
                    aria-label="Montant encaissé en euros"
                    onChange={(event) => setPayment(event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="euro"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          api.setPayment(
                            repair.id,
                            true,
                            Math.round((Number(payment.replace(',', '.')) || 0) * 100),
                          ),
                        'Paiement enregistré',
                      )
                    }
                  >
                    Encaisser
                  </Button>
                  {repair.paidAt && (
                    <Button
                      variant="quiet"
                      size="sm"
                      icon="close"
                      disabled={busy}
                      onClick={() =>
                        void run(() => api.setPayment(repair.id, false), 'Encaissement annulé')
                      }
                    >
                      Annuler
                    </Button>
                  )}
                </div>
              </section>
            )}

            <section className="detail__section">
              <div className="detail__section-head">
                <h3 className="detail__section-title">Historique</h3>
              </div>
              <ul className="timeline">
                {(repair.events ?? []).map((event) => (
                  <li key={event.id} className="timeline__item">
                    <span className="timeline__dot" />
                    <span className="timeline__text">
                      <span className="timeline__title">
                        {event.toStatus ? STATUS_META[event.toStatus].label : event.type}
                        {event.fromStatus ? ` (depuis ${STATUS_META[event.fromStatus].short})` : ''}
                      </span>
                      {event.message && <span className="timeline__meta">{event.message}</span>}
                      <span className="timeline__meta">
                        {event.actor?.name ?? 'Système'} · {relative(event.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {user?.role === 'ADMIN' && (
              <section className="detail__section">
                <Button
                  variant="danger"
                  size="sm"
                  icon="trash"
                  onClick={() => setConfirmDelete(true)}
                >
                  Supprimer le dossier
                </Button>
              </section>
            )}
          </div>
        )}
      </Drawer>

      {repair && (
        <>
          <QuoteEditor
            open={quoteOpen}
            onClose={() => setQuoteOpen(false)}
            repairId={repair.id}
            defaultVat={settings.data?.settings.vatRate ?? 20}
            onCreated={refresh}
          />

          <Modal
            open={Boolean(confirmStatus)}
            onClose={() => {
              setConfirmStatus(null);
              setForce(false);
            }}
            title={`Passer au statut « ${
              confirmStatus ? STATUS_META[confirmStatus].label : ''
            } » ?`}
            description={confirmStatus ? STATUS_META[confirmStatus].hint : undefined}
            width={460}
            footer={
              <>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setConfirmStatus(null);
                    setForce(false);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  icon="check"
                  disabled={busy}
                  onClick={() => confirmStatus && void applyStatus(confirmStatus, force)}
                >
                  Confirmer
                </Button>
              </>
            }
          >
            <p className="card__text">
              {force
                ? 'Transition forcée : l’opération contourne le parcours normal et reste journalisée.'
                : 'Le changement est horodaté et ajouté à l’historique du dossier.'}
            </p>
          </Modal>

          <Modal
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            title="Supprimer ce dossier ?"
            description="Les notes, devis et événements associés seront définitivement supprimés."
            width={460}
            footer={
              <>
                <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  icon="trash"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api.deleteRepair(repair.id);
                      setConfirmDelete(false);
                      onClose();
                    }, 'Dossier supprimé')
                  }
                >
                  Supprimer
                </Button>
              </>
            }
          >
            <div className="notice">
              <Icon name="trash" size={18} />
              <p>
                Cette action est irréversible. Préférez « Annuler le dossier » pour conserver
                l’historique.
              </p>
            </div>
          </Modal>
        </>
      )}
    </>
  );
}
