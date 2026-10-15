import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { errorMessage } from '../../api/api-error';
import { useAppServices, useSession } from '../../app/app-services-context';
import { useLocale } from '../../i18n/locale-context';
import { Preferences } from '../components/preferences';
import { useSingleSubmit } from '../use-single-submit';

export function PortalFrame() {
  const { t } = useLocale();
  const { auth } = useAppServices();
  const session = useSession();
  const { pending, run } = useSingleSubmit();
  const profile = useQuery({ queryKey: ['me'], queryFn: () => auth.getProfile() });
  const email = profile.data?.email ?? session.user?.email ?? '';

  return (
    <div className="portal">
      <a className="skip" href="#content">
        {t('skipToContent')}
      </a>
      <header className="topbar">
        <p className="brand">{t('appName')}</p>
        <p>{t('sessionAs', { email })}</p>
        {profile.isError ? <p role="alert">{errorMessage(profile.error)}</p> : null}
        <nav aria-label={t('navLabel')}>
          <NavLink to="/" end>
            {t('accountsLink')}
          </NavLink>
          <NavLink to="/transfers/new">{t('newTransfer')}</NavLink>
          <NavLink to="/transfers">{t('history')}</NavLink>
        </nav>
        <Preferences />
        <button type="button" disabled={pending} onClick={() => void run(() => auth.logout())}>
          {pending ? t('logoutPending') : t('logout')}
        </button>
      </header>
      <main id="content" className="sheet">
        <Outlet />
      </main>
    </div>
  );
}
