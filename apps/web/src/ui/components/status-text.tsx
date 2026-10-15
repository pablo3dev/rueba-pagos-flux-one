import type { StatusKind } from '../../domain/transfer-status';
import { useLocale } from '../../i18n/locale-context';
import type { MessageKey } from '../../i18n/messages';

const KIND_KEY: Record<StatusKind, MessageKey> = {
  completed: 'statusCompleted',
  reversed: 'statusReversed',
  confirming: 'statusConfirming',
  failedFunds: 'statusFailedFunds',
  failedRail: 'statusFailedRail',
  failedUnavailable: 'statusFailedUnavailable',
  failedOther: 'statusFailedOther',
};

const KIND_CLASS: Record<StatusKind, string> = {
  completed: 'status-success',
  reversed: 'status-info',
  confirming: 'status-warning',
  failedFunds: 'status-danger',
  failedRail: 'status-danger',
  failedUnavailable: 'status-danger',
  failedOther: 'status-danger',
};

const KIND_MARK: Record<StatusKind, string> = {
  completed: '✓',
  reversed: '↺',
  confirming: '…',
  failedFunds: '!',
  failedRail: '!',
  failedUnavailable: '!',
  failedOther: '!',
};

export function StatusText({ kind }: { kind: StatusKind }) {
  const { t } = useLocale();
  return (
    <span className={`status ${KIND_CLASS[kind]}`}>
      <span className="status-mark" aria-hidden="true">
        {KIND_MARK[kind]}
      </span>
      {t(KIND_KEY[kind])}
    </span>
  );
}
