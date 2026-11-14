/**
 * SplitFlow — AuthScreen Component (Stripe / Linear Corporate Aesthetic)
 * Pantalla de Inicio de Sesión y Registro con navegación de regreso ("Atrás"),
 * validación estricta de credenciales, alta disponibilidad con Supabase Auth
 * y arquitectura limpia sin datos mock ni modo demo.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft,
  LogIn, 
  Wallet, 
  Lock, 
  Mail, 
  User as UserIcon,
  AtSign,
  Check,
  X,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Sliders,
  Database,
  Loader2
} from 'lucide-react';
import { User } from '../types';
import { 
  validatePasswordSecurity, 
  sanitizeTextInput, 
  validateEmailFormat,
  validateUsername,
  sanitizeUsername,
  detectDangerousUsernameChars,
  isUsernameAvailableInList
} from '../lib/security';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSelector } from './LanguageSelector';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';

interface AuthScreenProps {
  initialMode?: 'LOGIN' | 'REGISTER';
  availableUsers?: User[];
  allUsers?: User[];
  onLogin: (email: string, password?: string) => void;
  onRegister: (newUser: User, password?: string) => Promise<{ success: boolean; requiresEmailConfirmation?: boolean; email?: string; username?: string; error?: string } | void> | void;
  onResendVerification?: (emailOrUsername: string) => Promise<{ success: boolean; email?: string; error?: string } | boolean>;
  onBack?: () => void;
  backendErrorMessage?: string | null;
  unverifiedEmail?: string | null;
  onClearErrors?: () => void;
  confirmationMessage?: string | null;
  onRequestPasswordReset?: (email: string, redirectTo?: string) => Promise<{ success: boolean; error?: string }>;
  onVerifyPasswordResetOtp?: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateUserPassword?: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  onConfirmPasswordReset?: (email: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  onPasswordResetSuccess?: () => void;
}

export function AuthScreen({ 
  initialMode = 'LOGIN',
  availableUsers = [], 
  allUsers = [],
  onLogin, 
  onRegister, 
  onResendVerification,
  onBack,
  backendErrorMessage,
  unverifiedEmail,
  onClearErrors,
  confirmationMessage,
  onRequestPasswordReset,
  onVerifyPasswordResetOtp,
  onUpdateUserPassword,
  onConfirmPasswordReset,
  onPasswordResetSuccess,
}: AuthScreenProps) {
  const { t } = useI18n();
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>(initialMode);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    if (initialMode) {
      setAuthMode(initialMode);
    }
  }, [initialMode]);

  // Formulario Login (exclusivo por nombre de usuario, sin necesidad de @)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulario Registro: Correo obligatorio con activación inmediata
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [regEmail, setRegEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [regPassword, setRegPassword] = useState('');
  const [regIncome, setRegIncome] = useState('');

  const [formError, setFormError] = useState('');
  const [emailConfirmationPending, setEmailConfirmationPending] = useState<string | null>(null);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResendConfirmation = async (targetEmail: string) => {
    if (!targetEmail || isResendingEmail) return;
    setIsResendingEmail(true);
    setResendSuccess(false);
    try {
      if (onResendVerification) {
        const res = await onResendVerification(targetEmail);
        if (typeof res === 'object' && res !== null && !res.success) {
          setFormError(res.error || t('common.error'));
          return;
        }
      }
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 6000);
    } catch {
      // ignore
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Directorio consolidado de usuarios registrados para contrastar unicidad estricta
  const usersDirectory = useMemo(() => {
    return allUsers && allUsers.length > 0 ? allUsers : availableUsers;
  }, [allUsers, availableUsers]);

  // Validación de seguridad de contraseña
  const pwdSecurity = useMemo(() => {
    return validatePasswordSecurity(regPassword);
  }, [regPassword]);

  // Validación y unicidad en tiempo real del correo electrónico obligatorio
  const emailStatus = useMemo(() => {
    const clean = sanitizeTextInput(regEmail).toLowerCase();
    if (!clean) {
      return {
        isValid: false,
        status: 'empty' as const,
        message: 'El correo electrónico es obligatorio',
      };
    }

    if (!validateEmailFormat(clean)) {
      return {
        isValid: false,
        status: 'invalid' as const,
        message: 'Formato de correo no válido',
      };
    }

    const isTaken = usersDirectory.some(
      (u) => u.email.trim().toLowerCase() === clean
    );
    if (isTaken) {
      return {
        isValid: false,
        status: 'taken' as const,
        message: 'Este correo ya está registrado.',
      };
    }

    return {
      isValid: true,
      status: 'available' as const,
      message: 'Disponible',
    };
  }, [regEmail, usersDirectory]);

  // Validación y unicidad en tiempo real del nombre de usuario
  const usernameStatus = useMemo(() => {
    if (!regUsername) {
      return {
        isValid: false,
        status: 'empty' as const,
        message: 'Elija su nombre de usuario (@usuario)',
        cleanUsername: '',
      };
    }

    const val = validateUsername(regUsername);
    if (!val.isValid) {
      return {
        isValid: false,
        status: 'invalid' as const,
        message: val.error || 'Formato de usuario no válido',
        cleanUsername: val.cleanUsername,
      };
    }

    const isAvailable = isUsernameAvailableInList(val.cleanUsername, usersDirectory);
    if (!isAvailable) {
      return {
        isValid: false,
        status: 'taken' as const,
        message: `El usuario @${val.cleanUsername} ya está ocupado por otro integrante.`,
        cleanUsername: val.cleanUsername,
      };
    }

    return {
      isValid: true,
      status: 'available' as const,
      message: `Disponible: @${val.cleanUsername}`,
      cleanUsername: val.cleanUsername,
    };
  }, [regUsername, usersDirectory]);

  // Manejo de la entrada con bloqueo proactivo de comillas e inyecciones
  const handleUsernameChange = (rawInput: string) => {
    setUsernameTouched(true);
    const rawWithoutAt = rawInput.replace(/^@+/, '');
    const dangerous = detectDangerousUsernameChars(rawWithoutAt);
    if (dangerous.hasDangerousChars) {
      setSecurityWarning('Saneamiento de seguridad: se han bloqueado comillas y delimitadores de inyección.');
    } else {
      setSecurityWarning(null);
    }
    const clean = sanitizeUsername(rawInput);
    setRegUsername(clean);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const rawInput = sanitizeTextInput(loginUsername);
    if (!rawInput) {
      setFormError('Introduce tu nombre de usuario para acceder.');
      return;
    }

    // Si el usuario intentó escribir un correo electrónico, rechazar con mensaje explicativo
    if (rawInput.includes('@') && rawInput.includes('.')) {
      setFormError('El acceso es exclusivo mediante tu nombre de usuario, no con correo electrónico.');
      return;
    }

    const cleanUser = sanitizeUsername(rawInput);
    if (!cleanUser) {
      setFormError('Introduce un nombre de usuario válido.');
      return;
    }

    if (!loginPassword) {
      setFormError(t('auth.passwordLabel'));
      return;
    }

    onLogin(cleanUser, loginPassword);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setEmailConfirmationPending(null);

    const cleanName = sanitizeTextInput(regName, 60);
    const cleanEmail = sanitizeTextInput(regEmail, 100).toLowerCase();

    if (!cleanName) {
      setFormError(t('auth.nameLabel'));
      return;
    }

    if (!usernameStatus.isValid) {
      setFormError(usernameStatus.message);
      return;
    }

    if (!cleanEmail || !emailStatus.isValid) {
      setFormError(emailStatus.message || 'El correo electrónico es obligatorio.');
      return;
    }

    if (!pwdSecurity.isValid) {
      setFormError(t('auth.weakPassword'));
      return;
    }

    const cleanUsername = usernameStatus.cleanUsername;

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      monthlyIncome: regIncome.trim() ? Math.max(0, Math.min(1000000, parseFloat(regIncome) || 0)) : undefined,
      role: 'member',
      isEmailVerified: false,
    };

    setIsSubmittingRegister(true);
    try {
      const res = await onRegister(newUser, regPassword);
      if (res && res.success && res.requiresEmailConfirmation) {
        setEmailConfirmationPending(res.email || cleanEmail);
        setRegName('');
        setRegUsername('');
        setUsernameTouched(false);
        setRegEmail('');
        setEmailTouched(false);
        setRegPassword('');
        setRegIncome('');
        setSecurityWarning(null);
        setLoginUsername('');
        setLoginPassword('');
        setFormError('');
        setAuthMode('LOGIN');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la cuenta.';
      setFormError(msg);
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  // Manejo de Recuperación de Contraseña con Supabase Auth o Backend Props
  const handleRequestPasswordReset = async (emailOrUsername: string) => {
    let cleanTarget = sanitizeTextInput(emailOrUsername).toLowerCase();

    // Si el usuario introduce su nombre de usuario en lugar del correo, resolver el correo registrado
    if (!cleanTarget.includes('@') || !cleanTarget.includes('.')) {
      const cleanU = sanitizeUsername(emailOrUsername);
      const match = usersDirectory.find((u) => u.username && u.username.toLowerCase() === cleanU.toLowerCase());
      if (match?.email) {
        cleanTarget = match.email.toLowerCase();
      } else if (isSupabaseConfigured && supabase) {
        try {
          const { data: rpcEmail } = await supabase.rpc('get_email_by_username', { p_username: cleanU });
          if (rpcEmail && typeof rpcEmail === 'string' && rpcEmail.includes('@')) {
            cleanTarget = rpcEmail.toLowerCase();
          }
        } catch {}
      }
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const resetUrl = `${origin}/reset-password`;

    if (onRequestPasswordReset) {
      return await onRequestPasswordReset(cleanTarget, resetUrl);
    }
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanTarget, {
          redirectTo: resetUrl,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Error al procesar solicitud' };
    }
  };

  const handleVerifyOtp = async (emailToVerify: string, token: string) => {
    if (onVerifyPasswordResetOtp) {
      return await onVerifyPasswordResetOtp(emailToVerify, token);
    }
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.verifyOtp({
          email: sanitizeTextInput(emailToVerify),
          token: sanitizeTextInput(token),
          type: 'recovery',
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Error al validar OTP' };
    }
  };

  const handleUpdatePassword = async (newPwd: string) => {
    if (onUpdateUserPassword) {
      return await onUpdateUserPassword(newPwd);
    }
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({
          password: newPwd,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Error al actualizar contrasena' };
    }
  };

  const handleConfirmPasswordReset = async (emailToReset: string, token: string, newPwd: string) => {
    if (onConfirmPasswordReset) {
      return await onConfirmPasswordReset(emailToReset, token, newPwd);
    }
    const verifyRes = await handleVerifyOtp(emailToReset, token);
    if (!verifyRes.success) {
      return { success: false, error: verifyRes.error || 'Codigo OTP invalido o expirado.' };
    }
    const updateRes = await handleUpdatePassword(newPwd);
    if (!updateRes.success) {
      return { success: false, error: updateRes.error || 'Error al actualizar la contrasena.' };
    }
    return { success: true };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-8 font-sans transition-colors duration-150 relative">
      
      {/* Barra Superior de Navegación: Botón Atrás + Selector de Idioma */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-6 sm:pb-8">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a la portada"
            className="min-h-[44px] px-3.5 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            <span>Atrás</span>
          </button>
        ) : (
          <div />
        )}

        <LanguageSelector variant="compact" />
      </header>

      {/* Contenedor Principal: Estructura Dual Stripe / Linear */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Columna Izquierda: Información de Producto y Propuesta de Valor */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
              <img 
                src="/assets/aistudio/logoSplitflow_5c96e8d4.png" 
                alt="Logo SplitFlow" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">SplitFlow</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Gastos Compartidos & Presupuesto
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white leading-tight">
              {authMode === 'LOGIN' ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta profesional'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Gestión inteligente y liquidación óptima de cuentas para parejas, viajes, compañeros de piso y familias.
            </p>
          </div>

          {/* Bloques de Valor Estilo Linear (Líneas sutiles y alto contraste) */}
          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span>Simplificación Inteligente de Deudas</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-6">
                Algoritmo de grafos que reduce al mínimo el número de transferencias bancarias entre los participantes.
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Sliders className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span>Reglas de Reparto Flexibles</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-6">
                Reparto equitativo, por porcentajes o proporcional a los ingresos de cada miembro.
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Database className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span>Supabase PostgreSQL en Tiempo Real</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-6">
                Persistencia estricta en base de datos relational con Row Level Security (RLS).
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Formulario Stripe/Linear */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 sm:p-8">
          
          {/* Selector de Pestañas Segmentadas */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-md mb-6" role="tablist" aria-label="Modalidad de autenticación">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'LOGIN'}
              onClick={() => {
                setAuthMode('LOGIN');
                setFormError('');
                onClearErrors?.();
              }}
              className={`min-h-[40px] flex-1 text-xs font-semibold rounded transition cursor-pointer flex items-center justify-center ${
                authMode === 'LOGIN'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('auth.loginTab')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'REGISTER'}
              onClick={() => {
                setAuthMode('REGISTER');
                setFormError('');
                setEmailConfirmationPending(null);
                onClearErrors?.();
              }}
              className={`min-h-[40px] flex-1 text-xs font-semibold rounded transition cursor-pointer flex items-center justify-center ${
                authMode === 'REGISTER'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('auth.registerTab')}
            </button>
          </div>

          {/* Aviso de enlace de verificación enviado desde SplitflowNoReplay@gmail.com */}
          {emailConfirmationPending && !formError && (
            <div className="mb-5 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold">
                <Mail className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 stroke-[2px]" aria-hidden="true" />
                <span>{t('auth.pendingLinkBannerTitle')}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-300">
                {t('auth.pendingLinkBannerDesc', {
                  sender: 'SplitflowNoReplay@gmail.com',
                  email: emailConfirmationPending,
                })}
              </p>

              {resendSuccess && (
                <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>{t('auth.verificationSent')}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleResendConfirmation(emailConfirmationPending)}
                  disabled={isResendingEmail}
                  className="px-3 min-h-[38px] text-xs font-semibold rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isResendingEmail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isResendingEmail ? t('common.loading') : t('auth.resendVerification')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mensaje de confirmacion de operacion (ej. correo verificado o cuenta eliminada) */}
          {confirmationMessage && !formError && !backendErrorMessage && !emailConfirmationPending && (
            <div className="mb-5 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 stroke-[2px]" aria-hidden="true" />
              <span className="font-medium">{confirmationMessage}</span>
            </div>
          )}

          {/* Errores */}
          {(formError || backendErrorMessage) && (
            <div className="mb-5 p-3.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 stroke-[1.75px] mt-0.5" aria-hidden="true" />
                <span>{formError || backendErrorMessage}</span>
              </div>

              {unverifiedEmail && onResendVerification && (
                <div className="pl-6 space-y-2">
                  {resendSuccess && (
                    <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>{t('auth.verificationSent')}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResendConfirmation(unverifiedEmail)}
                    disabled={isResendingEmail}
                    className="px-3 min-h-[36px] text-[11px] font-semibold rounded border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-900 dark:text-rose-200 hover:bg-rose-100/60 dark:hover:bg-slate-800 transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isResendingEmail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{isResendingEmail ? t('common.loading') : t('auth.resendVerification')}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. FORMULARIO DE INICIO DE SESIÓN */}
          {authMode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                  <span>Nombre de usuario</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="usuario"
                  value={loginUsername}
                  onChange={(e) => {
                    setLoginUsername(e.target.value);
                    setFormError('');
                  }}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                    <span>{t('auth.passwordLabel')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError('');
                      setShowForgotPasswordModal(true);
                    }}
                    className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white underline hover:no-underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                />
              </div>

              <button
                type="submit"
                className="min-h-[44px] w-full py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer mt-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <LogIn className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                <span>{t('auth.submitLogin')}</span>
              </button>
            </form>
          )}

          {/* 2. FORMULARIO DE REGISTRO */}
          {authMode === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                    <span>{t('auth.nameLabel')}</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Usuario 1"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                  />
                </div>

                {/* Campo de Nombre de Usuario Personalizado */}
                <div className="space-y-1.5">
                  <label 
                    htmlFor="reg-username"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                      <span>Nombre de Usuario (@)</span>
                    </span>
                    {usernameTouched && regUsername && (
                      <span className={`text-[10px] font-mono font-semibold ${
                        usernameStatus.isValid 
                          ? 'text-emerald-700 dark:text-emerald-400' 
                          : 'text-rose-700 dark:text-rose-400'
                      }`}>
                        {usernameStatus.isValid ? 'Disponible' : 'No disponible'}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="text-slate-400 absolute left-3.5 top-3 text-xs font-mono font-bold select-none" aria-hidden="true">
                      @
                    </span>
                    <input
                      id="reg-username"
                      type="text"
                      required
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck="false"
                      placeholder="tu_usuario"
                      value={regUsername}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      aria-invalid={usernameTouched && !usernameStatus.isValid}
                      aria-describedby="reg-username-desc"
                      className={`min-h-[44px] w-full pl-8 pr-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border text-slate-900 dark:text-white text-xs font-mono placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 ${
                        usernameTouched && regUsername
                          ? usernameStatus.isValid
                            ? 'border-emerald-500 dark:border-emerald-600 focus-visible:ring-emerald-700'
                            : 'border-rose-500 dark:border-rose-600 focus-visible:ring-rose-700'
                          : 'border-slate-200 dark:border-slate-800 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100'
                      }`}
                    />
                  </div>

                  {/* Advertencia de Caracteres Peligrosos o Inyecciones */}
                  {securityWarning && (
                    <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-950 dark:text-amber-200 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400 stroke-[1.75px]" aria-hidden="true" />
                      <span>{securityWarning}</span>
                    </div>
                  )}

                  {/* Feedback de Estado / Formato / Disponibilidad */}
                  {usernameTouched && regUsername && !securityWarning && (
                    <p 
                      id="reg-username-desc"
                      className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                        usernameStatus.isValid
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {usernameStatus.isValid ? (
                        <Check className="w-3.5 h-3.5 shrink-0 stroke-[1.75px]" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[1.75px]" aria-hidden="true" />
                      )}
                      <span>{usernameStatus.message}</span>
                    </p>
                  )}

                  {!usernameTouched && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      3 a 24 caracteres (a-z, 0-9, _ y -). Sin comillas ni espacios.
                    </p>
                  )}
                </div>
              </div>

              {/* Fila 2: Correo electrónico OBLIGATORIO + Ingresos Mensuales Opcionales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                      <span>{t('auth.emailLabel')}</span>
                    </span>
                    {emailTouched && regEmail && (
                      <span className={`text-[10px] font-mono font-semibold ${
                        emailStatus.isValid 
                          ? 'text-emerald-700 dark:text-emerald-400' 
                          : 'text-rose-700 dark:text-rose-400'
                      }`}>
                        {emailStatus.isValid ? 'Disponible' : 'No disponible'}
                      </span>
                    )}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@dominio.com"
                    value={regEmail}
                    onChange={(e) => {
                      setEmailTouched(true);
                      setRegEmail(e.target.value);
                    }}
                    className={`min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 ${
                      emailTouched && regEmail
                        ? emailStatus.isValid
                          ? 'border-emerald-500 dark:border-emerald-600 focus-visible:ring-emerald-700'
                          : 'border-rose-500 dark:border-rose-600 focus-visible:ring-rose-700'
                        : 'border-slate-200 dark:border-slate-800 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100'
                    }`}
                  />
                  {emailTouched && regEmail && !emailStatus.isValid ? (
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1 pt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[1.75px]" aria-hidden="true" />
                      <span>{emailStatus.message}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      Se almacena para notificaciones, invitaciones y recuperación. Para iniciar sesión sólo usarás tu usuario.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                    <span>{t('auth.incomeLabel')}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="Opcional (ej. 2000)"
                    value={regIncome}
                    onChange={(e) => setRegIncome(e.target.value)}
                    className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                  <span>{t('auth.passwordLabel')}</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                />
              </div>

              {/* Indicadores de Requisitos de Contraseña */}
              <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Seguridad de Contraseña:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-1.5 ${pwdSecurity.hasMinLength ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {pwdSecurity.hasMinLength ? <Check className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" /> : <X className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />}
                    <span>8+ caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdSecurity.hasUppercase ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {pwdSecurity.hasUppercase ? <Check className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" /> : <X className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />}
                    <span>Mayúscula</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdSecurity.hasNumber ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {pwdSecurity.hasNumber ? <Check className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" /> : <X className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />}
                    <span>Número</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdSecurity.hasSpecialChar ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {pwdSecurity.hasSpecialChar ? <Check className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" /> : <X className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />}
                    <span>Especial (#@!)</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingRegister || !pwdSecurity.isValid || !usernameStatus.isValid || !emailStatus.isValid}
                className="min-h-[44px] w-full py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
              >
                {isSubmittingRegister ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando cuenta...</span>
                  </>
                ) : (
                  <>
                    <span>{t('auth.submitRegister')}</span>
                    <ArrowRight className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>

      {/* Modal de Recuperación de Contraseña con Código OTP (Flujo en 3 pasos) */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onRequestReset={handleRequestPasswordReset}
        onVerifyOtp={handleVerifyOtp}
        onConfirmReset={handleConfirmPasswordReset}
        onSuccessLogin={() => {
          setShowForgotPasswordModal(false);
          if (onPasswordResetSuccess) {
            onPasswordResetSuccess();
          }
        }}
        initialEmail={loginUsername}
      />
    </div>
  );
}
