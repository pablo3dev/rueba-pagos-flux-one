import { useSyncExternalStore } from 'react';
import { createContext, useContext } from 'react';
import type { SessionSnapshot } from '../session/session-store';
import type { AppServices } from './create-app-services';

export const AppServicesContext = createContext<AppServices | null>(null);

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('App services are missing');
  return services;
}

export function useSession(): SessionSnapshot {
  const { session } = useAppServices();
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
