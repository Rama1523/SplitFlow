/**
 * SplitFlow — CurrencySelector Component
 * Selector accesible (WCAG AAA) y categorizado de divisas:
 * - Euros (EUR)
 * - Pesos (Todos los tipos oficiales: ARS, CLP, COP, CUP, DOP, MXN, PHP, UYU)
 * - Libras (GBP, GIP, FKP, SHP)
 * - Dólares (USD, CAD, AUD, NZD, SGD, HKD)
 * Con targets táctiles >= 44x44px, navegación por teclado y contraste corporativo óptimo.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Coins } from 'lucide-react';
import { SUPPORTED_CURRENCIES, getCurrencyInfo, CurrencyCategory } from '../lib/currencies';
import { useI18n } from '../i18n/I18nContext';

interface CurrencySelectorProps {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  className?: string;
}

export function CurrencySelector({
  value,
  onChange,
  label,
  className = '',
}: CurrencySelectorProps) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CurrencyCategory | 'ALL'>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCurrency = getCurrencyInfo(value);

  // Cerrar al hacer clic fuera o pulsar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredCurrencies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return SUPPORTED_CURRENCIES.filter((c) => {
      const matchesCategory = selectedCategory === 'ALL' || c.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!term) return true;
      const name = (c.name[language] || c.name.es).toLowerCase();
      return (
        c.code.toLowerCase().includes(term) ||
        c.symbol.toLowerCase().includes(term) ||
        c.country.toLowerCase().includes(term) ||
        name.includes(term)
      );
    });
  }, [search, selectedCategory, language]);

  const CATEGORY_TABS: { id: CurrencyCategory | 'ALL'; label: Record<string, string> }[] = [
    { id: 'ALL', label: { es: 'Todas', en: 'All', fr: 'Toutes', de: 'Alle', it: 'Tutte', pt: 'Todas' } },
    { id: 'EUR', label: { es: 'Euros', en: 'Euros', fr: 'Euros', de: 'Euro', it: 'Euro', pt: 'Euros' } },
    { id: 'PESO', label: { es: 'Pesos', en: 'Pesos', fr: 'Pesos', de: 'Pesos', it: 'Pesos', pt: 'Pesos' } },
    { id: 'POUND', label: { es: 'Libras', en: 'Pounds', fr: 'Livres', de: 'Pfund', it: 'Sterline', pt: 'Libras' } },
    { id: 'DOLLAR', label: { es: 'Dólares', en: 'Dollars', fr: 'Dollars', de: 'Dollar', it: 'Dollari', pt: 'Dólares' } },
    { id: 'GLOBAL', label: { es: 'Globales', en: 'Global', fr: 'Mondiales', de: 'Global', it: 'Globali', pt: 'Globais' } },
  ];

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Coins className="w-4 h-4 stroke-[1.75px] text-slate-700 dark:text-slate-300" aria-hidden="true" />
          <span>{label}</span>
        </label>
      )}

      <div className="relative">
        {/* Botón Disparador con Target Táctil >= 44x44px */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Divisa seleccionada: ${selectedCurrency.code} ${selectedCurrency.name[language] || selectedCurrency.name.es}. Cambiar divisa.`}
          className="min-h-[44px] w-full flex items-center justify-between px-3.5 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white hover:border-slate-400 dark:hover:border-slate-600 transition cursor-pointer text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
        >
          <div className="flex items-center gap-3 truncate">
            <span className="w-8 h-6 rounded-sm bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono font-bold flex items-center justify-center text-xs shrink-0">
              {selectedCurrency.symbol}
            </span>
            <span className="font-mono font-bold text-slate-950 dark:text-white text-xs">
              {selectedCurrency.code}
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-xs truncate">
              · {selectedCurrency.name[language] || selectedCurrency.name.es}
            </span>
          </div>
          <ChevronDown 
            aria-hidden="true"
            className={`w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {isOpen && (
          <div 
            role="listbox"
            aria-label="Catálogo de divisas"
            className="absolute left-0 right-0 mt-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-3 space-y-3 animate-in fade-in duration-100"
          >
            {/* Buscador accesible con min-h-[44px] */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar por código, país o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar divisa por código, país o nombre"
                className="min-h-[44px] w-full pl-10 pr-3 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              />
            </div>

            {/* Categorías como Segmented Control con Targets Accesibles */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
              {CATEGORY_TABS.map((tab) => {
                const isActive = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label[language] || tab.label.es}
                  </button>
                );
              })}
            </div>

            {/* Lista con scroll y botones de al menos 44px de altura */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {filteredCurrencies.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No se encontraron divisas coincidentes.
                </div>
              ) : (
                filteredCurrencies.map((c) => {
                  const isSelected = c.code === value;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(c.code);
                        setIsOpen(false);
                      }}
                      className={`min-h-[44px] w-full flex items-center justify-between p-2.5 rounded-md text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-950 dark:text-white font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="w-8 h-6 rounded-sm bg-slate-200 dark:bg-slate-800 font-mono font-bold flex items-center justify-center text-xs text-slate-900 dark:text-slate-100 shrink-0">
                          {c.symbol}
                        </span>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-950 dark:text-white">
                              {c.code}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                              · {c.name[language] || c.name.es}
                            </span>
                          </div>
                          {c.country && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              {c.country}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-slate-900 dark:text-slate-100 stroke-[1.75px] shrink-0 ml-2" aria-hidden="true" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
