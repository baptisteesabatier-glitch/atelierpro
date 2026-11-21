import { useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { Avatar, IconButton } from './ui';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/workspace';
import { fullDate } from '../lib/format';

const TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Tableau de bord', sub: 'Vue d’ensemble de l’atelier' },
  '/reparations': { title: 'Réparations', sub: 'Suivi des interventions' },
  '/clients': { title: 'Clients', sub: 'Répertoire et historique' },
  '/utilisateurs': { title: 'Utilisateurs', sub: 'Comptes et permissions' },
  '/parametres': { title: 'Paramètres', sub: 'Identité, sécurité et données' },
};

export default function TopBar({
  onOpenNav,
  onOpenSearch,
}: {
  onOpenNav: () => void;
  onOpenSearch: () => void;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const { settings, counts } = useWorkspace();
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
            <p className="topbar__eyebrow">{settings?.companyName ?? 'AtelierPro'}</p>
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
          {typeof counts?.urgent === 'number' && counts.urgent > 0 && (
            <span className="topbar__alert" title={`${counts.urgent} dossiers urgents`}>
              <Icon name="bell" size={16} />
              {counts.urgent}
            </span>
          )}
          <Avatar name={user?.name ?? 'Compte'} size="sm" />
        </div>
      </div>
    </header>
  );
}
