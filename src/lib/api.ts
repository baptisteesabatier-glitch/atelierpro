/**
 * Client de l'API AtelierPro 2.0.
 *
 * Toutes les mutations portent le jeton CSRF en double soumission
 * (cookie `ap_csrf` + en-tête `x-csrf-token`).
 */

export type Role = 'ADMIN' | 'TECHNICIAN';
export type Permissions = {
  canChangeStatus?: boolean;
  canEditRepairs?: boolean;
  canManageClients?: boolean;
  canCreateQuotes?: boolean;
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  permissions: Permissions;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export type RepairStatus =
  | 'NEW'
  | 'DIAGNOSIS'
  | 'QUOTE_SENT'
  | 'AWAITING_APPROVAL'
  | 'PART_ORDERED'
  | 'IN_PROGRESS'
  | 'REPAIRED'
  | 'READY'
  | 'RETURNED'
  | 'CANCELLED';

export type Priority = 'LOW' | 'NORMAL' | 'URGENT';
export type DeviceCategory = 'PHONE' | 'LAPTOP' | 'TABLET' | 'CONSOLE' | 'OTHER';
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  notes: string | null;
  createdAt: string;
  stats?: { repairs: number; active?: number; billedCents: number };
}

export interface QuoteItem {
  id: string;
  kind: 'LABOR' | 'PART' | 'SUPPLY';
  label: string;
  quantity: number;
  unitPriceCents: number;
  position: number;
}

export interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  vatRate: number;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  notes: string | null;
  issuedAt: string;
  validUntil: string;
  acceptedAt: string | null;
  items?: QuoteItem[];
  repair?: { id: string; reference: string; clientName: string; status: RepairStatus };
  itemsCount?: number;
}

export interface Repair {
  id: string;
  reference: string;
  status: RepairStatus;
  priority: Priority;
  category: DeviceCategory;
  brand: string;
  model: string;
  serialNumber: string | null;
  issue: string;
  diagnosis: string | null;
  estimateCents: number;
  paidAmountCents: number;
  paidAt: string | null;
  receivedAt: string;
  readyAt: string | null;
  returnedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  trackingToken: string;
  client: { id: string; name: string; phone: string; email: string | null; city: string | null };
  assignedTo: { id: string; name: string } | null;
  latestQuote: {
    id: string;
    number: string;
    status: QuoteStatus;
    totalCents: number;
    validUntil: string;
  } | null;
  counts: { notes: number; quotes: number };
  notes?: { id: string; body: string; createdAt: string; author: { id: string; name: string } | null }[];
  events?: {
    id: string;
    type: string;
    fromStatus: RepairStatus | null;
    toStatus: RepairStatus | null;
    message: string | null;
    createdAt: string;
    actor: { id: string; name: string } | null;
  }[];
  quotes?: Quote[];
}

export interface Settings {
  id: string;
  companyName: string;
  legalName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  siret: string;
  vatNumber: string;
  vatRate: number;
  logoDataUrl: string | null;
  quotePrefix: string;
  depositPrefix: string;
  returnPrefix: string;
  quoteValidityDays: number;
  footer: string;
  monthlyGoalCents: number;
  updatedAt: string;
}

export interface DashboardSummary {
  generatedAt: string;
  counts: {
    active: number;
    urgent: number;
    ready: number;
    awaitingQuotes: number;
    clients: number;
    users: number;
    returnedTotal: number;
  };
  revenue: {
    billedMonthCents: number;
    billedAllTimeCents: number;
    pendingCents: number;
    monthlyGoalCents: number;
    goalProgress: number;
  };
  avgRepairDays: number;
  series: { date: string; received: number; returned: number; paidCents: number }[];
  statuses: { status: RepairStatus; count: number }[];
  priorities: Repair[];
  recentEvents: {
    id: string;
    type: string;
    message: string | null;
    createdAt: string;
    actorName: string | null;
    repair: { id: string; reference: string; brand: string; model: string };
  }[];
  technicians: {
    id: string;
    name: string;
    active: number;
    completed: number;
    billedCents: number;
    pipelineCents: number;
  }[];
}

export interface Tracking {
  reference: string;
  status: RepairStatus;
  currentIndex: number;
  brand: string;
  model: string;
  receivedAt: string;
  readyAt: string | null;
  returnedAt: string | null;
  cancelledAt: string | null;
  isReady: boolean;
  steps: { status: RepairStatus; reached: boolean; at: string | null }[];
  shop: { name: string; phone: string; email: string; address: string };
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function csrfCookie(): string {
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('ap_csrf='));
  return entry ? decodeURIComponent(entry.slice('ap_csrf='.length)) : '';
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = csrfCookie();

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'Serveur injoignable. Vérifiez que l’API est démarrée.');
  }

  if (response.status === 204) return undefined as T;

  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(response.status, 'HTTP', `Erreur ${response.status}.`);
    }
    return (await response.blob()) as unknown as T;
  }

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      .error;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP',
      error?.message ?? `Erreur ${response.status}.`,
      error?.details,
    );
  }
  return payload as T;
}

export interface NewRepairInput {
  clientId: string;
  category: DeviceCategory;
  brand: string;
  model: string;
  serialNumber?: string;
  issue: string;
  diagnosis?: string;
  estimateCents: number;
  priority: Priority;
  assignedToId?: string | null;
}

export interface QuoteInput {
  repairId?: string;
  vatRate?: number;
  notes?: string;
  items: { kind: 'LABOR' | 'PART' | 'SUPPLY'; label: string; quantity: number; unitPriceCents: number }[];
}

export const api = {
  me: () => request<{ user: User | null; version: string }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: User; csrfToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/auth/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  users: () => request<{ users: User[] }>('/users'),
  createUser: (input: {
    email: string;
    name: string;
    password: string;
    role: Role;
    permissions?: Permissions;
  }) => request<{ user: User }>('/users', { method: 'POST', body: input }),
  updateUser: (
    id: string,
    input: {
      name?: string;
      role?: Role;
      active?: boolean;
      password?: string;
      permissions?: Permissions;
    },
  ) => request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: input }),

  clients: (q = '') =>
    request<{ clients: Client[] }>(`/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  client: (id: string) =>
    request<{ client: Client & { repairs: Repair[] } }>(`/clients/${id}`),
  createClient: (input: Partial<Client>) =>
    request<{ client: Client }>('/clients', { method: 'POST', body: input }),
  updateClient: (id: string, input: Partial<Client>) =>
    request<{ client: Client }>(`/clients/${id}`, { method: 'PATCH', body: input }),
  deleteClient: (id: string) => request<{ ok: true }>(`/clients/${id}`, { method: 'DELETE' }),

  repairs: (params: { status?: string; q?: string; sort?: string; priority?: string } = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const suffix = search.toString();
    return request<{ repairs: Repair[] }>(`/repairs${suffix ? `?${suffix}` : ''}`);
  },
  repair: (id: string) => request<{ repair: Repair }>(`/repairs/${id}`),
  createRepair: (input: NewRepairInput) =>
    request<{ repair: Repair }>('/repairs', { method: 'POST', body: input }),
  updateRepair: (id: string, input: Partial<NewRepairInput>) =>
    request<{ repair: Repair }>(`/repairs/${id}`, { method: 'PATCH', body: input }),
  setStatus: (id: string, status: RepairStatus, message?: string, force?: boolean) =>
    request<{ repair: Repair }>(`/repairs/${id}/status`, {
      method: 'PATCH',
      body: { status, message, force },
    }),
  addNote: (id: string, body: string) =>
    request<{ note: { id: string; body: string; createdAt: string } }>(
      `/repairs/${id}/notes`,
      { method: 'POST', body: { body } },
    ),
  setPayment: (id: string, paid: boolean, amountCents?: number) =>
    request<{ repair: Repair }>(`/repairs/${id}/payment`, {
      method: 'POST',
      body: { paid, amountCents },
    }),
  deleteRepair: (id: string) => request<{ ok: true }>(`/repairs/${id}`, { method: 'DELETE' }),

  quotes: () => request<{ quotes: Quote[] }>('/quotes'),
  createQuote: (input: QuoteInput) =>
    request<{ quote: Quote }>('/quotes', { method: 'POST', body: input }),
  updateQuote: (id: string, input: Omit<QuoteInput, 'repairId'>) =>
    request<{ quote: Quote }>(`/quotes/${id}`, { method: 'PATCH', body: input }),
  setQuoteStatus: (id: string, status: QuoteStatus) =>
    request<{ quote: Quote }>(`/quotes/${id}/status`, { method: 'POST', body: { status } }),
  deleteQuote: (id: string) => request<{ ok: true }>(`/quotes/${id}`, { method: 'DELETE' }),

  dashboard: () => request<DashboardSummary>('/dashboard/summary'),
  settings: () => request<{ settings: Settings }>('/settings'),
  updateSettings: (input: Partial<Settings>) =>
    request<{ settings: Settings }>('/settings', { method: 'PATCH', body: input }),

  exportBackup: () => request<Blob>('/backups/export'),
  importBackup: (file: unknown) =>
    request<{ ok: true; imported: Record<string, number> }>('/backups/import', {
      method: 'POST',
      body: file,
    }),

  track: (token: string) => request<{ tracking: Tracking }>(`/public/track/${token}`),
};

/** Télécharge un PDF protégé (session + cookies) puis l'ouvre. */
export async function openPdf(path: string): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!response.ok) throw new ApiError(response.status, 'PDF', 'Document indisponible.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
