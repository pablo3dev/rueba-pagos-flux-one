import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './app/app-providers';
import { createAppServices } from './app/create-app-services';
import { LocaleProvider } from './i18n/locale';
import { ThemeProvider } from './theme/theme';
import { appRoutes } from './routes';
import './styles.css';

const services = createAppServices();
const router = createBrowserRouter(appRoutes);
const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing');

createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <ThemeProvider>
        <AppProviders services={services}>
          <RouterProvider router={router} />
        </AppProviders>
      </ThemeProvider>
    </LocaleProvider>
  </StrictMode>,
);
