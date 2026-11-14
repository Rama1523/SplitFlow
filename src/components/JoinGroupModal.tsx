/**
 * SplitFlow — JoinGroupModal Component
 * Modal accesible (WCAG AAA) y sobrio para unirse a un grupo mediante código o identificador.
 * Targets táctiles >= 44x44px, navegación por teclado, soporte de pantalla táctil y contraste óptimo.
 */

import React, { useState, useEffect } from 'react';
import { X, KeyRound, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { sanitizeTextInput } from '../lib/security';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinGroup: (code: string) => Promise<{ success: boolean; error?: string }>;
}

export function JoinGroupModal({ isOpen, onClose, onJoinGroup }: JoinGroupModalProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanCode = sanitizeTextInput(code, 60).trim();
    if (!cleanCode) {
      setErrorMsg(t('joinGroup.errorEmpty'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await onJoinGroup(cleanCode);
      if (res.success) {
        setSuccessMsg(t('joinGroup.success'));
        setTimeout(() => {
          setIsLoading(false);
          setCode('');
          setSuccessMsg(null);
          onClose();
        }, 800);
      } else {
        setErrorMsg(res.error || t('joinGroup.errorNotFound'));
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-group-title"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
        
        {/* Cabecera del modal */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200">
              <KeyRound className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="join-group-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('joinGroup.title')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('joinGroup.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] p-2 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
          >
            <X className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div 
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div 
              role="alert"
              className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="group-code-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('joinGroup.codeLabel')}
            </label>
            <input
              id="group-code-input"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('joinGroup.codePlaceholder')}
              required
              disabled={isLoading}
              className="min-h-[44px] w-full px-3 py-2 text-xs font-mono rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-100"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('joinGroup.subtitle')}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-h-[44px] px-4 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="min-h-[44px] px-5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>{t('joinGroup.joining')}</span>
              ) : (
                <>
                  <span>{t('joinGroup.submit')}</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2px]" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
