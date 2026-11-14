/**
 * SplitFlow — TransferAdminModal Component
 * Modal accesible (WCAG AAA) para que el administrador actual de un grupo pueda
 * renunciar a su cargo y transferirlo a otro miembro activo del grupo.
 * Dispara la actualización en Supabase y el envío del correo de notificación de ascenso.
 */

import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  X, 
  ArrowRightLeft, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Mail,
  Loader2
} from 'lucide-react';
import { Group, User } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface TransferAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  currentUser: User | null;
  onTransferAdmin: (groupId: string, newAdminId: string) => Promise<{ success: boolean; error?: string }>;
}

export function TransferAdminModal({
  isOpen,
  onClose,
  group,
  currentUser,
  onTransferAdmin,
}: TransferAdminModalProps) {
  const { t } = useI18n();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Candidatos elegibles: únicamente los miembros del grupo restantes (excluyendo al admin actual)
  const candidateMembers = group.members.filter((m) => m.id !== currentUser?.id);

  // Resetear estados al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setSelectedCandidateId(candidateMembers.length > 0 ? candidateMembers[0].id : '');
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, group.id]);

  // Manejo de la tecla Escape para accesibilidad
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidateId) {
      setErrorMsg(t('transferAdmin.selectCandidateError'));
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await onTransferAdmin(group.id, selectedCandidateId);
      if (!res.success) {
        setErrorMsg(res.error || t('common.error'));
        setIsSubmitting(false);
      } else {
        const chosenMember = candidateMembers.find((m) => m.id === selectedCandidateId);
        setSuccessMsg(
          t('transferAdmin.success', { name: chosenMember?.name || chosenMember?.username || '' })
        );
        setIsSubmitting(false);
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
      setIsSubmitting(false);
    }
  };

  const selectedCandidate = candidateMembers.find((m) => m.id === selectedCandidateId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-admin-title"
      aria-describedby="transfer-admin-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Crown className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </div>
            <div>
              <h3 
                id="transfer-admin-title" 
                className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight"
              >
                {t('transferAdmin.title')}
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

        {/* Formulario / Contenido */}
        <form onSubmit={handleConfirmTransfer} className="p-5 space-y-4 text-xs">
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
              {/* Administrador Actual */}
              <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    {t('roles.supremeAdmin')}
                  </span>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{currentUser?.name || currentUser?.username || t('groupMembers.youBadge')}</span>
                    {currentUser?.username && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                        (@{currentUser.username})
                      </span>
                    )}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {t('groupMembers.supremeBadge')}
                </span>
              </div>

              {/* Mensaje si no hay candidatos */}
              {candidateMembers.length === 0 ? (
                <div className="p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 stroke-[2px]" aria-hidden="true" />
                    <span>{t('transferAdmin.title')}</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    {t('transferAdmin.note')}
                  </p>
                </div>
              ) : (
                <>
                  {/* Selector de Nuevo Administrador */}
                  <div className="space-y-1.5">
                    <label 
                      htmlFor="new-admin-select"
                      className="block font-bold text-slate-700 dark:text-slate-300 text-xs"
                    >
                      {t('transferAdmin.candidateLabel')}:
                    </label>
                    <div className="relative">
                      <select
                        id="new-admin-select"
                        value={selectedCandidateId}
                        onChange={(e) => setSelectedCandidateId(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full px-3 py-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:outline-none transition"
                      >
                        {candidateMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} {member.username ? `(@${member.username})` : ''} — {member.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Resumen del Candidato Seleccionado */}
                  {selectedCandidate && (
                    <div className="p-3 rounded-md bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center font-bold text-sky-700 dark:text-sky-300 text-[10px]">
                          {(selectedCandidate.username || selectedCandidate.name).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {selectedCandidate.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {selectedCandidate.email}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/50 px-2 py-0.5 rounded">
                        {t('roles.supremeAdmin')}
                      </span>
                    </div>
                  )}

                  {/* Aviso de Privilegios y Notificación */}
                  <div 
                    id="transfer-admin-description"
                    className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{t('transferAdmin.subtitle')}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t('transferAdmin.note')}
                    </p>
                  </div>
                </>
              )}

              {/* Error si ocurre */}
              {errorMsg && (
                <div className="p-2.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50 min-h-[38px]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || candidateMembers.length === 0}
                  className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[38px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('transferAdmin.transferring')}</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2px]" />
                      <span>{t('transferAdmin.confirmBtn')}</span>
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
