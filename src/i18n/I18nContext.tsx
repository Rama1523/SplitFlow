/**
 * SplitFlow — Internationalization (i18n) React Context & Hook
 * Gestión reactiva de idioma en toda la aplicación, persistencia en localStorage,
 * traducción de claves con interpolación y formateo de moneda integrado.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, LanguageMeta, AVAILABLE_LANGUAGES } from './types';
import { TRANSLATIONS } from './translations';
import { formatCurrency, getCurrencyInfo, SUPPORTED_CURRENCIES } from '../lib/currencies';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatAmount: (amount: number, currencyCode?: string) => string;
  availableLanguages: LanguageMeta[];
  currentLanguageMeta: LanguageMeta;
}

const STORAGE_KEY = 'splitflow_language';

const I18nContext = createContext<I18nContextType | null>(null);

function detectInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Language;
    if (saved && AVAILABLE_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
    const browserLang = navigator.language.slice(0, 2).toLowerCase();
    if (AVAILABLE_LANGUAGES.some((l) => l.code === browserLang)) {
      return browserLang as Language;
    }
  } catch {
    // Ignore fallback
  }
  return 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore localStorage error
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const currentLanguageMeta = AVAILABLE_LANGUAGES.find((l) => l.code === language) || AVAILABLE_LANGUAGES[0];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS.es;
      let text = dict[key] || TRANSLATIONS.es[key] || TRANSLATIONS.en[key] || key;

      if (params) {
        Object.entries(params).forEach(([paramKey, val]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
        });
      }

      return text;
    },
    [language]
  );

  const formatAmount = useCallback(
    (amount: number, currencyCode = 'EUR'): string => {
      return formatCurrency(amount, currencyCode, currentLanguageMeta.locale);
    },
    [currentLanguageMeta.locale]
  );

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        formatAmount,
        availableLanguages: AVAILABLE_LANGUAGES,
        currentLanguageMeta,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export { SUPPORTED_CURRENCIES, getCurrencyInfo, formatCurrency };
