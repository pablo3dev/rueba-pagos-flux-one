import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AppServicesContext } from './app-services-context';
import type { AppServices } from './create-app-services';

export function AppProviders({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  useEffect(() => {
    void services.auth.restoreSession();
  }, [services]);

  return (
    <AppServicesContext.Provider value={services}>
      <QueryClientProvider client={services.queryClient}>{children}</QueryClientProvider>
    </AppServicesContext.Provider>
  );
}
