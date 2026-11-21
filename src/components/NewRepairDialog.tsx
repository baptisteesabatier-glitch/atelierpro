import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Button,
  Field,
  Modal,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from './ui';
import { toast } from './Toaster';
import { api, type DeviceCategory, type Priority, type User } from '../lib/api';
import { useApi } from '../lib/hooks';
import { CATEGORY_META } from '../lib/domain';
import { useAuth } from '../lib/auth';

const NEW_CLIENT = '__new__';

export default function NewRepairDialog({
  open,
  onClose,
  presetClientId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  presetClientId?: string;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const clients = useApi(() => api.clients(), [open]);
  const users = useApi(
    () => (user?.role === 'ADMIN' ? api.users() : Promise.resolve({ users: [] as User[] })),
    [open, user?.role],
  );

  const [clientId, setClientId] = useState(NEW_CLIENT);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<DeviceCategory>('PHONE');
  const [serialNumber, setSerialNumber] = useState('');
  const [issue, setIssue] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [estimate, setEstimate] = useState('0');
  const [technician, setTechnician] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = clients.data?.clients ?? [];
  const technicians = (users.data?.users ?? []).filter((entry) => entry.active);

  useEffect(() => {
    if (!open) return;
    setClientId(presetClientId ?? list[0]?.id ?? NEW_CLIENT);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setPostalCode('');
    setCity('');
    setBrand('');
    setModel('');
    setCategory('PHONE');
    setSerialNumber('');
    setIssue('');
    setDiagnosis('');
    setPriority('NORMAL');
    setEstimate('0');
    setTechnician(user ? '' : '');
    setTouched(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetClientId, clients.data, user?.id]);

  const creatingClient = clientId === NEW_CLIENT;

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (creatingClient && name.trim().length < 2) next.name = 'Indiquez le nom du client.';
    if (creatingClient && phone.trim().length < 6) next.phone = 'Un numéro joignable est requis.';
    if (brand.trim().length < 1) next.brand = 'Marque requise.';
    if (model.trim().length < 1) next.model = 'Modèle requis.';
    if (issue.trim().length < 5) next.issue = 'Décrivez la panne en quelques mots.';
    if (Number.isNaN(Number(estimate.replace(',', '.')))) next.estimate = 'Montant invalide.';
    return next;
  }, [creatingClient, name, phone, brand, model, issue, estimate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0) {
      toast('Complétez les champs signalés', 'error');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let targetId = clientId;
      if (creatingClient) {
        const created = await api.createClient({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
        });
        targetId = created.client.id;
      }

      const created = await api.createRepair({
        clientId: targetId,
        category,
        brand: brand.trim(),
        model: model.trim(),
        serialNumber: serialNumber.trim() || undefined,
        issue: issue.trim(),
        diagnosis: diagnosis.trim() || undefined,
        estimateCents: Math.round((Number(estimate.replace(',', '.')) || 0) * 100),
        priority,
        assignedToId: technician || undefined,
      });

      toast(`Dossier ${created.repair.reference} créé`);
      clients.reload();
      onCreated?.();
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
      title="Nouvelle réparation"
      description="Appareil, panne et client : le dossier est enregistré en base immédiatement."
      width={660}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="new-repair"
            icon="plus"
            disabled={busy}
          >
            {busy ? 'Création…' : 'Créer le dossier'}
          </Button>
        </>
      }
    >
      <form id="new-repair" className="form" onSubmit={submit} noValidate>
        <div className="form__row">
          <Field label="Client" htmlFor="repair-client">
            <Select
              id="repair-client"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              {list.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                  {client.city ? ` — ${client.city}` : ''}
                </option>
              ))}
              <option value={NEW_CLIENT}>+ Nouveau client…</option>
            </Select>
          </Field>
          {user?.role === 'ADMIN' && (
            <Field label="Technicien" htmlFor="repair-tech">
              <Select
                id="repair-tech"
                value={technician}
                onChange={(event) => setTechnician(event.target.value)}
              >
                <option value="">Non affecté</option>
                {technicians.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {creatingClient && (
          <div className="form__group">
            <div className="form__row">
              <Field
                label="Nom du client"
                htmlFor="repair-name"
                error={touched ? errors.name : undefined}
              >
                <TextInput
                  id="repair-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Prénom et nom"
                  autoComplete="name"
                />
              </Field>
              <Field
                label="Téléphone"
                htmlFor="repair-phone"
                error={touched ? errors.phone : undefined}
              >
                <TextInput
                  id="repair-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="06 00 00 00 00"
                  inputMode="tel"
                />
              </Field>
            </div>
            <div className="form__row">
              <Field label="E-mail" htmlFor="repair-email" hint="Facultatif">
                <TextInput
                  id="repair-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="client@mail.fr"
                  autoComplete="email"
                />
              </Field>
              <Field label="Ville" htmlFor="repair-city" hint="Facultatif">
                <TextInput
                  id="repair-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Lyon"
                />
              </Field>
            </div>
            <Field label="Adresse postale" htmlFor="repair-address" hint="Facultatif">
              <TextInput
                id="repair-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="12 rue des Artisans"
              />
            </Field>
          </div>
        )}

        <div className="form__row">
          <Field label="Marque" htmlFor="repair-brand" error={touched ? errors.brand : undefined}>
            <TextInput
              id="repair-brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Apple, Samsung, Dell…"
            />
          </Field>
          <Field label="Modèle" htmlFor="repair-model" error={touched ? errors.model : undefined}>
            <TextInput
              id="repair-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="iPhone 14 Pro"
            />
          </Field>
        </div>

        <div className="form__row">
          <Field label="Catégorie" htmlFor="repair-category">
            <Select
              id="repair-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as DeviceCategory)}
            >
              {Object.entries(CATEGORY_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="N° de série" htmlFor="repair-serial" hint="Facultatif">
            <TextInput
              id="repair-serial"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="SN…"
            />
          </Field>
        </div>

        <Field
          label="Panne signalée"
          htmlFor="repair-issue"
          error={touched ? errors.issue : undefined}
        >
          <TextArea
            id="repair-issue"
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
            placeholder="Ex. écran fissuré après une chute, tactile partiel en bas à droite."
            rows={3}
          />
        </Field>

        <Field label="Diagnostic initial" htmlFor="repair-diagnosis" hint="Facultatif à la réception">
          <TextArea
            id="repair-diagnosis"
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            rows={2}
            placeholder="Premier constat technique…"
          />
        </Field>

        <div className="form__row">
          <Field label="Priorité" htmlFor="repair-priority">
            <Segmented
              layoutId="priority-pill"
              label="Priorité"
              value={priority}
              onChange={setPriority}
              options={[
                { value: 'LOW', label: 'Basse' },
                { value: 'NORMAL', label: 'Normale' },
                { value: 'URGENT', label: 'Urgente' },
              ]}
            />
          </Field>
          <Field
            label="Montant estimé (€)"
            htmlFor="repair-estimate"
            error={touched ? errors.estimate : undefined}
            hint="Modifiable ensuite dans le dossier."
          >
            <TextInput
              id="repair-estimate"
              type="number"
              min="0"
              step="0.01"
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              inputMode="decimal"
            />
          </Field>
        </div>

        {error && <p className="form__error">{error}</p>}
      </form>
    </Modal>
  );
}
