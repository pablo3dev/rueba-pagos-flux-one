import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { errorMessage, isApiError } from '../../api/api-error';
import { useAppServices } from '../../app/app-services-context';
import { formatCop, formatTimestamp } from '../../domain/format';
import { createIdempotencyKey, isRetryableFailure } from '../../domain/idempotency';
import { canReverse, needsLiveStatus, transferStatusKind } from '../../domain/transfer-status';
import { useLocale } from '../../i18n/locale-context';
import type { MessageKey } from '../../i18n/messages';
import { QueryState } from '../components/query-state';
import { StatusText } from '../components/status-text';
import { useSingleSubmit } from '../use-single-submit';

const EVENT_KEYS: Record<string, MessageKey> = {
  'transfer.created': 'eventCreated',
  'transfer.completed': 'eventCompleted',
  'transfer.failed': 'eventFailed',
  'transfer.unknown': 'eventUnknown',
  'transfer.reversal_requested': 'eventReversalRequested',
  'transfer.reversed': 'eventReversed',
  'transfer.reversal_rejected': 'eventReversalRejected',
};

export function TransferDetailPage() {
  const { id = '' } = useParams();
  const { t, locale } = useLocale();
  const { payments, audit } = useAppServices();
  const queryClient = useQueryClient();
  const { pending, run } = useSingleSubmit();
  const [paused, setPaused] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const reversalKey = useRef<string | null>(null);

  const transfer = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => payments.getTransfer(id),
    refetchInterval: (query) => {
      if (paused || !query.state.data) return false;
      return needsLiveStatus(query.state.data) ? 1000 : false;
    },
  });

  const events = useQuery({
    queryKey: ['audit', id],
    queryFn: () => audit.listEvents(id),
    enabled: transfer.isSuccess,
    refetchInterval: paused ? false : 2000,
  });

  const missing =
    isApiError(transfer.error) &&
    (transfer.error.code === 'TRANSFER_NOT_FOUND' || transfer.error.status === 404);

  const reverse = () => {
    reversalKey.current ??= createIdempotencyKey();
    const key = reversalKey.current;
    setFormError(null);
    setUncertain(false);
    void run(async () => {
      try {
        await payments.reverseTransfer(id, key);
        reversalKey.current = null;
        await queryClient.invalidateQueries({ queryKey: ['transfer', id] });
        await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        await queryClient.invalidateQueries({ queryKey: ['transfers'] });
        await queryClient.invalidateQueries({ queryKey: ['audit', id] });
      } catch (error) {
        const retryable = isApiError(error) ? isRetryableFailure(error.status, error.code) : true;
        if (!retryable) reversalKey.current = null;
        setFormError(errorMessage(error));
        setUncertain(
          retryable && (!isApiError(error) || error.code !== 'IDEMPOTENCY_KEY_IN_PROGRESS'),
        );
      }
    });
  };

  return (
    <>
      <h1>{t('resultTitle')}</h1>
      <p className="actions">
        <Link to="/">{t('accountsLink')}</Link>
        <Link to="/transfers/new">{t('newTransfer')}</Link>
        <Link to="/transfers">{t('history')}</Link>
      </p>
      {missing ? (
        <div className="panel">
          <p role="alert">{t('transferNotFound')}</p>
          <Link to="/transfers">{t('history')}</Link>
        </div>
      ) : (
        <QueryState
          isPending={transfer.isPending}
          isError={transfer.isError}
          error={transfer.error}
          onRetry={() => void transfer.refetch()}
        >
          {transfer.data ? (
            <>
              <p role="status">
                <StatusText kind={transferStatusKind(transfer.data)} />
              </p>
              <button type="button" onClick={() => setPaused((current) => !current)}>
                {paused ? t('resumeUpdates') : t('pauseUpdates')}
              </button>
              {paused ? <p role="status">{t('updatesPaused')}</p> : null}
              <dl className="facts">
                <div>
                  <dt>{t('identifier')}</dt>
                  <dd>{transfer.data.id}</dd>
                </div>
                <div>
                  <dt>{t('transferType')}</dt>
                  <dd>
                    {transfer.data.type === 'EXTERNAL' ? t('typeExternal') : t('typeInternal')}
                  </dd>
                </div>
                <div>
                  <dt>{t('fromAccount')}</dt>
                  <dd>{transfer.data.fromAccountId}</dd>
                </div>
                <div>
                  <dt>{t('toAccount')}</dt>
                  <dd>{transfer.data.toExternalAccount || transfer.data.toAccountId}</dd>
                </div>
                <div>
                  <dt>{t('amountLabel')}</dt>
                  <dd>{formatCop(transfer.data.amount, locale)}</dd>
                </div>
                <div>
                  <dt>{t('createdAt')}</dt>
                  <dd>{formatTimestamp(transfer.data.createdAt, locale)}</dd>
                </div>
              </dl>
              {transfer.data.reversal ? (
                <section aria-labelledby="reversal-heading">
                  <h2 id="reversal-heading">{t('reversalTitle')}</h2>
                  <p>
                    {transfer.data.reversal.status === 'COMPLETED'
                      ? t('reversalCompleted')
                      : transfer.data.reversal.status === 'REJECTED'
                        ? t('reversalRejected')
                        : transfer.data.reversal.status === 'UNKNOWN'
                          ? t('reversalConfirming')
                          : t('reversalPending')}
                  </p>
                </section>
              ) : null}
              {canReverse(transfer.data) ? (
                <button type="button" disabled={pending} onClick={reverse}>
                  {pending ? t('reversePending') : t('reverse')}
                </button>
              ) : null}
              {formError ? <p role="alert">{formError}</p> : null}
              {uncertain ? <p role="status">{t('reversalUncertain')}</p> : null}
              <section aria-labelledby="audit-heading">
                <h2 id="audit-heading">{t('auditTitle')}</h2>
                {events.isPending ? <p role="status">{t('loading')}</p> : null}
                {events.isError ? (
                  <div className="panel">
                    <p role="alert">{errorMessage(events.error)}</p>
                    <button type="button" onClick={() => void events.refetch()}>
                      {t('retry')}
                    </button>
                  </div>
                ) : null}
                {events.isSuccess && events.data.length === 0 ? <p>{t('auditEmpty')}</p> : null}
                {events.data && events.data.length > 0 ? (
                  <ol className="timeline">
                    {events.data.map((event) => (
                      <li key={event.eventId}>
                        <p>
                          {EVENT_KEYS[event.eventType]
                            ? t(EVENT_KEYS[event.eventType])
                            : event.eventType}
                        </p>
                        <p>
                          <time dateTime={event.occurredAt}>
                            {formatTimestamp(event.occurredAt, locale)}
                          </time>
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            </>
          ) : null}
        </QueryState>
      )}
    </>
  );
}
