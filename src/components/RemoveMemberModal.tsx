/**
 * SplitFlow — RemoveMemberModal Component
 * Modal accesible de confirmación destructiva para eliminar a un integrante del grupo
 * con un mensaje de advertencia claro sobre la pérdida de acceso y la preservación
 * de la integridad del histórico contable.
 */

import React, { useState, useEffect } from 'react';
import { 
  UserMinus, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react';
import { Group, User } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface RemoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  targetMember: User | null;
  onConfirmRemove: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
}

export function RemoveMemberModal({
  isOpen,
  onClose,
  group,
  targetMember,
  onConfirmRemove,
}: RemoveMemberModalProps) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, targetMember?.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !targetMember) return null;

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await onConfirmRemove(group.id, targetMember.id);
      if (!res.success) {
        setErrorMsg(res.error || t('common.error'));
        setIsSubmitting(false);
      } else {
        setSuccessMsg(t('removeMember.success', { name: targetMember.name }));
        setIsSubmitting(false);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-member-title"
      aria-describedby="remove-member-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100 dark:border-rose-950/50 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-rose-100 dark:bg-rose-900/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <UserMinus className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </div>
            <div>
              <h3 
                id="remove-member-title" 
                className="text-sm font-bold text-rose-950 dark:text-rose-100 tracking-tight"
              >
                {t('removeMember.title')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('nav.groups')}: <span className="font-semibold text-slate-700 dark:text-slate-300">{group.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
          </button>
        </div>

        {/* Contenido / Advertencia */}
        <form onSubmit={handleRemove} className="p-5 space-y-4 text-xs">
          {successMsg ? (
            <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 flex items-start gap-3 animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                  {t('common.success')}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  {successMsg}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Tarjeta del usuario a eliminar */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 font-mono">
                    {(targetMember.username || targetMember.name).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-xs">
                      {targetMember.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {targetMember.username ? `@${targetMember.username}` : targetMember.email}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {targetMember.role === 'admin' ? t('roles.admin') : t('roles.member')}
                </span>
              </div>

              {/* REQUISITO: Mensaje de Advertencia Destacado */}
              <div 
                id="remove-member-description"
                className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2"
              >
                <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 stroke-[2.25px]" aria-hidden="true" />
                  <span>{t('removeMember.warningTitle', { name: targetMember.name })}</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed pl-6">
                  <p>
                    {t('removeMember.warningText')}
                  </p>
                </div>
              </div>

              {/* Mensaje de error */}
              {errorMsg && (
                <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="min-h-[40px] px-3.5 py-2 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[40px] px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('removeMember.removing')}</span>
                    </>
                  ) : (
                    <>
                      <UserMinus className="w-3.5 h-3.5 stroke-[2px]" />
                      <span>{t('removeMember.confirmBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
