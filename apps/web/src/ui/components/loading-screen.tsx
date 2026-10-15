import { useLocale } from '../../i18n/locale-context';

export function LoadingScreen() {
  const { t } = useLocale();
  return (
    <p className="loading" role="status">
      {t('loading')}
    </p>
  );
}
