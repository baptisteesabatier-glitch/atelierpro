import { useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { Avatar, IconButton } from './ui';
import { useStore } from '../lib/store';
import { fullDate } from '../lib/format';

const TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Tableau de bord', sub: 'Vue d’ensemble de l’atelier' },
  '/reparations': { title: 'Réparations', sub: 'Suivi des interventions' },
  '/clients': { title: 'Clients', sub: 'Répertoire et historique' },
  '/parametres': { title: 'Paramètres', sub: 'Identité et données' },
};

export default function TopBar({
  onOpenNav,
  onOpenSearch,
}: {
  onOpenNav: () => void;
  onOpenSearch: () => void;
}) {
  const location = useLocation();
  const { settings } = useStore();
  const meta = TITLES[location.pathname] ?? TITLES['/'];
  const today = fullDate(new Date().toISOString());

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__lead">
          <IconButton
            label="Ouvrir la navigation"
            icon="menu"
            className="topbar__menu"
            onClick={onOpenNav}
          />
          <div className="topbar__titles">
            <p className="topbar__eyebrow">{settings.shopName}</p>
            <h1 className="topbar__title">{meta.title}</h1>
          </div>
        </div>

        <button type="button" className="search-trigger" onClick={onOpenSearch}>
          <Icon name="search" size={16} />
          <span className="search-trigger__text">Rechercher une réparation, un client…</span>
          <span className="search-trigger__kbd" aria-hidden="true">
            ⌘K
          </span>
        </button>

        <div className="topbar__trail">
          <span className="topbar__date">{today}</span>
          <IconButton label="Notifications" icon="bell" className="topbar__bell" />
          <Avatar name={settings.technician} size="sm" />
        </div>
      </div>
    </header>
  );
}
