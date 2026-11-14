/**
 * SplitFlow — UserNavDropdown Component
 * Menú desplegable corporativo y accesible (WCAG AAA).
 * Integra selector de idioma, acciones rápidas para móvil (tema, exportar) y perfil.
 * Targets táctiles >= 44x44px, foco visible, z-index z-40, scroll interno (overflow-y-auto) y padding inferior.
 */

import { useState, useRef, useEffect } from 'react';
import { 
  User as UserIcon, 
  LogOut, 
  ChevronDown, 
  Mail, 
  Smartphone,
  Sun,
  Moon,
  Share2,
  Check,
  Flag
} from 'lucide-react';
import { User } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface UserNavDropdownProps {
  currentUser: User;
  currency?: string;
  incomeModuleEnabled?: boolean;
  unreadRequestsCount?: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenExport?: () => void;
  onOpenProfile: () => void;
  onOpenReports?: () => void;
  onOpenRequests: () => void;
  onOpenDownloadApk?: () => void;
  onLogout: () => void;
}

export function UserNavDropdown({
  currentUser,
  currency = 'EUR',
  incomeModuleEnabled = false,
  unreadRequestsCount = 0,
  theme,
  onToggleTheme,
  onOpenExport,
  onOpenProfile,
  onOpenReports,
  onOpenRequests,
  onOpenDownloadApk,
  onLogout,
}: UserNavDropdownProps) {
  const { t, formatAmount } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de Perfil con Target Táctil >= 44x44px */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${currentUser.name} — ${t('nav.profile')}`}
        className="min-h-[44px] min-w-[44px] relative flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer shadow-xs focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 focus-visible:outline-none"
      >
        <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono font-bold flex items-center justify-center text-xs shrink-0">
          {(currentUser.username || currentUser.name).slice(0, 2).toUpperCase()}
        </div>
        
        <span className="text-xs font-semibold font-mono text-slate-900 dark:text-slate-100 hidden md:inline truncate max-w-[130px]">
          @{currentUser.username || currentUser.name.split(' ')[0]}
        </span>

        {/* Indicador de solicitudes pendientes */}
        {unreadRequestsCount > 0 && (
          <>
            <span 
              className="hidden md:inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-amber-800 text-white dark:bg-amber-700 tracking-wide"
              title={`${unreadRequestsCount} ${t('requests.tabReceived').toLowerCase()}`}
            >
              {t('requests.newBadge')}
            </span>
            <span 
              className="md:hidden absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-700 dark:bg-amber-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-mono font-bold text-white"
              aria-label={`${unreadRequestsCount} ${t('requests.tabReceived')}`}
            />
          </>
        )}

        <ChevronDown 
          aria-hidden="true"
          className={`w-4 h-4 text-slate-500 dark:text-slate-400 hidden sm:inline-block shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Menú Flotante Responsivo con Scroll Interno, z-40 y Padding Inferior */}
      {isOpen && (
        <div 
          role="menu"
          aria-label={t('nav.profile')}
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-40 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden"
        >
          {/* Cabecera del usuario */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
              {(currentUser.username || currentUser.name).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold font-mono text-slate-950 dark:text-white truncate">
                @{currentUser.username || currentUser.name}
              </p>
              {currentUser.name && currentUser.username && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {currentUser.name}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
              {incomeModuleEnabled && currentUser.monthlyIncome && currentUser.monthlyIncome > 0 ? (
                <div className="mt-1">
                  <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {formatAmount(currentUser.monthlyIncome, currency)}/m
                  </span>
                </div>
              ) : null}
            </div>
          </div>


          {/* Acciones Móviles Rápidas (Modo Oscuro & Exportar) */}
          <div className="md:hidden px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-100/50 dark:bg-slate-950/60 shrink-0">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
                className="min-h-[44px] flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500 stroke-[1.75px]" aria-hidden="true" />
                    <span>{t('common.lightMode')}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-700 stroke-[1.75px]" aria-hidden="true" />
                    <span>{t('common.darkMode')}</span>
                  </>
                )}
              </button>
            )}

            {onOpenExport && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenExport();
                }}
                aria-label={t('nav.export')}
                className="min-h-[44px] flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
              >
                <Share2 className="w-4 h-4 text-slate-800 dark:text-slate-200 stroke-[1.75px]" aria-hidden="true" />
                <span>{t('nav.export')}</span>
              </button>
            )}
          </div>

          {/* Cuerpo con Scroll Interno y Padding Inferior pb-4 para no cortar contenido */}
          <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-14rem)] pb-4">
            {/* 1. Mi Perfil */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
              className="min-h-[44px] w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            >
              <UserIcon className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px] shrink-0" aria-hidden="true" />
              <span>{t('nav.profile')}</span>
            </button>

            {/* 1b. Reportes */}
            {onOpenReports && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenReports();
                }}
                className="min-h-[44px] w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <Flag className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span>{t('nav.reports')}</span>
              </button>
            )}

            {/* 2. Sección Solicitudes */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenRequests();
              }}
              className="min-h-[44px] w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span>{t('nav.requests')}</span>
              </div>
              {unreadRequestsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-amber-800 text-white dark:bg-amber-700">
                  {t('requests.newBadge')} ({unreadRequestsCount})
                </span>
              )}
            </button>

            {/* 3. Descargar APK Android */}
            {onOpenDownloadApk && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenDownloadApk();
                }}
                className="min-h-[44px] w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px] shrink-0" aria-hidden="true" />
                  <span>Descargar App (.APK)</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  Android
                </span>
              </button>
            )}

            {/* Separador */}
            <div className="border-t border-slate-200 dark:border-slate-800 my-1" />

            {/* 4. Cerrar Sesión */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="min-h-[44px] w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-700"
            >
              <LogOut className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
