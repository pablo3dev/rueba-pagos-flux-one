import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAppServices } from '../../app/app-services-context';
import { formatCop } from '../../domain/format';
import { useLocale } from '../../i18n/locale-context';
import { QueryState } from '../components/query-state';

export function AccountsPage() {
  const { t, locale } = useLocale();
  const { payments } = useAppServices();
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => payments.listAccounts() });
  const hasAccounts = (accounts.data?.length ?? 0) > 0;

  return (
    <>
      <h1>{t('accountsTitle')}</h1>
      <p className="actions">
        {hasAccounts ? (
          <Link className="button" to="/transfers/new">
            {t('newTransfer')}
          </Link>
        ) : (
          <span className="button is-disabled" aria-disabled="true">
            {t('newTransfer')}
          </span>
        )}
        <Link className="button button-secondary" to="/transfers">
          {t('history')}
        </Link>
      </p>
      <QueryState
        isPending={accounts.isPending}
        isError={accounts.isError}
        error={accounts.error}
        onRetry={() => void accounts.refetch()}
      >
        {accounts.data && accounts.data.length === 0 ? (
          <div className="panel">
            <p>{t('noAccounts')}</p>
            <p>{t('cannotTransfer')}</p>
          </div>
        ) : (
          <table>
            <caption>{t('accountsTitle')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('account')}</th>
                <th scope="col">{t('currency')}</th>
                <th scope="col">{t('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data?.map((account) => (
                <tr key={account.id}>
                  <td>{account.id}</td>
                  <td>{account.currency}</td>
                  <td>{formatCop(account.balance, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryState>
    </>
  );
}
