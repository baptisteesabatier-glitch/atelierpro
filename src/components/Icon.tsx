import type { ReactNode, SVGProps } from 'react';

/** Jeu d'icônes maison, tracé au trait — aucune dépendance externe. */
export type IconName =
  | 'grid'
  | 'wrench'
  | 'users'
  | 'settings'
  | 'search'
  | 'plus'
  | 'close'
  | 'chevronRight'
  | 'chevronDown'
  | 'menu'
  | 'phone'
  | 'laptop'
  | 'tablet'
  | 'console'
  | 'chip'
  | 'bell'
  | 'arrowUpRight'
  | 'check'
  | 'clock'
  | 'euro'
  | 'sparkle'
  | 'note'
  | 'send'
  | 'command'
  | 'calendar'
  | 'trash';

const PATHS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.7 6.3a4.5 4.5 0 0 0 5.9 5.9l-1.8 6.1a2 2 0 0 1-2.6 1.3L3.5 15.4a2 2 0 0 1-1.2-2.6l2-5.2a2 2 0 0 1 2.7-1.1l3 1.4" />
      <circle cx="8.6" cy="15.2" r="1.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.2 5.2a3.4 3.4 0 0 1 0 6.6M18 20a5.9 5.9 0 0 0-2.2-4.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4.2 4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  menu: <path d="M3.5 7h17M3.5 12h17M3.5 17h11" />,
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="5" width="15" height="10" rx="2" />
      <path d="M2.5 18.5h19" />
    </>
  ),
  tablet: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.6" />
      <path d="M11 18h2" />
    </>
  ),
  console: (
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="4" />
      <path d="M7 10.5v3M5.5 12h3M16 11.5h.01M18 13.5h.01" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2.4" />
      <path d="M11 3v2M13 3v2M11 19v2M13 19v2M3 11h2M3 13h2M19 11h2M19 13h2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 4.2-1.6 5.5-1.6 5.5h15.2S18 12.7 18 8.5" />
      <path d="M10.2 18a2 2 0 0 0 3.6 0" />
    </>
  ),
  arrowUpRight: <path d="M7 17 17 7M8.5 7H17v8.5" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  euro: <path d="M17 6.2A6.5 6.5 0 0 0 7 11m10 6.8A6.5 6.5 0 0 1 7 13M4 10.5h8M4 13.5h7" />,
  sparkle: <path d="M12 3.5l1.9 4.9 4.9 1.9-4.9 1.9L12 17.1l-1.9-4.9L5.2 10.3l4.9-1.9z" />,
  note: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h4" />
    </>
  ),
  send: <path d="M20.5 3.5 3.8 10.2l6.2 2.3 2.3 6.2zM20.5 3.5l-9.4 10.3" />,
  command: <path d="M8.5 3.5A2.5 2.5 0 1 0 8.5 8.5h7a2.5 2.5 0 1 0 0-5v0a2.5 2.5 0 0 0-2.5 2.5v9a2.5 2.5 0 1 0 2.5-2.5h-7a2.5 2.5 0 1 0 0 5v0a2.5 2.5 0 0 0 2.5-2.5v-9" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </>
  ),
  trash: <path d="M4 7h16M9.5 4h5M6.5 7l.9 12.2A2 2 0 0 0 9.4 21h5.2a2 2 0 0 0 2-1.8L17.5 7M10 11v6M14 11v6" />,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
