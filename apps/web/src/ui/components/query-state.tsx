import type { ReactNode } from 'react';
import { errorMessage } from '../../api/api-error';
import { useLocale } from '../../i18n/locale-context';
import { LoadingScreen } from './loading-screen';

export function QueryState({
  isPending,
  isError,
  error,
  onRetry,
  children,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { t } = useLocale();
  if (isPending) return <LoadingScreen />;
  if (isError) {
    return (
      <div className="panel">
        <p role="alert">{errorMessage(error)}</p>
        <button type="button" onClick={onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  }
  return children;
}
