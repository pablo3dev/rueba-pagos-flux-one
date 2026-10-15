import { useLocale } from '../../i18n/locale-context';
import { useTheme, type ThemeChoice } from '../../theme/theme-context';

export function Preferences() {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  return (
    <div className="preferences" role="group" aria-label={t('preferences')}>
      <label>
        {t('language')}
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value === 'en' ? 'en' : 'es')}
        >
          <option value="es">{t('languageEs')}</option>
          <option value="en">{t('languageEn')}</option>
        </select>
      </label>
      <label>
        {t('theme')}
        <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeChoice)}>
          <option value="system">{t('themeSystem')}</option>
          <option value="light">{t('themeLight')}</option>
          <option value="dark">{t('themeDark')}</option>
        </select>
      </label>
    </div>
  );
}
