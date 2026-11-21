import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  EmptyState,
  Field,
  Modal,
  TextArea,
  TextInput,
  spring,
} from '../components/ui';
import { Icon } from '../components/Icon';
import NewRepairDialog from '../components/NewRepairDialog';
import { toast } from '../components/Toaster';
import { api, type Client } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { STATUS_META } from '../lib/domain';
import { day, money } from '../lib/format';
import { useAuth } from '../lib/auth';

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  postalCode: '',
  city: '',
  notes: '',
};

export default function Clients() {
  const { user, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 220);
  const list = useApi(() => api.clients(debounced), [debounced]);

  const openId = params.get('open');
  const detail = useApi(
    () => (openId ? api.client(openId) : Promise.resolve(null)),
    [openId],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);

  const clients = list.data?.clients ?? [];
  const current = detail.data?.client ?? null;

  const openClient = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('open', id);
    setParams(next, { replace: true });
  };

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!formOpen) return;
    setForm(
      editing
        ? {
            name: editing.name,
            phone: editing.phone,
            email: editing.email ?? '',
            address: editing.address ?? '',
            postalCode: editing.postalCode ?? '',
            city: editing.city ?? '',
            notes: editing.notes ?? '',
          }
        : EMPTY,
    );
    setError(null);
  }, [formOpen, editing]);

  const activeCount = useMemo(
    () => clients.filter((client) => (client.stats?.active ?? 0) > 0).length,
    [clients],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        notes: form.notes.trim(),
      };
      if (editing) {
        await api.updateClient(editing.id, payload);
        toast('Client mis à jour');
      } else {
        await api.createClient(payload);
        toast('Client créé');
      }
      setFormOpen(false);
      list.reload();
      detail.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Répertoire</p>
          <h2 className="page__title">Clients</h2>
          <p className="page__lede">
            {clients.length} clients · {activeCount} avec un dossier ouvert
          </p>
        </div>
        <div className="page__actions">
          {can('canManageClients') && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Nouveau client
            </Button>
          )}
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

      {list.error && (
        <EmptyState
          title="Impossible de charger les clients"
          message={list.error}
          action={
            <Button variant="secondary" icon="clock" onClick={list.reload}>
              Réessayer
            </Button>
          }
        />
      )}

      {!list.error && list.loading && !list.data && (
        <div className="stack">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}

      {!list.error && list.data && clients.length === 0 && (
        <EmptyState
          title="Aucun client"
          message={
            query ? `Aucun client ne correspond à « ${query} ».` : 'Créez votre premier client.'
          }
        />
      )}

      {clients.length > 0 && (
        <section className="clients" aria-label="Liste des clients">
          {clients.map((client, index) => {
            const stats = client.stats ?? { repairs: 0, billedCents: 0 };
            return (
              <motion.button
                key={client.id}
                type="button"
                className="client-card"
                onClick={() => openClient(client.id)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: Math.min(index * 0.03, 0.24) }}
              >
                <div className="client-card__head">
                  <Avatar name={client.name} />
                  <span className="client-card__identity">
                    <span className="client-card__name">{client.name}</span>
                    <span className="client-card__city">{client.city ?? '—'}</span>
                  </span>
                  {(stats.active ?? 0) > 0 ? (
                    <Badge tone="accent" dot>
                      {stats.active} en cours
                    </Badge>
                  ) : (
                    <Badge tone="muted">À jour</Badge>
                  )}
                </div>

                <dl className="client-card__stats">
                  <div>
                    <dt>Interventions</dt>
                    <dd>{stats.repairs}</dd>
                  </div>
                  <div>
                    <dt>Encaissé</dt>
                    <dd>{money(stats.billedCents / 100)}</dd>
                  </div>
                  <div>
                    <dt>Client depuis</dt>
                    <dd>{day(client.createdAt)}</dd>
                  </div>
                </dl>

                <div className="client-card__foot">
                  <span className="client-card__contact">
                    <Icon name="phone" size={14} />
                    {client.phone}
                  </span>
                  <span className="client-card__link">
                    Fiche
                    <Icon name="chevronRight" size={14} />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </section>
      )}

      <Drawer
        open={Boolean(openId)}
        onClose={close}
        eyebrow={current ? `Client depuis ${day(current.createdAt)}` : undefined}
        title={current?.name ?? 'Client'}
        footer={
          current && (
            <div className="drawer__actions">
              {can('canEditRepairs') && (
                <Button variant="primary" icon="plus" onClick={() => setRepairOpen(true)}>
                  Nouvelle réparation
                </Button>
              )}
              {can('canManageClients') && (
                <Button
                  variant="secondary"
                  icon="settings"
                  onClick={() => {
                    setEditing(current);
                    setFormOpen(true);
                  }}
                >
                  Modifier
                </Button>
              )}
            </div>
          )
        }
      >
        {detail.loading && !current && <div className="skeleton" />}
        {detail.error && !current && <p className="detail__empty">{detail.error}</p>}

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
                <dd>{[current.postalCode, current.city].filter(Boolean).join(' ') || '—'}</dd>
              </div>
              <div>
                <dt>Adresse</dt>
                <dd>{current.address || '—'}</dd>
              </div>
            </dl>

            {current.notes && (
              <section className="detail__section">
                <div className="detail__section-head">
                  <h3 className="detail__section-title">Notes client</h3>
                </div>
                <p className="detail__text">{current.notes}</p>
              </section>
            )}

            <section className="detail__section">
              <div className="detail__section-head">
                <h3 className="detail__section-title">Historique</h3>
                <span className="detail__section-hint">
                  {money((current.stats?.billedCents ?? 0) / 100)} encaissés
                </span>
              </div>

              {current.repairs.length === 0 ? (
                <p className="detail__empty">Aucune intervention enregistrée.</p>
              ) : (
                <ul className="history">
                  {current.repairs.map((repair) => (
                    <li key={repair.id}>
                      <div className="history__row">
                        <span className="history__main">
                          <span className="history__title">
                            {repair.brand} {repair.model}
                          </span>
                          <span className="history__meta">
                            {repair.reference} · {day(repair.receivedAt)}
                          </span>
                        </span>
                        <span className="history__side">
                          <Badge tone={STATUS_META[repair.status].tone}>
                            {STATUS_META[repair.status].short}
                          </Badge>
                          <span className="history__amount">
                            {money(repair.estimateCents / 100)}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {user?.role === 'ADMIN' && (
              <section className="detail__section">
                <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirmDelete(true)}>
                  Supprimer le client
                </Button>
              </section>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le client' : 'Nouveau client'}
        description="Coordonnées utilisées sur les devis et les bons."
        width={620}
        footer={
          <>
            <Button variant="quiet" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="client-form"
              icon="check"
              disabled={busy}
            >
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <form id="client-form" className="form" onSubmit={submit} noValidate>
          <div className="form__row">
            <Field label="Nom complet" htmlFor="client-name">
              <TextInput
                id="client-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                placeholder="Prénom et nom"
              />
            </Field>
            <Field label="Téléphone" htmlFor="client-phone">
              <TextInput
                id="client-phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                required
                inputMode="tel"
                placeholder="06 00 00 00 00"
              />
            </Field>
          </div>
          <div className="form__row">
            <Field label="E-mail" htmlFor="client-email" hint="Facultatif">
              <TextInput
                id="client-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="client@mail.fr"
              />
            </Field>
            <Field label="Code postal" htmlFor="client-postal" hint="Facultatif">
              <TextInput
                id="client-postal"
                value={form.postalCode}
                onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                placeholder="69006"
              />
            </Field>
          </div>
          <div className="form__row">
            <Field label="Adresse" htmlFor="client-address" hint="Facultatif">
              <TextInput
                id="client-address"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="12 rue des Artisans"
              />
            </Field>
            <Field label="Ville" htmlFor="client-city" hint="Facultatif">
              <TextInput
                id="client-city"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                placeholder="Lyon"
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="client-notes" hint="Visibles uniquement par l’atelier">
            <TextArea
              id="client-notes"
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
          {error && <p className="form__error">{error}</p>}
        </form>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer ce client ?"
        description="La suppression est refusée si des dossiers y sont rattachés."
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
              onClick={() => {
                if (!current) return;
                setBusy(true);
                void api
                  .deleteClient(current.id)
                  .then(() => {
                    toast('Client supprimé');
                    setConfirmDelete(false);
                    close();
                    list.reload();
                  })
                  .catch((failure: Error) => toast(failure.message, 'error'))
                  .finally(() => setBusy(false));
              }}
            >
              Supprimer
            </Button>
          </>
        }
      >
        <p className="card__text">
          Les données personnelles du client seront effacées. Exportez sa fiche au préalable si
          nécessaire.
        </p>
      </Modal>

      <NewRepairDialog
        open={repairOpen}
        onClose={() => setRepairOpen(false)}
        presetClientId={current?.id}
        onCreated={() => {
          list.reload();
          detail.reload();
        }}
      />
    </div>
  );
}
