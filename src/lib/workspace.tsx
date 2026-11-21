import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api, type Settings } from './api';
import { useApi } from './hooks';
import { useAuth } from './auth';

interface WorkspaceValue {
  settings: Settings | null;
  counts: { active: number; clients: number; ready: number; urgent: number } | null;
  loading: boolean;
  reload: () => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/** Identité de l'atelier et compteurs partagés par la barre latérale. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const settings = useApi(() => api.settings(), [user?.id]);
  const summary = useApi(() => api.dashboard(), [user?.id]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      settings: settings.data?.settings ?? null,
      counts: summary.data
        ? {
            active: summary.data.counts.active,
            clients: summary.data.counts.clients,
            ready: summary.data.counts.ready,
            urgent: summary.data.counts.urgent,
          }
        : null,
      loading: settings.loading || summary.loading,
      reload: () => {
        settings.reload();
        summary.reload();
      },
    }),
    [settings, summary],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace doit être utilisé dans <WorkspaceProvider>');
  return context;
}
