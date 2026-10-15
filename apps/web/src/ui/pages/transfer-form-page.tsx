import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage, isApiError } from '../../api/api-error';
import { useAppServices } from '../../app/app-services-context';
import { formatCop } from '../../domain/format';
import {
  createIdempotencyKey,
  intentAfterResult,
  intentForSubmit,
  isRetryableFailure,
  type TransferIntent,
} from '../../domain/idempotency';
import type { FieldErrorCode, TransferDraft } from '../../domain/types';
import { transferPayload, validateTransfer } from '../../domain/validation';
import { useLocale } from '../../i18n/locale-context';
import { FormField } from '../components/form-field';
import { QueryState } from '../components/query-state';
import { useSingleSubmit } from '../use-single-submit';

const EMPTY: TransferDraft = {
  type: 'INTERNAL',
  fromAccountId: '',
  toAccountId: '',
  toExternalAccount: '',
  amount: '',
};

export function TransferFormPage() {
  const { t, locale } = useLocale();
  const { payments } = useAppServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pending, run } = useSingleSubmit();
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => payments.listAccounts() });
  const [draft, setDraft] = useState<TransferDraft>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, FieldErrorCode>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [serverField, setServerField] = useState<{ id: string; message: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const intent = useRef<TransferIntent | null>(null);

  const patch = (partial: Partial<TransferDraft>) => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateTransfer(draft);
    setFieldErrors(errors);
    setFormError(null);
    setServerField(null);
    setUncertain(false);
    if (Object.keys(errors).length > 0) {
      const id = ['fromAccountId', 'toAccountId', 'toExternalAccount', 'amount'].find(
        (key) => errors[key],
      );
      if (id) document.getElementById(id)?.focus();
      return;
    }
    const payload = transferPayload(draft);
    const next = intentForSubmit(intent.current, payload, createIdempotencyKey);
    intent.current = next;
    void run(async () => {
      try {
        const transfer = await payments.createTransfer({
          payload: next.payload,
          idempotencyKey: next.key,
        });
        intent.current = intentAfterResult(next, 'effect');
        await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        await queryClient.invalidateQueries({ queryKey: ['transfers'] });
        await navigate(`/transfers/${transfer.id}`);
      } catch (error) {
        const retryable = isApiError(error) ? isRetryableFailure(error.status, error.code) : true;
        intent.current = intentAfterResult(next, retryable ? 'retryable' : 'rotate');
        const message = errorMessage(error);
        const fieldId = draft.type === 'EXTERNAL' ? 'toExternalAccount' : 'toAccountId';
        if (
          isApiError(error) &&
          (error.code === 'DESTINATION_NOT_FOUND' || error.code === 'SAME_ACCOUNT')
        ) {
          setServerField({ id: fieldId, message });
          setFormError(null);
        } else {
          setFormError(message);
        }
        setUncertain(
          retryable && (!isApiError(error) || error.code !== 'IDEMPOTENCY_KEY_IN_PROGRESS'),
        );
        if (isApiError(error) && error.code === 'ACCOUNT_NOT_FOUND') {
          await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        }
      }
    });
  };

  return (
    <>
      <h1>{t('transferTitle')}</h1>
      <QueryState
        isPending={accounts.isPending}
        isError={accounts.isError}
        error={accounts.error}
        onRetry={() => void accounts.refetch()}
      >
        {accounts.data && accounts.data.length === 0 ? (
          <p>{t('cannotTransfer')}</p>
        ) : (
          <form noValidate onSubmit={onSubmit}>
            <fieldset>
              <legend>{t('transferType')}</legend>
              <label className="choice">
                <input
                  type="radio"
                  name="transfer-type"
                  checked={draft.type === 'INTERNAL'}
                  onChange={() => patch({ type: 'INTERNAL' })}
                />
                {t('typeInternal')}
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="transfer-type"
                  checked={draft.type === 'EXTERNAL'}
                  onChange={() => patch({ type: 'EXTERNAL' })}
                />
                {t('typeExternal')}
              </label>
            </fieldset>
            <div className="field">
              <label htmlFor="fromAccountId">{t('originAccount')}</label>
              <select
                id="fromAccountId"
                value={draft.fromAccountId}
                aria-invalid={fieldErrors.fromAccountId ? true : undefined}
                aria-describedby={fieldErrors.fromAccountId ? 'fromAccountId-error' : undefined}
                onChange={(event) => patch({ fromAccountId: event.target.value })}
              >
                <option value="">{t('selectAccount')}</option>
                {accounts.data?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.id} · {formatCop(account.balance, locale)}
                  </option>
                ))}
              </select>
              {fieldErrors.fromAccountId ? (
                <p id="fromAccountId-error" className="field-error" role="alert">
                  {t(fieldErrors.fromAccountId)}
                </p>
              ) : null}
            </div>
            {draft.type === 'INTERNAL' ? (
              <FormField
                id="toAccountId"
                label={t('destinationAccount')}
                value={draft.toAccountId}
                error={
                  serverField?.id === 'toAccountId'
                    ? serverField.message
                    : fieldErrors.toAccountId
                      ? t(fieldErrors.toAccountId)
                      : undefined
                }
                onChange={(value) => patch({ toAccountId: value })}
              />
            ) : (
              <FormField
                id="toExternalAccount"
                label={t('externalAccount')}
                autoComplete="off"
                value={draft.toExternalAccount}
                error={
                  serverField?.id === 'toExternalAccount'
                    ? serverField.message
                    : fieldErrors.toExternalAccount
                      ? t(fieldErrors.toExternalAccount)
                      : undefined
                }
                onChange={(value) => patch({ toExternalAccount: value.toUpperCase() })}
              />
            )}
            <FormField
              id="amount"
              label={t('amountLabel')}
              inputMode="decimal"
              autoComplete="off"
              value={draft.amount}
              error={fieldErrors.amount ? t(fieldErrors.amount) : undefined}
              onChange={(value) => patch({ amount: value })}
            />
            {formError ? <p role="alert">{formError}</p> : null}
            {uncertain ? <p role="status">{t('uncertain')}</p> : null}
            <button type="submit" disabled={pending}>
              {pending ? t('transferPending') : t('transferSubmit')}
            </button>
          </form>
        )}
      </QueryState>
    </>
  );
}
