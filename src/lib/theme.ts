/**
 * SplitFlow — Theme Management (Modo Oscuro & Modo Claro)
 * Control de tema accesible y limpio con sincronización en localStorage y documentElement.
 */

import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  
  const saved = localStorage.getItem('splitflow_theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  
  // Si no hay guardado, comprobar preferencia del sistema o usar 'dark'
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    localStorage.setItem('splitflow_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' };
}
