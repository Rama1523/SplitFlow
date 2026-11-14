/**
 * SplitFlow — EmailVerificationScreen Component
 * Pantalla dedicada de "Verificación de Correo Requerida".
 * Bloquea el acceso a datos privados hasta que el enlace enviado haya sido confirmado.
 * Adaptado a Modo Claro y Modo Oscuro con soporte multilingüe.
 * Totalmente sin emoticonos.
 */

import { useState } from 'react';
import { 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  LogOut, 
  AlertCircle,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSelector } from './LanguageSelector';

interface EmailVerificationScreenProps {
  email: string;
  onVerifySuccess?: () => void;
  onResendEmail: () => Promise<boolean>;
  onBackToLogin: () => void;
  isDemoMode?: boolean;
}

export function EmailVerificationScreen({
  email,
  onVerifySuccess,
  onResendEmail,
  onBackToLogin,
  isDemoMode = false,
}: EmailVerificationScreenProps) {
  const { t } = useI18n();
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendError, setResendError] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    setResendStatus(null);
    setResendError(false);
    try {
      const ok = await onResendEmail();
      if (ok) {
        setResendStatus(t('auth.verificationSent'));
      } else {
        setResendStatus(t('auth.verificationSent'));
      }
    } catch {
      setResendStatus(t('common.error'));
      setResendError(true);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans transition-colors duration-200 relative">
      
      {/* Selector de idioma */}
      <div className="fixed top-5 right-5 z-20">
        <LanguageSelector variant="compact" />
      </div>

      {/* Botón superior para volver al Login con Target Táctil >= 44x44px */}
      <button
        type="button"
        onClick={onBackToLogin}
        aria-label={t('auth.backToLogin')}
        className="fixed top-5 left-5 min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white shadow-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
      >
        <ArrowLeft className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
        <span>{t('auth.backToLogin')}</span>
      </button>

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 sm:p-8 shadow-xs space-y-6 text-center">
        
        {/* Icono de Estado */}
        <div className="mx-auto w-14 h-14 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center">
          <Mail className="w-7 h-7 stroke-[1.75px]" />
        </div>

        {/* Titular */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[11px] font-mono font-semibold">
            <Lock className="w-3.5 h-3.5 stroke-[1.75px]" />
            <span>{t('auth.verifyRequiredTitle')}</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('auth.verifyRequiredTitle')}
          </h2>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            {t('auth.verifyRequiredDesc', { email })}
          </p>

          <div className="p-2.5 rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 inline-block">
            {email}
          </div>
        </div>

        {/* Explicación de Políticas de Seguridad */}
        <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
          <p className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[1.75px] shrink-0 mt-0.5" />
            <span>
              {t('landing.disclaimerText')}
            </span>
          </p>
        </div>

        {/* Mensaje de Reenvío */}
        {resendStatus && (
          <div
            className={`p-3 rounded-md border text-xs text-left flex items-start gap-2.5 ${
              resendError
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.75px]" />
            <span>{resendStatus}</span>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="space-y-3 pt-2">
          {/* Si está en modo demo o evaluación, botón para simular verificación instantánea */}
          {isDemoMode && onVerifySuccess && (
            <button
              type="button"
              onClick={onVerifySuccess}
              className="min-h-[44px] w-full py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              <span>Confirmar Correo ({t('common.demoBadge')})</span>
            </button>
          )}

          {/* Reenviar Enlace */}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="min-h-[44px] w-full py-2.5 rounded-md bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[1.75px] ${isResending ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{t('auth.resendVerification')}</span>
          </button>
        </div>

        {/* Pie de pantalla */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={onBackToLogin}
            className="min-h-[44px] text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white inline-flex items-center gap-1.5 font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
          >
            <LogOut className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            <span>{t('common.close')}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
