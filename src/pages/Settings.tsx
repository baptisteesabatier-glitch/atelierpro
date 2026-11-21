import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Modal, TextArea, TextInput, Progress } from '../components/ui';
import { toast } from '../components/Toaster';
import { api, ApiError, type Settings as SettingsModel } from '../lib/api';
import { useApi } from '../lib/hooks';
import { money } from '../lib/format';
import { useAuth } from '../lib/auth';

const MAX_LOGO_BYTES = 300_000;

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const current = useApi(() => api.settings(), []);
  const [form, setForm] = useState<Partial<SettingsModel>>({});
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<unknown>(null);
  const [importName, setImportName] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const settings = current.data?.settings ?? null;

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings?.id, settings?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = settings
    ? (Object.keys(form) as (keyof SettingsModel)[]).some(
        (key) => form[key] !== settings[key],
      )
    : false;

  const set = <K extends keyof SettingsModel>(key: K, value: SettingsModel[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      const { id: _id, ...payload } = form as SettingsModel;
      void _id;
      await api.updateSettings(payload);
      toast('Paramètres enregistrés');
      current.reload();
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : 'Enregistrement impossible', 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast('Formats acceptés : PNG, JPEG ou WebP', 'error');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast('Logo trop volumineux (300 Ko maximum)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set('logoDataUrl', String(reader.result));
      toast('Logo prêt : enregistrez les paramètres');
    };
    reader.readAsDataURL(file);
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast('Les deux mots de passe ne correspondent pas', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast('Mot de passe modifié');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : 'Modification impossible', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = async () => {
    try {
      const blob = await api.exportBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `atelierpro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast('Sauvegarde téléchargée');
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : 'Export impossible', 'error');
    }
  };

  const pickImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setImportFile(JSON.parse(String(reader.result)));
        setImportName(file.name);
        setConfirmText('');
        setImportOpen(true);
      } catch {
        toast('Fichier JSON illisible', 'error');
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const result = await api.importBackup(importFile);
      toast(`Sauvegarde restaurée : ${result.imported.repairs} dossiers`);
      setImportOpen(false);
      current.reload();
    } catch (failure) {
      const message =
        failure instanceof ApiError ? failure.message : 'Restauration impossible.';
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (current.loading && !settings) {
    return (
      <div className="page page--narrow">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--card" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page page--narrow">
        <p className="detail__empty">{current.error ?? 'Paramètres indisponibles.'}</p>
      </div>
    );
  }

  const capacity = Math.min(100, Math.round(((settings.monthlyGoalCents || 1) / 500000) * 100));

  return (
    <div className="page">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Configuration</p>
          <h2 className="page__title">Paramètres</h2>
          <p className="page__lede">
            Identité de l’entreprise, documents commerciaux, sécurité et sauvegardes.
          </p>
        </div>
        <div className="page__actions">
          <Button variant="primary" icon="check" onClick={save} disabled={!dirty || busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </header>

      <div className="layout-2 layout-2--settings">
        <section className="card">
          <header className="card__head">
            <div>
              <h3 className="card__title">Identité de l’entreprise</h3>
              <p className="card__hint">Reprise sur les devis et les bons imprimés</p>
            </div>
          </header>

          <div className="form">
            <div className="form__row">
              <Field label="Nom commercial" htmlFor="set-name">
                <TextInput
                  id="set-name"
                  value={form.companyName ?? ''}
                  onChange={(event) => set('companyName', event.target.value)}
                />
              </Field>
              <Field label="Raison sociale" htmlFor="set-legal" hint="Facultatif">
                <TextInput
                  id="set-legal"
                  value={form.legalName ?? ''}
                  onChange={(event) => set('legalName', event.target.value)}
                />
              </Field>
            </div>

            <Field label="Adresse" htmlFor="set-address">
              <TextInput
                id="set-address"
                value={form.address ?? ''}
                onChange={(event) => set('address', event.target.value)}
              />
            </Field>

            <div className="form__row form__row--3">
              <Field label="Code postal" htmlFor="set-postal">
                <TextInput
                  id="set-postal"
                  value={form.postalCode ?? ''}
                  onChange={(event) => set('postalCode', event.target.value)}
                />
              </Field>
              <Field label="Ville" htmlFor="set-city">
                <TextInput
                  id="set-city"
                  value={form.city ?? ''}
                  onChange={(event) => set('city', event.target.value)}
                />
              </Field>
              <Field label="Téléphone" htmlFor="set-phone">
                <TextInput
                  id="set-phone"
                  value={form.phone ?? ''}
                  onChange={(event) => set('phone', event.target.value)}
                />
              </Field>
            </div>

            <div className="form__row">
              <Field label="E-mail" htmlFor="set-email">
                <TextInput
                  id="set-email"
                  type="email"
                  value={form.email ?? ''}
                  onChange={(event) => set('email', event.target.value)}
                />
              </Field>
              <Field label="SIRET" htmlFor="set-siret" hint="Mentions légales françaises">
                <TextInput
                  id="set-siret"
                  value={form.siret ?? ''}
                  onChange={(event) => set('siret', event.target.value)}
                />
              </Field>
            </div>

            <div className="form__row">
              <Field label="N° de TVA intracommunautaire" htmlFor="set-vat" hint="Facultatif">
                <TextInput
                  id="set-vat"
                  value={form.vatNumber ?? ''}
                  onChange={(event) => set('vatNumber', event.target.value)}
                />
              </Field>
              <Field label="TVA par défaut (%)" htmlFor="set-vatrate">
                <TextInput
                  id="set-vatrate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={String(form.vatRate ?? 20)}
                  onChange={(event) => set('vatRate', Number(event.target.value))}
                />
              </Field>
            </div>

            <Field
              label="Mentions de pied de document"
              htmlFor="set-footer"
              hint="Garantie, conservation des données, pénalités de retard…"
            >
              <TextArea
                id="set-footer"
                rows={2}
                value={form.footer ?? ''}
                onChange={(event) => set('footer', event.target.value)}
              />
            </Field>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <header className="card__head">
              <div>
                <h3 className="card__title">Documents</h3>
                <p className="card__hint">Logo et numérotation</p>
              </div>
            </header>

            <div className="logo">
              <div className="logo__preview">
                {form.logoDataUrl ? (
                  <img src={form.logoDataUrl} alt="Logo de l’entreprise" />
                ) : (
                  <span>{settings.companyName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="logo__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={() => fileRef.current?.click()}
                >
                  Choisir un logo
                </Button>
                {form.logoDataUrl && (
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="trash"
                    onClick={() => set('logoDataUrl', null)}
                  >
                    Retirer
                  </Button>
                )}
                <span className="logo__hint">PNG, JPEG ou WebP · 300 Ko maximum</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadLogo(file);
                  event.target.value = '';
                }}
              />
            </div>

            <div className="form">
              <div className="form__row">
                <Field label="Préfixe devis" htmlFor="set-quoteprefix">
                  <TextInput
                    id="set-quoteprefix"
                    value={form.quotePrefix ?? 'DEV'}
                    onChange={(event) => set('quotePrefix', event.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Validité (jours)" htmlFor="set-validity">
                  <TextInput
                    id="set-validity"
                    type="number"
                    min="1"
                    max="365"
                    value={String(form.quoteValidityDays ?? 30)}
                    onChange={(event) => set('quoteValidityDays', Number(event.target.value))}
                  />
                </Field>
              </div>
              <Field label="Objectif mensuel (€)" htmlFor="set-goal">
                <TextInput
                  id="set-goal"
                  type="number"
                  min="0"
                  step="100"
                  value={String((form.monthlyGoalCents ?? 0) / 100)}
                  onChange={(event) =>
                    set('monthlyGoalCents', Math.round(Number(event.target.value) * 100))
                  }
                />
              </Field>
              <p className="card__footnote">
                Objectif d’encaissement : {money((form.monthlyGoalCents ?? 0) / 100)}
              </p>
            </div>
          </section>

          <section className="card">
            <header className="card__head">
              <div>
                <h3 className="card__title">Sauvegarde</h3>
                <p className="card__hint">Export complet des données métier</p>
              </div>
            </header>
            <p className="card__text">
              La sauvegarde contient clients, dossiers, devis, notes et historique. Les comptes
              utilisateurs restent propres à cette installation.
            </p>
            <div className="card__actions">
              <Button variant="secondary" icon="arrowUpRight" onClick={exportBackup}>
                Exporter
              </Button>
              <Button
                variant="secondary"
                icon="clock"
                onClick={() => importRef.current?.click()}
              >
                Restaurer…
              </Button>
              <input
                ref={importRef}
                id="backup-file"
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) pickImport(file);
                  event.target.value = '';
                }}
              />
            </div>
          </section>
        </div>
      </div>

      <div className="layout-2 layout-2--settings">
        <section className="card">
          <header className="card__head">
            <div>
              <h3 className="card__title">Sécurité du compte</h3>
              <p className="card__hint">Connecté en tant que {user?.email}</p>
            </div>
          </header>
          <div className="form">
            <Field label="Mot de passe actuel" htmlFor="pwd-current">
              <TextInput
                id="pwd-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <div className="form__row">
              <Field label="Nouveau mot de passe" htmlFor="pwd-new" hint="10 caractères minimum">
                <TextInput
                  id="pwd-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              <Field label="Confirmation" htmlFor="pwd-confirm">
                <TextInput
                  id="pwd-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
            </div>
            <div className="form__actions">
              <Button
                variant="primary"
                icon="check"
                disabled={
                  busy || !currentPassword || newPassword.length < 10 || !confirmPassword
                }
                onClick={changePassword}
              >
                Modifier le mot de passe
              </Button>
            </div>
            <p className="card__footnote">
              La modification déconnecte les autres sessions ouvertes avec ce compte.
            </p>
          </div>
        </section>

        <div className="stack">
          {user?.role === 'ADMIN' && (
            <section className="card">
              <header className="card__head">
                <div>
                  <h3 className="card__title">Utilisateurs</h3>
                  <p className="card__hint">Comptes et permissions</p>
                </div>
              </header>
              <p className="card__text">
                Créez des comptes techniciens, ajustez leurs permissions et désactivez les accès
                inutiles.
              </p>
              <div className="card__actions">
                <Button variant="secondary" icon="users" onClick={() => navigate('/utilisateurs')}>
                  Gérer les utilisateurs
                </Button>
              </div>
            </section>
          )}

          <section className="card">
            <header className="card__head">
              <div>
                <h3 className="card__title">Occupation</h3>
                <p className="card__hint">Capacité de référence : 24 dossiers</p>
              </div>
            </header>
            <Progress value={capacity} />
            <p className="card__footnote">
              Un objectif mensuel de {money((settings.monthlyGoalCents || 0) / 100)} correspond à
              une activité soutenue pour un atelier de deux techniciens.
            </p>
          </section>
        </div>
      </div>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Restaurer une sauvegarde"
        description={importName ? `Fichier : ${importName}` : undefined}
        width={520}
        footer={
          <>
            <Button variant="quiet" onClick={() => setImportOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              icon="clock"
              disabled={busy || confirmText !== 'REPLACE'}
              onClick={runImport}
            >
              Restaurer
            </Button>
          </>
        }
      >
        <div className="form">
          <p className="card__text">
            Toutes les données métier actuelles seront remplacées par celles de la sauvegarde. Les
            comptes utilisateurs ne sont pas modifiés. L’intégrité du fichier est vérifiée avant
            toute écriture.
          </p>
          <Field
            label="Saisissez REPLACE pour confirmer"
            htmlFor="backup-confirm"
            hint="Cette action est irréversible sans sauvegarde préalable."
          >
            <TextInput
              id="backup-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="REPLACE"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
