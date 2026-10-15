import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeChoice } from './theme-context';

const STORAGE_KEY = 'fluxone.theme';

function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Preference storage can be blocked.
  }
  return 'system';
}

function applyTheme(theme: ThemeChoice): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readTheme);
  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: ThemeChoice) => {
        setThemeState(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // The choice still applies to this page.
        }
      },
    }),
    [theme],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
