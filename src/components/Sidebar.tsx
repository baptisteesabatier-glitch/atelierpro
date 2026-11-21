import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from './Icon';
import { Avatar, IconButton, spring } from './ui';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/workspace';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: number;
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
          <path
            d="M7 22.5V13a9 9 0 0 1 18 0v9.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="M7 22.5h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="16" cy="17.4" r="2.1" fill="currentColor" />
        </svg>
      </span>
      <span className="brand__text">
        <strong className="brand__name">AtelierPro</strong>
        <span className="brand__tag">Gestion d’atelier</span>
      </span>
    </div>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <nav className="nav" aria-label="Navigation principale">
      <p className="nav__label">Espace de travail</p>
      {items.map((item) => {
        const active =
          item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`nav__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="nav__pill"
                transition={reduce ? { duration: 0 } : spring}
              />
            )}
            <span className="nav__icon">
              <Icon name={item.icon} size={18} />
            </span>
            <span className="nav__text">{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span className="nav__badge">{item.badge}</span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const { user, logout } = useAuth();
  const { settings, counts } = useWorkspace();

  return (
    <div className="sidebar__footer">
      <div className="capacity">
        <div className="capacity__head">
          <span className="capacity__label">Charge en cours</span>
          <span className="capacity__value">{counts?.active ?? 0} / 24</span>
        </div>
        <div className="capacity__track" aria-hidden="true">
          <span
            className="capacity__fill"
            style={{ width: `${Math.min(100, ((counts?.active ?? 0) / 24) * 100)}%` }}
          />
        </div>
      </div>

      <div className="user">
        <Avatar name={user?.name ?? 'Compte'} size="sm" />
        <span className="user__text">
          <span className="user__name">{user?.name}</span>
          <span className="user__role">
            {user?.role === 'ADMIN' ? 'Administrateur' : 'Technicien'} ·{' '}
            {settings?.companyName ?? 'Atelier'}
          </span>
        </span>
        <IconButton label="Se déconnecter" icon="arrowUpRight" size={16} onClick={() => void logout()} />
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { counts } = useWorkspace();
  const reduce = useReducedMotion();

  const items: NavItem[] = [
    { to: '/', label: 'Tableau de bord', icon: 'grid' },
    { to: '/reparations', label: 'Réparations', icon: 'wrench', badge: counts?.active },
    { to: '/clients', label: 'Clients', icon: 'users', badge: counts?.clients },
    ...(user?.role === 'ADMIN'
      ? [{ to: '/utilisateurs', label: 'Utilisateurs', icon: 'users' as IconName }]
      : []),
    { to: '/parametres', label: 'Paramètres', icon: 'settings' },
  ];

  return (
    <>
      <aside className="sidebar" aria-label="Barre latérale">
        <Brand />
        <NavList items={items} />
        <div className="sidebar__spacer" />
        <SidebarFooter />
      </aside>

      <AnimatePresence>
        {open && (
          <div className="overlay overlay--nav">
            <motion.div
              className="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />
            <motion.div
              className="sidebar sidebar--floating"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              drag={reduce ? false : 'x'}
              dragDirectionLock
              dragElastic={0.18}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80 || info.velocity.x < -480) onClose();
              }}
              initial={reduce ? { opacity: 0 } : { x: -32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { x: -40, opacity: 0 }}
              transition={reduce ? { duration: 0.16 } : spring}
            >
              <div className="sidebar__top">
                <Brand />
                <IconButton label="Fermer la navigation" icon="close" onClick={onClose} />
              </div>
              <NavList items={items} onNavigate={onClose} />
              <div className="sidebar__spacer" />
              <SidebarFooter />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
