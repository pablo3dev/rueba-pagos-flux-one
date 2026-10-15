import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';
import { PublicOnly } from './ui/components/public-only';
import { RequireSession } from './ui/components/require-session';
import { AccountsPage } from './ui/pages/accounts-page';
import { HistoryPage } from './ui/pages/history-page';
import { LoginPage } from './ui/pages/login-page';
import { PortalFrame } from './ui/pages/portal-frame';
import { RegisterPage } from './ui/pages/register-page';
import { TransferDetailPage } from './ui/pages/transfer-detail-page';
import { TransferFormPage } from './ui/pages/transfer-form-page';

export const appRoutes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnly>
        <RegisterPage />
      </PublicOnly>
    ),
  },
  {
    path: '/',
    element: (
      <RequireSession>
        <PortalFrame />
      </RequireSession>
    ),
    children: [
      { index: true, element: <AccountsPage /> },
      { path: 'transfers/new', element: <TransferFormPage /> },
      { path: 'transfers/:id', element: <TransferDetailPage /> },
      { path: 'transfers', element: <HistoryPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
