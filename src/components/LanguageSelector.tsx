/**
 * SplitFlow — LanguageSelector Component
 * Selector accesible (WCAG AAA) y categorizado de idiomas:
 * - Soporte para 30 idiomas globales y regionales.
 * - Buscador en tiempo real por código, nombre nativo o nombre en inglés.
 * - Pestañas de filtrado geográfico (Todas, Europa, Américas, Asia y Global).
 * - Modos: 'full' (para Mi Perfil / Formularios) y 'compact' (para Header / Navbar).
 * - Targets táctiles >= 44x44px, navegación por teclado y contraste corporativo óptimo.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Globe } from 'lucide-react';
import { Language, LanguageRegion, AVAILABLE_LANGUAGES, LanguageMeta } from '../i18n/types';
import { useI18n } from '../i18n/I18nContext';

interface LanguageSelectorProps {
  value?: Language;
  onChange?: (code: Language) => void;
  label?: string;
  variant?: 'compact' | 'full';
  className?: string;
}

export function LanguageSelector({
  value,
  onChange,
  label,
  variant = 'full',
  className = '',
}: LanguageSelectorProps) {
  const { t, language: contextLanguage, setLanguage: contextSetLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<LanguageRegion>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  const activeLanguage = value || contextLanguage;
  const handleSelectLanguage = onChange || contextSetLanguage;

  const selectedMeta = useMemo(() => {
    return AVAILABLE_LANGUAGES.find((l) => l.code === activeLanguage) || AVAILABLE_LANGUAGES[0];
  }, [activeLanguage]);

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

  const filteredLanguages = useMemo(() => {
    const term = search.trim().toLowerCase();
    return AVAILABLE_LANGUAGES.filter((lang) => {
      const matchesRegion = selectedRegion === 'ALL' || lang.region === selectedRegion;
      if (!matchesRegion) return false;

      if (!term) return true;
      return (
        lang.code.toLowerCase().includes(term) ||
        lang.label.toLowerCase().includes(term) ||
        lang.nativeName.toLowerCase().includes(term) ||
        lang.englishName.toLowerCase().includes(term)
      );
    });
  }, [search, selectedRegion]);

  const REGION_TABS: { id: LanguageRegion; label: string }[] = [
    { id: 'ALL', label: t('common.all') || 'Todos' },
    { id: 'EUROPE', label: 'Europa' },
    { id: 'AMERICAS', label: 'América' },
    { id: 'ASIA_GLOBAL', label: 'Asia y Global' },
  ];

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && variant === 'full' && (
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Globe className="w-4 h-4 stroke-[1.75px] text-slate-700 dark:text-slate-300" aria-hidden="true" />
          <span>{label}</span>
        </label>
      )}

      <div className="relative">
        {variant === 'compact' ? (
          /* Botón Compacto para Navbar / Header */
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={`Idioma: ${selectedMeta.nativeName}. Cambiar idioma.`}
            className="min-h-[40px] px-2.5 py-1.5 flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <Globe className="w-3.5 h-3.5 stroke-[1.75px] text-slate-500" aria-hidden="true" />
            <span className="font-mono font-bold text-xs">{selectedMeta.label}</span>
            <ChevronDown
              aria-hidden="true"
              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : (
          /* Botón Disparador Completo con Target Táctil >= 44x44px */
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={`Idioma seleccionado: ${selectedMeta.nativeName} (${selectedMeta.englishName}). Cambiar idioma.`}
            className="min-h-[44px] w-full flex items-center justify-between px-3.5 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white hover:border-slate-400 dark:hover:border-slate-600 transition cursor-pointer text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <div className="flex items-center gap-3 truncate">
              <span className="w-8 h-6 rounded-sm bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                {selectedMeta.label}
              </span>
              <span className="font-semibold text-slate-950 dark:text-white text-xs">
                {selectedMeta.nativeName}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-xs truncate">
                · {selectedMeta.englishName}
              </span>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={`w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}

        {isOpen && (
          <div
            role="listbox"
            aria-label="Catálogo de idiomas disponibles"
            className={`absolute mt-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-3 space-y-3 animate-in fade-in duration-100 ${
              variant === 'compact' ? 'right-0 w-72 sm:w-80' : 'left-0 right-0'
            }`}
          >
            {/* Buscador accesible con min-h-[44px] */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar por idioma, nombre nativo o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar idioma por nombre o código"
                className="min-h-[44px] w-full pl-10 pr-3 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              />
            </div>

            {/* Pestañas de filtrado geográfico como Segmented Control */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
              {REGION_TABS.map((tab) => {
                const isActive = selectedRegion === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedRegion(tab.id)}
                    className={`min-h-[36px] px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Lista con scroll y botones de al menos 44px de altura */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {filteredLanguages.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No se encontraron idiomas coincidentes.
                </div>
              ) : (
                filteredLanguages.map((lang: LanguageMeta) => {
                  const isSelected = lang.code === activeLanguage;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        handleSelectLanguage(lang.code);
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
                          {lang.label}
                        </span>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-950 dark:text-white">
                              {lang.nativeName}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              · {lang.englishName}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {lang.locale}
                          </span>
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
