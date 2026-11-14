/**
 * SplitFlow — VerifyEmailView Component
 * Vista dedicada para confirmar el enlace de verificación enviado desde
 * SplitflowNoReplay@gmail.com al crear una cuenta nueva.
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { EmailVerificationResult } from '../lib/dataProvider';
import { useI18n } from '../i18n/I18nContext';

export interface VerifyEmailViewProps {
  token: string;
  email: string;
  onVerifyEmail: (email: string, token: string) => Promise<EmailVerificationResult>;
  onResendVerification?: (emailOrUsername: string) => Promise<{ success: boolean; email?: string; error?: string }>;
  onBackToLogin: (verifiedInfo?: { email?: string; username?: string }) => void;
}

// Caché en memoria de promesas en curso para evitar doble ejecución bajo React StrictMode
const inFlightVerifications = new Map<string, Promise<EmailVerificationResult>>();

export function VerifyEmailView({
  token,
  email,
  onVerifyEmail,
  onResendVerification,
  onBackToLogin,
}: VerifyEmailViewProps) {
  const { t } = useI18n();

  const [status, setStatus] = useState<'VERIFYING' | 'VERIFIED' | 'ERROR'>('VERIFYING');
  const [verifiedEmail, setVerifiedEmail] = useState<string>(email);
  const [verifiedUsername, setVerifiedUsername] = useState<string | undefined>(undefined);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanToken = (token || '').trim();

    if (!cleanToken) {
      setStatus('ERROR');
      setErrorMessage(t('auth.verifyInvalidLink'));
      return;
    }

    const cacheKey = `${cleanEmail}::${cleanToken}`;
    let promise = inFlightVerifications.get(cacheKey);
    if (!promise) {
      promise = onVerifyEmail(cleanEmail, cleanToken);
      inFlightVerifications.set(cacheKey, promise);
    }

    promise
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setStatus('VERIFIED');
          if (res.email) setVerifiedEmail(res.email);
          if (res.username) setVerifiedUsername(res.username);
          setAlreadyVerified(Boolean(res.alreadyVerified));
        } else {
          inFlightVerifications.delete(cacheKey);
          setStatus('ERROR');
          setErrorMessage(res.error || t('auth.verifyInvalidLink'));
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        inFlightVerifications.delete(cacheKey);
        setStatus('ERROR');
        setErrorMessage(err instanceof Error ? err.message : t('auth.verifyInvalidLink'));
      });

    return () => {
      isMounted = false;
    };
  }, [email, token, onVerifyEmail, t]);

  const handleResend = async () => {
    const target = (verifiedEmail || email || '').trim().toLowerCase();
    if (!target || !onResendVerification || isResending) return;

    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const res = await onResendVerification(target);
      if (res.success) {
        setResendSuccess(true);
      } else {
        setResendError(res.error || t('common.error'));
      }
    } catch (err: unknown) {
      setResendError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between items-center p-4 sm:p-6 transition-colors duration-200">
      <header className="w-full max-w-md mx-auto flex items-center justify-end pt-2">
        <LanguageSelector variant="compact" />
      </header>

      <main className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 sm:p-8 my-auto">
        {/* Cabecera / Branding oficial SplitFlow con logo en cuadrado blanco */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-slate-200 dark:border-slate-700 p-2 shadow-xs mb-3 overflow-hidden">
            <img
              src="/assets/aistudio/logoSplitflow_5c96e8d4.png"
              alt="Logo SplitFlow"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            SplitFlow
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('auth.verifyPageSubtitle')}
          </p>
        </div>

        {/* Estado 1: Verificando token */}
        {status === 'VERIFYING' && (
          <div className="py-8 text-center space-y-3 animate-in fade-in">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-900 dark:text-slate-100" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('auth.verifyingEmailDesc')}
            </p>
          </div>
        )}

        {/* Estado 2: Verificado con éxito */}
        {status === 'VERIFIED' && (
          <div className="space-y-5 py-2 text-center animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2.25px]" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {alreadyVerified ? t('auth.alreadyVerifiedTitle') : t('auth.emailVerifiedTitle')}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('auth.emailVerifiedDesc', {
                  email: verifiedEmail || email || 'tu correo electrónico',
                })}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('auth.accountActiveBadge')}</span>
              </div>
              {verifiedUsername && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-6">
                  {t('auth.loginWithUsernameHint', { username: verifiedUsername })}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                onBackToLogin({
                  email: verifiedEmail || email,
                  username: verifiedUsername,
                })
              }
              className="w-full min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>{t('auth.backToLogin')}</span>
            </button>
          </div>
        )}

        {/* Estado 3: Error o enlace expirado */}
        {status === 'ERROR' && (
          <div className="space-y-4 py-2 animate-in fade-in">
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">{t('auth.verifyErrorTitle')}</p>
                <p className="text-[11px] leading-relaxed">{errorMessage}</p>
              </div>
            </div>

            {resendSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>{t('auth.verificationSent')}</span>
              </div>
            )}

            {resendError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs">
                {resendError}
              </div>
            )}

            <div className="space-y-2 pt-1">
              {(verifiedEmail || email) && onResendVerification && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isResending ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{isResending ? t('common.loading') : t('auth.resendVerification')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onBackToLogin()}
                className="w-full min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>{t('auth.backToLogin')}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <div className="h-6" />
    </div>
  );
}
