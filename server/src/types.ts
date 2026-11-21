import type { PermissionKey } from './middleware';

export type Role = 'ADMIN' | 'TECHNICIAN';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  permissions: Partial<Record<PermissionKey, boolean>>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SafeUser;
      sessionId?: string;
    }
  }
}
