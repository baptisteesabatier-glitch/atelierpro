import { useState } from 'react';
import { Button, Field, Modal, Progress, Select, TextInput } from '../components/ui';
import { Icon } from '../components/Icon';
import { technicians, useStore } from '../lib/store';
import { money } from '../lib/format';
import { toast } from '../components/Toaster';

export default function Settings() {
  const { settings, updateSettings, reset, repairs, clients } = useStore();
  const [shopName, setShopName] = useState(settings.shopName);
  const [technician, setTechnician] = useState(settings.technician);
  const [goal, setGoal] = useState(String(settings.monthlyGoal));
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty =
    shopName !== settings.shopName ||
    technician !== settings.technician ||
    Number(goal) !== settings.monthlyGoal;

  const save = () => {
    const monthlyGoal = Number(goal);
    if (!shopName.trim()) {
      toast('Le nom de l’atelier est requis', 'error');
      return;
    }
    updateSettings({
      shopName: shopName.trim(),
      technician,
      monthlyGoal: Number.isFinite(monthlyGoal) && monthlyGoal > 0 ? monthlyGoal : 1500,
    });
    toast('Paramètres enregistrés');
  };

  const exportData = () => {
    const payload = { exportedAt: new Date().toISOString(), settings, clients, repairs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atelierpro-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Sauvegarde JSON exportée');
  };

  const active = repairs.filter((repair) => repair.status !== 'delivered').length;
  const capacity = Math.min(100, Math.round((active / 24) * 100));

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div className="page__intro">
          <p className="eyebrow">Configuration</p>
          <h2 className="page__title">Paramètres</h2>
          <p className="page__lede">Identité de l’atelier, objectifs et portabilité des données.</p>
        </div>
      </header>

      <div className="layout-2 layout-2--settings">
        <section className="card">
          <header className="card__head">
            <div>
              <h3 className="card__title">Identité</h3>
              <p className="card__hint">Affichée dans la navigation et les dossiers</p>
            </div>
          </header>

          <div className="form">
            <Field label="Nom de l’atelier" htmlFor="settings-shop">
              <TextInput
                id="settings-shop"
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
              />
            </Field>
            <div className="form__row">
              <Field label="Technicien référent" htmlFor="settings-tech">
                <Select
                  id="settings-tech"
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
              <Field
                label="Objectif mensuel (€)"
                htmlFor="settings-goal"
                hint="Sert au calcul de la jauge du tableau de bord."
              >
                <TextInput
                  id="settings-goal"
                  type="number"
                  min="0"
                  step="100"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  inputMode="decimal"
                />
              </Field>
            </div>

            <div className="form__actions">
              <Button variant="primary" icon="check" onClick={save} disabled={!dirty}>
                Enregistrer
              </Button>
              {dirty && (
                <Button
                  variant="quiet"
                  onClick={() => {
                    setShopName(settings.shopName);
                    setTechnician(settings.technician);
                    setGoal(String(settings.monthlyGoal));
                  }}
                >
                  Rétablir
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <header className="card__head">
              <div>
                <h3 className="card__title">Occupation</h3>
                <p className="card__hint">Capacité atelier : 24 dossiers</p>
              </div>
              <span className="kpi__badge">{capacity} %</span>
            </header>
            <Progress value={capacity} />
            <p className="card__footnote">
              {active} dossiers ouverts · {money(
                repairs
                  .filter((repair) => repair.status !== 'delivered')
                  .reduce((sum, repair) => sum + repair.estimate, 0),
              )}{' '}
              de devis en cours
            </p>
          </section>

          <section className="card">
            <header className="card__head">
              <div>
                <h3 className="card__title">Données</h3>
                <p className="card__hint">Stockage local, sur cet appareil uniquement</p>
              </div>
            </header>
            <p className="card__text">
              AtelierPro ne dépend d’aucun service externe : {clients.length} clients et{' '}
              {repairs.length} dossiers sont conservés dans le navigateur. Exportez régulièrement
              une sauvegarde pour changer d’appareil.
            </p>
            <div className="card__actions">
              <Button variant="secondary" icon="arrowUpRight" onClick={exportData}>
                Exporter la sauvegarde
              </Button>
              <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
                Réinitialiser
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Réinitialiser les données ?"
        description="Tous les dossiers et clients créés seront remplacés par le jeu de démonstration. Action irréversible."
        width={480}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmReset(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                reset();
                setConfirmReset(false);
                toast('Données de démonstration restaurées', 'info');
              }}
            >
              Réinitialiser
            </Button>
          </>
        }
      >
        <div className="notice">
          <Icon name="clock" size={18} />
          <p>
            Pensez à exporter votre sauvegarde avant de réinitialiser si vous souhaitez conserver
            l’historique actuel.
          </p>
        </div>
      </Modal>
    </div>
  );
}
