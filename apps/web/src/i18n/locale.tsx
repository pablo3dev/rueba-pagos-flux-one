import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { catalogs, type Locale } from './messages';
import { LocaleContext, type LocaleContextValue } from './locale-context';

const STORAGE_KEY = 'fluxone.locale';

function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // Preference storage can be blocked; fall through to the system language.
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale);

  const value = useMemo<LocaleContextValue>(() => {
    const setLocale = (next: Locale) => {
      setLocaleState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage failures; the choice still applies to this page.
      }
    };
    return {
      locale,
      setLocale,
      t: (key, vars) => {
        let text: string = catalogs[locale][key];
        if (vars) {
          for (const [name, replacement] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, replacement);
          }
        }
        return text;
      },
    };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
