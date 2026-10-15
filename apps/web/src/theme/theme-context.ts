import { createContext, useContext } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

export const ThemeContext = createContext<{
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
} | null>(null);

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('Theme is missing');
  return value;
}
