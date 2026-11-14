/**
 * SplitFlow — LeaveGroupModal Component
 * Modal de advertencia (WCAG AAA) para salir de un grupo de gastos compartidos.
 * Analiza el balance del usuario antes de confirmar la salida e informa sobre deudas
 * o saldos a favor pendientes, asegurando transparencia contable.
 */

import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  X, 
  LogOut, 
  Wallet, 
  Users, 
  ShieldAlert, 
  CheckCircle2,
  ArrowRight,
  Crown
} from 'lucide-react';
import { Group } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface LeaveGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLeave: (groupId: string) => Promise<{ success: boolean; error?: string }>;
  group: Group;
  userBalance?: number;
  isAdmin?: boolean;
}

export function LeaveGroupModal({
  isOpen,
  onClose,
  onConfirmLeave,
  group,
  userBalance = 0,
  isAdmin = false,
}: LeaveGroupModalProps) {
  const { t, formatAmount } = useI18n();
  const [isLeaving, setIsLeaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isLeaving) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLeaving, onClose]);

  if (!isOpen) return null;

  const owesMoney = userBalance < -0.01;
  const isOwedMoney = userBalance > 0.01;
  const isSettled = !owesMoney && !isOwedMoney;
  const currency = group.currency || 'EUR';

  const handleConfirm = async () => {
    setErrorMsg(null);
    setIsLeaving(true);
    try {
      const res = await onConfirmLeave(group.id);
      if (!res.success) {
        setErrorMsg(res.error || t('common.error'));
        setIsLeaving(false);
      } else {
        setIsLeaving(false);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
      setIsLeaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-group-title"
      aria-describedby="leave-group-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </div>
            <div>
              <h3 
                id="leave-group-title" 
                className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight"
              >
                {t('leaveGroup.title')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('leaveGroup.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLeaving}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 disabled:opacity-50"
          >
            <X className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 space-y-4 text-xs">
          {/* Identificación del Grupo */}
          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                {t('nav.groups')}
              </p>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                {group.name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-slate-600 dark:text-slate-400 text-[11px] font-mono">
              <Users className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
              <span>{group.members.length} {t('common.members')}</span>
            </div>
          </div>

          {/* Bloque de Estado del Balance Financiero */}
          {owesMoney && (
            <div className="p-3.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0 stroke-[2px]" aria-hidden="true" />
                <span>{t('leaveGroup.subtitle')}</span>
              </div>
              <p className="leading-relaxed text-[11px] text-rose-700 dark:text-rose-300">
                {t('leaveGroup.owesWarning', { amount: formatAmount(Math.abs(userBalance), currency) })}
              </p>
            </div>
          )}

          {isOwedMoney && (
            <div className="p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Wallet className="w-4 h-4 shrink-0 stroke-[2px]" aria-hidden="true" />
                <span>{t('leaveGroup.subtitle')}</span>
              </div>
              <p className="leading-relaxed text-[11px] text-amber-700 dark:text-amber-300">
                {t('leaveGroup.owedWarning', { amount: formatAmount(userBalance, currency) })}
              </p>
            </div>
          )}

          {isSettled && (
            <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 stroke-[2px]" aria-hidden="true" />
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                {t('leaveGroup.settledNote')}
              </p>
            </div>
          )}

          {/* Advertencia de Administrador y Reasignación Automática */}
          {isAdmin && group.members.length > 1 && (
            <div className="p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Crown className="w-4 h-4 shrink-0 stroke-[2px]" aria-hidden="true" />
                <span>{t('transferAdmin.title')}</span>
              </div>
              <p className="leading-relaxed text-[11px] text-amber-700 dark:text-amber-300">
                {t('transferAdmin.note')}
              </p>
            </div>
          )}

          {/* Mensaje de error si la acción falla */}
          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Botones de Acción (Targets táctiles >= 44x44px) */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLeaving}
            className="min-h-[44px] px-4 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLeaving}
            className="min-h-[44px] px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
          >
            {isLeaving ? (
              <span>{t('leaveGroup.leaving')}</span>
            ) : (
              <>
                <LogOut className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                <span>{t('leaveGroup.confirmBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
