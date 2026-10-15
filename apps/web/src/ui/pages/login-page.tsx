import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { errorMessage, isApiError } from '../../api/api-error';
import { useAppServices, useSession } from '../../app/app-services-context';
import { validateLogin } from '../../domain/validation';
import type { FieldErrorCode } from '../../domain/types';
import { useLocale } from '../../i18n/locale-context';
import { FormField } from '../components/form-field';
import { Preferences } from '../components/preferences';
import { useSingleSubmit } from '../use-single-submit';

export function LoginPage() {
  const { t } = useLocale();
  const { auth, session } = useAppServices();
  const snapshot = useSession();
  const { pending, run } = useSingleSubmit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, FieldErrorCode>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const focusFirst = (errors: Partial<Record<string, FieldErrorCode>>) => {
    const id = ['email', 'password'].find((key) => errors[key]);
    if (id) document.getElementById(id)?.focus();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      focusFirst(errors);
      return;
    }
    session.setLoginNotice(null);
    void run(async () => {
      try {
        await auth.login({ email, password });
      } catch (error) {
        setFormError(errorMessage(error));
        if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') setPassword('');
      }
    });
  };

  return (
    <main className="sheet">
      <Preferences />
      <h1>{t('loginTitle')}</h1>
      {snapshot.loginNotice ? <p role="status">{snapshot.loginNotice}</p> : null}
      <form noValidate onSubmit={onSubmit}>
        <FormField
          id="email"
          label={t('emailLabel')}
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          error={fieldErrors.email ? t(fieldErrors.email) : undefined}
          onChange={setEmail}
        />
        <FormField
          id="password"
          label={t('passwordLabel')}
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password ? t(fieldErrors.password) : undefined}
          onChange={setPassword}
        />
        {formError ? <p role="alert">{formError}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? t('loginPending') : t('loginSubmit')}
        </button>
      </form>
      <p>
        <Link to="/register">{t('createAccount')}</Link>
      </p>
    </main>
  );
}
