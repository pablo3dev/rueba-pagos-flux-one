import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage } from '../../api/api-error';
import { useAppServices } from '../../app/app-services-context';
import type { FieldErrorCode } from '../../domain/types';
import { validateRegistration } from '../../domain/validation';
import { useLocale } from '../../i18n/locale-context';
import { FormField } from '../components/form-field';
import { Preferences } from '../components/preferences';
import { useSingleSubmit } from '../use-single-submit';

export function RegisterPage() {
  const { t } = useLocale();
  const { auth, session } = useAppServices();
  const navigate = useNavigate();
  const { pending, run } = useSingleSubmit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, FieldErrorCode>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateRegistration({ email, password });
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      const id = ['email', 'password'].find((key) => errors[key]);
      if (id) document.getElementById(id)?.focus();
      return;
    }
    void run(async () => {
      try {
        await auth.register({ email, password });
        session.setLoginNotice(t('accountCreated'));
        await navigate('/login');
      } catch (error) {
        setFormError(errorMessage(error));
      }
    });
  };

  return (
    <main className="sheet">
      <Preferences />
      <h1>{t('registerTitle')}</h1>
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
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password ? t(fieldErrors.password) : undefined}
          onChange={setPassword}
        />
        {formError ? <p role="alert">{formError}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? t('registerPending') : t('registerSubmit')}
        </button>
      </form>
      <p>
        <Link to="/login">{t('alreadyHaveAccount')}</Link>
      </p>
    </main>
  );
}
