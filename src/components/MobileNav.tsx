import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Aperçu', icon: 'grid' },
  { to: '/reparations', label: 'Réparations', icon: 'wrench' },
  { to: '/clients', label: 'Clients', icon: 'users' },
  { to: '/parametres', label: 'Réglages', icon: 'settings' },
];

export default function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Navigation mobile">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `mobile-nav__item${isActive ? ' is-active' : ''}`}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
