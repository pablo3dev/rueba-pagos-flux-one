import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '../../app/app-services-context';
import { LoadingScreen } from './loading-screen';

export function PublicOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'loading') return <LoadingScreen />;
  if (session.status === 'authenticated') return <Navigate to="/" replace />;
  return children;
}
