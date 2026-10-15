import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { errorMessage } from '../../api/api-error';
import { useAppServices } from '../../app/app-services-context';
import { formatCop, formatTimestamp } from '../../domain/format';
import { transferDirection, transferStatusKind } from '../../domain/transfer-status';
import { useLocale } from '../../i18n/locale-context';
import { QueryState } from '../components/query-state';
import { StatusText } from '../components/status-text';

export function HistoryPage() {
  const { t, locale } = useLocale();
  const { payments } = useAppServices();
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => payments.listAccounts() });
  const history = useInfiniteQuery({
    queryKey: ['transfers'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => payments.listTransfers(pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const ownIds = new Set(accounts.data?.map((account) => account.id) ?? []);
  const hasAccounts = (accounts.data?.length ?? 0) > 0;

  return (
    <>
      <h1>{t('historyTitle')}</h1>
      <QueryState
        isPending={history.isPending}
        isError={history.isError && items.length === 0}
        error={history.error}
        onRetry={() => void history.refetch()}
      >
        {items.length === 0 ? (
          <div className="panel">
            <p>{t('historyEmpty')}</p>
            {hasAccounts ? <Link to="/transfers/new">{t('newTransfer')}</Link> : null}
          </div>
        ) : (
          <table>
            <caption>{t('historyTitle')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('createdAt')}</th>
                <th scope="col">{t('transferType')}</th>
                <th scope="col">{t('fromAccount')}</th>
                <th scope="col">{t('toAccount')}</th>
                <th scope="col">{t('amountLabel')}</th>
                <th scope="col">{t('resultTitle')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((transfer) => (
                <tr key={transfer.id}>
                  <td>{formatTimestamp(transfer.createdAt, locale)}</td>
                  <td>
                    {accounts.isSuccess
                      ? t(transferDirection(transfer.fromAccountId, ownIds))
                      : t('loading')}
                  </td>
                  <td>{transfer.fromAccountId}</td>
                  <td>{transfer.toExternalAccount || transfer.toAccountId}</td>
                  <td>{formatCop(transfer.amount, locale)}</td>
                  <td>
                    <Link to={`/transfers/${transfer.id}`}>
                      <StatusText kind={transferStatusKind(transfer)} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {history.isFetchNextPageError ? (
          <div className="panel">
            <p role="alert">{errorMessage(history.error)}</p>
            <button type="button" onClick={() => void history.fetchNextPage()}>
              {t('retry')}
            </button>
          </div>
        ) : null}
        {history.hasNextPage ? (
          <button
            type="button"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
          </button>
        ) : null}
      </QueryState>
    </>
  );
}
