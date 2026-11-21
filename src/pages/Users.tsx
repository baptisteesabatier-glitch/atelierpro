import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Modal,
  Select,
  TextInput,
  spring,
} from '../components/ui';
import { toast } from '../components/Toaster';
import { api, type Permissions, type Role, type User } from '../lib/api';
import { useApi } from '../lib/hooks';
import { relative } from '../lib/format';
import { useAuth } from '../lib/auth';

const PERMISSION_LABELS: { key: keyof Permissions; label: string; hint: string }[] = [
  { key: 'canEditRepairs', label: 'Modifier les dossiers', hint: 'Diagnostic, montant, affectation' },
  { key: 'canChangeStatus', label: 'Changer les statuts', hint: 'Faire avancer le parcours' },
  { key: 'canCreateQuotes', label: 'Créer des devis', hint: 'Lignes, TVA et envoi' },
  { key: 'canManageClients', label: 'Gérer les clients', hint: 'Créer et modifier les fiches' },
];

const DEFAULT_PERMISSIONS: Permissions = {
  canEditRepairs: true,
  canChangeStatus: true,
  canCreateQuotes: false,
  canManageClients: false,
};

export default function Users() {
  const { user: me } = useAuth();
  const list = useApi(() => api.users(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('TECHNICIAN');
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const users = list.data?.users ?? [];

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        permissions: role === 'TECHNICIAN' ? permissions : undefined,
      });
      toast('Compte créé');
      setCreateOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('TECHNICIAN');
      setPermissions(DEFAULT_PERMISSIONS);
      list.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (target: User, input: Parameters<typeof api.updateUser>[1], message: string) => {
    setBusy(true);
    try {
      await api.updateUser(target.id, input);
      toast(message);
      list.reload();
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : 'Action impossible', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Administration</p>
          <h2 className="page__title">Utilisateurs</h2>
          <p className="page__lede">
            {users.filter((entry) => entry.active).length} comptes actifs ·{' '}
            {users.filter((entry) => entry.role === 'ADMIN').length} administrateur(s)
          </p>
        </div>
        <div className="page__actions">
          <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
            Ajouter un utilisateur
          </Button>
        </div>
      </header>

      {list.error && (
        <EmptyState
          title="Liste indisponible"
          message={list.error}
          action={
            <Button variant="secondary" icon="clock" onClick={list.reload}>
              Réessayer
            </Button>
          }
        />
      )}

      {users.length > 0 && (
        <section className="card" aria-label="Comptes utilisateurs">
          <ul className="users">
            {users.map((entry, index) => (
              <motion.li
                key={entry.id}
                className={`users__row${entry.active ? '' : ' is-inactive'}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: Math.min(index * 0.03, 0.2) }}
              >
                <Avatar name={entry.name} size="sm" />
                <span className="users__identity">
                  <span className="users__name">
                    {entry.name}
                    {entry.id === me?.id && <span className="users__you">vous</span>}
                  </span>
                  <span className="users__email">{entry.email}</span>
                </span>
                <Badge tone={entry.role === 'ADMIN' ? 'accent' : 'slate'}>
                  {entry.role === 'ADMIN' ? 'Administrateur' : 'Technicien'}
                </Badge>
                <span className="users__meta">
                  {entry.active
                    ? entry.lastLoginAt
                      ? `Connecté ${relative(entry.lastLoginAt)}`
                      : 'Jamais connecté'
                    : 'Compte désactivé'}
                </span>
                <span className="users__actions">
                  {entry.role === 'TECHNICIAN' && (
                    <>
                      {PERMISSION_LABELS.map((permission) => {
                        const active =
                          entry.permissions?.[permission.key] ??
                          DEFAULT_PERMISSIONS[permission.key] ??
                          false;
                        return (
                          <button
                            key={permission.key}
                            type="button"
                            className={`perm${active ? ' is-on' : ''}`}
                            title={permission.hint}
                            disabled={busy || !entry.active}
                            onClick={() =>
                              void patch(
                                entry,
                                {
                                  permissions: {
                                    ...DEFAULT_PERMISSIONS,
                                    ...entry.permissions,
                                    [permission.key]: !active,
                                  },
                                },
                                active ? 'Permission retirée' : 'Permission accordée',
                              )
                            }
                          >
                            {permission.label}
                          </button>
                        );
                      })}
                    </>
                  )}
                  <IconButton
                    label={`Réinitialiser le mot de passe de ${entry.name}`}
                    icon="clock"
                    size={16}
                    disabled={busy}
                    onClick={() => {
                      setResetTarget(entry);
                      setResetPassword('');
                    }}
                  />
                  {entry.id !== me?.id && (
                    <Button
                      variant="quiet"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void patch(
                          entry,
                          { active: !entry.active },
                          entry.active ? 'Compte désactivé' : 'Compte réactivé',
                        )
                      }
                    >
                      {entry.active ? 'Désactiver' : 'Réactiver'}
                    </Button>
                  )}
                </span>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvel utilisateur"
        description="Le mot de passe est haché (bcrypt) et jamais stocké en clair."
        width={620}
        footer={
          <>
            <Button variant="quiet" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" form="user-form" icon="check" disabled={busy}>
              Créer le compte
            </Button>
          </>
        }
      >
        <form id="user-form" className="form" onSubmit={create} noValidate>
          <div className="form__row">
            <Field label="Nom" htmlFor="user-name">
              <TextInput
                id="user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="Prénom et nom"
              />
            </Field>
            <Field label="Rôle" htmlFor="user-role">
              <Select
                id="user-role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value="TECHNICIAN">Technicien</option>
                <option value="ADMIN">Administrateur</option>
              </Select>
            </Field>
          </div>
          <Field label="E-mail" htmlFor="user-email">
            <TextInput
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="prenom@atelier.fr"
            />
          </Field>
          <Field
            label="Mot de passe initial"
            htmlFor="user-password"
            hint="10 caractères minimum — à communiquer de vive voix"
          >
            <TextInput
              id="user-password"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          {role === 'TECHNICIAN' && (
            <fieldset className="perms">
              <legend className="field__label">Permissions</legend>
              {PERMISSION_LABELS.map((permission) => (
                <label key={permission.key} className="perms__row">
                  <input
                    type="checkbox"
                    checked={permissions[permission.key] ?? false}
                    onChange={(event) =>
                      setPermissions({ ...permissions, [permission.key]: event.target.checked })
                    }
                  />
                  <span>
                    <strong>{permission.label}</strong>
                    <em>{permission.hint}</em>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {error && <p className="form__error">{error}</p>}
        </form>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Nouveau mot de passe — ${resetTarget?.name ?? ''}`}
        description="Toutes les sessions de ce compte seront fermées."
        width={460}
        footer={
          <>
            <Button variant="quiet" onClick={() => setResetTarget(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              icon="check"
              disabled={busy || resetPassword.length < 10}
              onClick={() => {
                if (!resetTarget) return;
                void patch(
                  resetTarget,
                  { password: resetPassword },
                  'Mot de passe réinitialisé',
                ).then(() => {
                  setResetTarget(null);
                  setResetPassword('');
                });
              }}
            >
              Réinitialiser
            </Button>
          </>
        }
      >
        <Field
          label="Mot de passe"
          htmlFor="reset-password"
          hint="10 caractères minimum, communiqué au technicien de vive voix."
        >
          <TextInput
            id="reset-password"
            type="text"
            value={resetPassword}
            onChange={(event) => setResetPassword(event.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
