/**
 * SplitFlow — DeleteGroupModal Component
 * Modal de confirmación crítica (WCAG AAA) para eliminar un grupo cuando solo queda 1 miembro
 * o el creador decide disolverlo permanentemente.
 * Advierte sobre la eliminación irreversible de gastos, repartos, balances y registros del grupo.
 */

import { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Users, 
  Receipt, 
  ShieldAlert
} from 'lucide-react';
import { Group } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (groupId: string) => Promise<{ success: boolean; error?: string }>;
  group: Group;
  expenseCount?: number;
}

export function DeleteGroupModal({
  isOpen,
  onClose,
  onConfirmDelete,
  group,
  expenseCount = 0,
}: DeleteGroupModalProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setErrorMsg(null);
    setIsDeleting(true);
    try {
      const res = await onConfirmDelete(group.id);
      if (!res.success) {
        setErrorMsg(res.error || t('common.error'));
        setIsDeleting(false);
      } else {
        setIsDeleting(false);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-group-title"
      aria-describedby="delete-group-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal con estilo crítico */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-200 dark:border-red-950 bg-red-50/70 dark:bg-red-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-red-100 dark:bg-red-900/60 border border-red-300 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400">
              <Trash2 className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </div>
            <div>
              <h3 
                id="delete-group-title" 
                className="text-sm font-bold text-red-900 dark:text-red-200 tracking-tight"
              >
                {t('deleteGroup.title')}
              </h3>
              <p className="text-[11px] text-red-700 dark:text-red-400">
                {t('deleteGroup.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 disabled:opacity-50"
          >
            <X className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 space-y-4 text-xs">
          {/* Identificación del Grupo a eliminar */}
          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                {t('nav.groups')}
              </p>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                {group.name}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-slate-600 dark:text-slate-400 text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                {group.members.length} {t('common.members')}
              </span>
              {expenseCount > 0 && (
                <span className="flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                  {expenseCount} {t('nav.expenses')}
                </span>
              )}
            </div>
          </div>

          {/* Advertencia Crítica */}
          <div className="p-3.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300">
              <ShieldAlert className="w-4 h-4 shrink-0 stroke-[2px]" aria-hidden="true" />
              <span>{t('deleteGroup.subtitle')}</span>
            </div>
            <p className="leading-relaxed text-[11px] text-red-700 dark:text-red-300">
              {t('deleteGroup.warningText')}
            </p>
          </div>

          {/* Mensaje de error si la acción falla */}
          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-[44px] px-4 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="min-h-[44px] px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
          >
            {isDeleting ? (
              <span>{t('deleteGroup.deleting')}</span>
            ) : (
              <>
                <Trash2 className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                <span>{t('deleteGroup.confirmBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
