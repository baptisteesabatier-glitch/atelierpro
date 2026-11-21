/**
 * AtelierPro — modèle de données et magasin local.
 *
 * Tout est persisté dans le navigateur (localStorage) : aucune dépendance
 * à un service payant, aucun compte requis pour utiliser l'application.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

export type RepairStatus =
  | 'intake'
  | 'diagnostic'
  | 'parts'
  | 'repair'
  | 'ready'
  | 'delivered';

export type Priority = 'low' | 'normal' | 'urgent';

export type DeviceCategory = 'phone' | 'laptop' | 'tablet' | 'console' | 'other';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  since: string;
}

export interface Note {
  id: string;
  at: string;
  text: string;
}

export interface Repair {
  id: string;
  ref: string;
  clientId: string;
  device: string;
  category: DeviceCategory;
  issue: string;
  status: RepairStatus;
  priority: Priority;
  estimate: number;
  technician: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  notes: Note[];
}

export interface Settings {
  shopName: string;
  technician: string;
  monthlyGoal: number;
}

export interface AppState {
  clients: Client[];
  repairs: Repair[];
  settings: Settings;
}

export const STATUS_FLOW: RepairStatus[] = [
  'intake',
  'diagnostic',
  'parts',
  'repair',
  'ready',
  'delivered',
];

export const STATUS_META: Record<
  RepairStatus,
  { label: string; short: string; tone: string }
> = {
  intake: { label: 'Réception', short: 'Reçu', tone: 'slate' },
  diagnostic: { label: 'Diagnostic', short: 'Diag', tone: 'indigo' },
  parts: { label: 'Pièces en attente', short: 'Pièces', tone: 'amber' },
  repair: { label: 'En réparation', short: 'Atelier', tone: 'accent' },
  ready: { label: 'Prête à retirer', short: 'Prête', tone: 'green' },
  delivered: { label: 'Livrée', short: 'Livrée', tone: 'muted' },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  low: { label: 'Basse', tone: 'muted' },
  normal: { label: 'Normale', tone: 'slate' },
  urgent: { label: 'Urgente', tone: 'rose' },
};

export const CATEGORY_META: Record<DeviceCategory, { label: string; icon: string }> = {
  phone: { label: 'Téléphone', icon: 'phone' },
  laptop: { label: 'Ordinateur', icon: 'laptop' },
  tablet: { label: 'Tablette', icon: 'tablet' },
  console: { label: 'Console', icon: 'console' },
  other: { label: 'Autre', icon: 'chip' },
};

const STORAGE_KEY = 'atelierpro.state.v1';
const TECHNICIANS = ['Sofiane', 'Inès', 'Karim'];

function iso(daysAgo: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 24, 0, 0);
  return d.toISOString();
}

/** Aucun horodatage de démonstration ne doit se situer dans le futur. */
function clamp(value: string): string {
  return new Date(value).getTime() > Date.now() ? new Date().toISOString() : value;
}

export function createSeed(): AppState {
  const clients: Client[] = [
    {
      id: 'c1',
      name: 'Camille Aubert',
      email: 'camille.aubert@mail.fr',
      phone: '06 12 44 87 21',
      city: 'Lyon 6e',
      since: '2021-03-12',
    },
    {
      id: 'c2',
      name: 'Yanis Berrada',
      email: 'y.berrada@mail.fr',
      phone: '07 61 09 33 58',
      city: 'Villeurbanne',
      since: '2022-09-04',
    },
    {
      id: 'c3',
      name: 'Léa Fontaine',
      email: 'lea.fontaine@mail.fr',
      phone: '06 88 27 41 06',
      city: 'Lyon 3e',
      since: '2020-11-23',
    },
    {
      id: 'c4',
      name: 'Marc Delvaux',
      email: 'marc.delvaux@mail.fr',
      phone: '06 45 71 90 12',
      city: 'Caluire',
      since: '2023-01-19',
    },
    {
      id: 'c5',
      name: 'Sofia Ricci',
      email: 'sofia.ricci@mail.fr',
      phone: '07 12 65 80 44',
      city: 'Lyon 7e',
      since: '2019-06-02',
    },
    {
      id: 'c6',
      name: 'Hugo Marchand',
      email: 'hugo.marchand@mail.fr',
      phone: '06 33 12 77 05',
      city: 'Bron',
      since: '2022-02-27',
    },
    {
      id: 'c7',
      name: 'Nadia Belkacem',
      email: 'nadia.belkacem@mail.fr',
      phone: '07 84 20 61 39',
      city: 'Lyon 8e',
      since: '2024-04-08',
    },
    {
      id: 'c8',
      name: 'Thomas Pichon',
      email: 't.pichon@mail.fr',
      phone: '06 07 54 28 63',
      city: 'Écully',
      since: '2021-10-15',
    },
    {
      id: 'c9',
      name: 'Emma Leclerc',
      email: 'emma.leclerc@mail.fr',
      phone: '07 55 91 03 27',
      city: 'Lyon 2e',
      since: '2023-08-30',
    },
  ];

  const base = (
    n: number,
    ref: string,
    clientId: string,
    device: string,
    category: DeviceCategory,
    issue: string,
    status: RepairStatus,
    priority: Priority,
    estimate: number,
    technician: string,
    createdDaysAgo: number,
    hour: number,
    deliveredDaysAgo?: number,
    notes: string[] = [],
  ): Repair => ({
    id: `r${n}`,
    ref,
    clientId,
    device,
    category,
    issue,
    status,
    priority,
    estimate,
    technician,
    createdAt: clamp(iso(createdDaysAgo, hour)),
    updatedAt:
      deliveredDaysAgo !== undefined
        ? clamp(iso(deliveredDaysAgo, 15))
        : createdDaysAgo === 0
          ? clamp(iso(createdDaysAgo, hour))
          : clamp(iso(createdDaysAgo - 1, 15)),
    deliveredAt: deliveredDaysAgo === undefined ? undefined : clamp(iso(deliveredDaysAgo, 17)),
    notes: notes.map((text, i) => ({
      id: `n${n}-${i}`,
      at: iso(Math.max(createdDaysAgo - i - 1, 0), 11 + i),
      text,
    })),
  });

  const repairs: Repair[] = [
    base(17, 'AP-2041', 'c1', 'iPhone 14 Pro', 'phone', 'Écran fissuré après une chute', 'repair', 'normal', 189, 'Sofiane', 2, 9, undefined, ['Écran OLED commandé, pièce d’origine.']),
    base(16, 'AP-2040', 'c2', 'MacBook Air M1', 'laptop', 'Batterie ne tient plus la charge', 'diagnostic', 'urgent', 129, 'Inès', 1, 11),
    base(15, 'AP-2039', 'c3', 'iPad Air 5', 'tablet', 'Connecteur de charge capricieux', 'parts', 'normal', 95, 'Karim', 4, 14, undefined, ['Connecteur USB-C en rupture chez le fournisseur.']),
    base(14, 'AP-2038', 'c4', 'PlayStation 5 Slim', 'console', 'Surchauffe et extinction en jeu', 'intake', 'normal', 110, 'Sofiane', 0, 9),
    base(13, 'AP-2037', 'c5', 'Galaxy S23', 'phone', 'Vitre arrière cassée', 'ready', 'low', 79, 'Inès', 3, 10),
    base(12, 'AP-2036', 'c6', 'Dell XPS 13', 'laptop', 'Clavier : plusieurs touches mortes', 'repair', 'normal', 145, 'Karim', 5, 16, undefined, ['Clavier de remplacement reçu ce matin.']),
    base(11, 'AP-2035', 'c7', 'iPhone 13 mini', 'phone', 'Face ID inopérant', 'diagnostic', 'normal', 159, 'Sofiane', 1, 15),
    base(10, 'AP-2034', 'c8', 'Surface Pro 9', 'tablet', 'Écran tactile fantôme', 'parts', 'urgent', 210, 'Inès', 6, 9),
    base(9, 'AP-2033', 'c9', 'Pixel 8', 'phone', 'Caméra principale floue', 'ready', 'normal', 89, 'Karim', 4, 13),
    base(8, 'AP-2032', 'c1', 'AirPods Pro 2', 'other', 'Boîtier ne charge plus', 'delivered', 'low', 45, 'Inès', 9, 10, 6),
    base(7, 'AP-2031', 'c3', 'MacBook Pro 14', 'laptop', 'Écran : bandes verticales', 'repair', 'urgent', 389, 'Sofiane', 3, 12, undefined, ['Diagnostic confirmé : nappe écran. Devis accepté.']),
    base(6, 'AP-2030', 'c5', 'Switch OLED', 'console', 'Joy-Con drift côté gauche', 'delivered', 'normal', 65, 'Karim', 12, 11, 9),
    base(5, 'AP-2029', 'c2', 'iPhone 12', 'phone', 'Changement de batterie', 'delivered', 'normal', 69, 'Inès', 14, 15, 11),
    base(4, 'AP-2028', 'c6', 'Apple Watch Series 8', 'other', 'Vitre avant fissurée', 'delivered', 'normal', 119, 'Sofiane', 16, 9, 12),
    base(3, 'AP-2027', 'c4', 'HP Spectre x360', 'laptop', 'Windows ne démarre plus', 'delivered', 'normal', 99, 'Karim', 19, 14, 15),
    base(2, 'AP-2026', 'c8', 'Galaxy Tab S9', 'tablet', 'Nettoyage complet + pâte thermique', 'delivered', 'low', 55, 'Inès', 21, 10, 18),
    base(1, 'AP-2025', 'c9', 'iPhone 15', 'phone', 'Changement de vitre arrière', 'delivered', 'normal', 99, 'Sofiane', 24, 11, 20),
  ];

  return {
    clients,
    repairs,
    settings: { shopName: 'Atelier Nord', technician: 'Sofiane', monthlyGoal: 1500 },
  };
}

type Action =
  | { type: 'add-repair'; repair: Repair }
  | { type: 'set-status'; id: string; status: RepairStatus }
  | { type: 'add-note'; id: string; text: string }
  | { type: 'add-client'; client: Client }
  | { type: 'update-settings'; settings: Partial<Settings> }
  | { type: 'reset' };

function now(): string {
  return new Date().toISOString();
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'add-repair':
      return { ...state, repairs: [action.repair, ...state.repairs] };
    case 'set-status':
      return {
        ...state,
        repairs: state.repairs.map((r) =>
          r.id === action.id
            ? {
                ...r,
                status: action.status,
                updatedAt: now(),
                deliveredAt:
                  action.status === 'delivered' ? (r.deliveredAt ?? now()) : undefined,
              }
            : r,
        ),
      };
    case 'add-note':
      return {
        ...state,
        repairs: state.repairs.map((r) =>
          r.id === action.id
            ? {
                ...r,
                updatedAt: now(),
                notes: [
                  ...r.notes,
                  { id: crypto.randomUUID(), at: now(), text: action.text },
                ],
              }
            : r,
        ),
      };
    case 'add-client':
      return { ...state, clients: [...state.clients, action.client] };
    case 'update-settings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'reset':
      return createSeed();
    default:
      return state;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeed();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.repairs)) {
      return createSeed();
    }
    return {
      clients: parsed.clients,
      repairs: parsed.repairs,
      settings: {
        shopName: parsed.settings?.shopName ?? 'Atelier Nord',
        technician: parsed.settings?.technician ?? 'Sofiane',
        monthlyGoal: parsed.settings?.monthlyGoal ?? 1500,
      },
    };
  } catch {
    return createSeed();
  }
}

interface StoreValue extends AppState {
  nextRef: () => string;
  addRepair: (input: NewRepairInput) => Repair;
  setStatus: (id: string, status: RepairStatus) => void;
  addNote: (id: string, text: string) => void;
  addClient: (input: NewClientInput) => Client;
  updateSettings: (settings: Partial<Settings>) => void;
  reset: () => void;
  clientOf: (id: string) => Client | undefined;
}

export interface NewRepairInput {
  clientId: string;
  device: string;
  category: DeviceCategory;
  issue: string;
  priority: Priority;
  estimate: number;
  technician: string;
}

export interface NewClientInput {
  name: string;
  email: string;
  phone: string;
  city: string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota dépassé : on garde l'état en mémoire */
    }
  }, [state]);

  const nextRef = useCallback(() => {
    const max = state.repairs.reduce((acc, r) => {
      const n = Number.parseInt(r.ref.replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? acc : Math.max(acc, n);
    }, 2000);
    return `AP-${max + 1}`;
  }, [state.repairs]);

  const addRepair = useCallback(
    (input: NewRepairInput) => {
      const repair: Repair = {
        id: crypto.randomUUID(),
        ref: nextRef(),
        ...input,
        status: 'intake',
        createdAt: now(),
        updatedAt: now(),
        notes: [],
      };
      dispatch({ type: 'add-repair', repair });
      return repair;
    },
    [nextRef],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      nextRef,
      addRepair,
      setStatus: (id, status) => dispatch({ type: 'set-status', id, status }),
      addNote: (id, text) => dispatch({ type: 'add-note', id, text }),
      addClient: (input) => {
        const client: Client = {
          id: crypto.randomUUID(),
          ...input,
          since: new Date().toISOString().slice(0, 10),
        };
        dispatch({ type: 'add-client', client });
        return client;
      },
      updateSettings: (settings) => dispatch({ type: 'update-settings', settings }),
      reset: () => dispatch({ type: 'reset' }),
      clientOf: (id) => state.clients.find((c) => c.id === id),
    }),
    [state, nextRef, addRepair],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return ctx;
}

/** Techniciens proposés dans les formulaires. */
export const technicians = TECHNICIANS;
