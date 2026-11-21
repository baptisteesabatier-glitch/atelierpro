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
import {
  CATEGORY_META,
  useStore,
  technicians,
  type DeviceCategory,
  type Priority,
} from '../lib/store';
import { toast } from './Toaster';

const NEW_CLIENT = '__new__';

export default function NewRepairDialog({
  open,
  onClose,
  presetClientId,
}: {
  open: boolean;
  onClose: () => void;
  presetClientId?: string;
}) {
  const { clients, addClient, addRepair, settings } = useStore();

  const [clientId, setClientId] = useState(presetClientId ?? clients[0]?.id ?? NEW_CLIENT);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [device, setDevice] = useState('');
  const [category, setCategory] = useState<DeviceCategory>('phone');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [estimate, setEstimate] = useState('120');
  const [technician, setTechnician] = useState(settings.technician || technicians[0]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(presetClientId ?? clients[0]?.id ?? NEW_CLIENT);
    setName('');
    setPhone('');
    setEmail('');
    setCity('');
    setDevice('');
    setCategory('phone');
    setIssue('');
    setPriority('normal');
    setEstimate('120');
    setTechnician(settings.technician || technicians[0]);
    setTouched(false);
  }, [open, presetClientId, clients, settings.technician]);

  const creatingClient = clientId === NEW_CLIENT;

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (creatingClient && name.trim().length < 2) next.name = 'Indiquez le nom du client.';
    if (creatingClient && phone.trim().length < 6) next.phone = 'Un numéro joignable est requis.';
    if (device.trim().length < 2) next.device = 'Précisez l’appareil (modèle).';
    if (issue.trim().length < 5) next.issue = 'Décrivez la panne en quelques mots.';
    if (Number.isNaN(Number(estimate)) || Number(estimate) < 0) {
      next.estimate = 'Montant invalide.';
    }
    return next;
  }, [creatingClient, name, phone, device, issue, estimate]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0) {
      toast('Complétez les champs signalés', 'error');
      return;
    }

    let targetId = clientId;
    if (creatingClient) {
      const created = addClient({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || '—',
      });
      targetId = created.id;
    }

    const repair = addRepair({
      clientId: targetId,
      device: device.trim(),
      category,
      issue: issue.trim(),
      priority,
      estimate: Number(estimate),
      technician,
    });

    toast(`Dossier ${repair.ref} créé`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle réparation"
      description="Un dossier clair dès la réception : appareil, panne, devis."
      width={620}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="new-repair" icon="plus">
            Créer le dossier
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
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} — {client.city}
                </option>
              ))}
              <option value={NEW_CLIENT}>+ Nouveau client…</option>
            </Select>
          </Field>
          <Field label="Technicien" htmlFor="repair-tech">
            <Select
              id="repair-tech"
              value={technician}
              onChange={(event) => setTechnician(event.target.value)}
            >
              {technicians.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </Select>
          </Field>
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
          </div>
        )}

        <div className="form__row">
          <Field
            label="Appareil"
            htmlFor="repair-device"
            error={touched ? errors.device : undefined}
          >
            <TextInput
              id="repair-device"
              value={device}
              onChange={(event) => setDevice(event.target.value)}
              placeholder="iPhone 14 Pro, MacBook Air…"
            />
          </Field>
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

        <div className="form__row">
          <Field label="Priorité" htmlFor="repair-priority">
            <Segmented
              layoutId="priority-pill"
              label="Priorité"
              value={priority}
              onChange={setPriority}
              options={[
                { value: 'low', label: 'Basse' },
                { value: 'normal', label: 'Normale' },
                { value: 'urgent', label: 'Urgente' },
              ]}
            />
          </Field>
          <Field
            label="Devis (€)"
            htmlFor="repair-estimate"
            error={touched ? errors.estimate : undefined}
            hint="Montant estimé, modifiable ensuite."
          >
            <TextInput
              id="repair-estimate"
              type="number"
              min="0"
              step="1"
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              inputMode="decimal"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
