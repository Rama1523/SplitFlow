/**
 * SplitFlow — GroupSettingsDropdown Component
 * Menú de ajustes del grupo accesible (WCAG AAA) con icono de engranaje.
 * Totalmente internacionalizado con soporte para los 30 idiomas.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Users,
  UserPlus,
  Crown,
  LogOut,
  Trash2,
  ChevronDown,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

interface GroupSettingsDropdownProps {
  groupName: string;
  isSupremeAdmin: boolean;
  isAdmin: boolean;
  memberCount: number;
  inviteCode?: string;
  onOpenMembers: () => void;
  onOpenInvite: () => void;
  onOpenTransferAdmin: () => void;
  onOpenLeaveGroup: () => void;
  onOpenDeleteGroup?: () => void;
}

export function GroupSettingsDropdown({
  groupName,
  isSupremeAdmin,
  isAdmin,
  memberCount,
  inviteCode,
  onOpenMembers,
  onOpenInvite,
  onOpenTransferAdmin,
  onOpenLeaveGroup,
  onOpenDeleteGroup,
}: GroupSettingsDropdownProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera o pulsar Escape
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

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard?.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Botón de Engranaje Disparador (Target táctil accesible) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${t('groupSettings.title')} — ${groupName}`}
        title={t('groupSettings.title')}
        className="min-h-[38px] px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
      >
        <Settings
          className={`w-4 h-4 stroke-[1.75px] transition-transform duration-200 ${
            isOpen ? 'rotate-90 text-slate-900 dark:text-slate-100' : ''
          }`}
          aria-hidden="true"
        />
        <span className="hidden sm:inline font-medium">{t('groupSettings.button')}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Menú Desplegable Flotante */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Cabecera del Menú con Nombre del Grupo y Rol */}
          <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('groupSettings.title')}
              </span>
              {isSupremeAdmin ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                  <Crown className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                  <span>{t('roles.supremeAdmin')}</span>
                </span>
              ) : isAdmin ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                  <Crown className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                  <span>{t('roles.admin')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>{t('roles.member')}</span>
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-1">
              {groupName}
            </p>

            {/* Código de Invitación Rápido si es Admin (visible solo en Ajustes) */}
            {isAdmin && inviteCode && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>{t('groupSettings.inviteCode')}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    {t('groupSettings.adminsOnly')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <code className="text-xs font-mono font-bold text-slate-950 dark:text-slate-100 tracking-wider truncate">
                    {inviteCode}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer shrink-0"
                    title={t('common.copy')}
                    aria-label={t('common.copy')}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5px]" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t('common.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 stroke-[1.75px]" />
                        <span>{t('common.copy')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Opciones Principales */}
          <div className="py-1">
            {/* 1. Opción: Miembros del Grupo */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenMembers();
              }}
              className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white shrink-0 mt-0.5">
                <Users className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {t('groupSettings.members')}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {memberCount}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  {t('groupSettings.membersDesc')}
                </p>
              </div>
            </button>

            {/* 2. Opción: Invitar al Grupo */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenInvite();
              }}
              className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white shrink-0 mt-0.5">
                <UserPlus className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                  {t('groupSettings.invite')}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  {t('groupSettings.inviteDesc')}
                </p>
              </div>
            </button>

            {/* 3. Opción: Transferir Administrador Supremo */}
            {isSupremeAdmin && memberCount > 1 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenTransferAdmin();
                }}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-amber-50/80 dark:hover:bg-amber-950/30 transition cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <Crown className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                      {t('groupSettings.transferSupreme')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      {t('groupSettings.exclusiveBadge')}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-tight mt-0.5">
                    {t('groupSettings.transferSupremeDesc')}
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Separador de Zona de Riesgo */}
          <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

          {/* 4. Opción: Salir del Grupo o Eliminar Grupo */}
          <div className="py-1">
            {memberCount <= 1 ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenDeleteGroup) onOpenDeleteGroup();
                  else onOpenLeaveGroup();
                }}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer group text-rose-700 dark:text-rose-400"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 block">
                    {t('groupSettings.delete')}
                  </span>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 leading-tight mt-0.5">
                    {t('groupSettings.deleteDesc')}
                  </p>
                </div>
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenLeaveGroup();
                }}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer group text-rose-700 dark:text-rose-400"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                  <LogOut className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 block">
                    {t('groupSettings.leave')}
                  </span>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 leading-tight mt-0.5">
                    {t('groupSettings.leaveDesc')}
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
