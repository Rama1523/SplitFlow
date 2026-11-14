/**
 * SplitFlow — ResetPasswordView Component
 * Vista dedicada y segura para restablecer la contraseña tras acceder desde
 * el enlace enviado por correo electrónico (Supabase Auth).
 * 
 * Cumple estrictamente con:
 * 1. Detección de evento 'PASSWORD_RECOVERY' de Supabase y parsing de hash/query (type=recovery).
 * 2. Formulario con validación de contraseña mínima de 6 caracteres y coincidencia.
 * 3. Actualización de credencial mediante supabase.auth.updateUser({ password }).
 * 4. Estados de carga, mensajes de error y redirección automática al login.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  ShieldCheck
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useI18n } from '../i18n/I18nContext';

export interface ResetPasswordViewProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
}

export function ResetPasswordView({ onSuccess, onBackToLogin }: ResetPasswordViewProps) {
  const { t } = useI18n();

  // Estados de validación del enlace de recuperación
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [isValidRecoverySession, setIsValidRecoverySession] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  // Estados del formulario
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados de proceso
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // ============================================================================
  // 1. DETECCIÓN Y VALIDACIÓN DEL ENLACE DE RECUPERACIÓN (EVENTO & URL HASH/QUERY)
  // ============================================================================
  useEffect(() => {
    let isMounted = true;
    const client = supabase;

    // Si Supabase no está configurado (Modo local/desarrollo), permitir prueba de la vista
    if (!isSupabaseConfigured || !client) {
      setIsValidRecoverySession(true);
      setUserEmail('usuario@ejemplo.com');
      setIsCheckingToken(false);
      return;
    }

    // Comprobación de URL: Hash (#type=recovery) o Search (?type=recovery o ?code=)
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hasRecoveryParam = 
      hash.includes('type=recovery') || 
      search.includes('type=recovery') || 
      hash.includes('access_token') ||
      search.includes('code=');

    // Escuchar el evento oficial 'PASSWORD_RECOVERY' de Supabase Auth
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsValidRecoverySession(true);
        setIsCheckingToken(false);
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      } else if (event === 'SIGNED_IN' && hasRecoveryParam) {
        setIsValidRecoverySession(true);
        setIsCheckingToken(false);
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      }
    });

    // Validar también sesión activa o parámetros en la URL tras pequeño retardo para lectura de hash
    const checkTimeout = setTimeout(async () => {
      if (!isMounted) return;

      try {
        const { data: { session } } = await client.auth.getSession();
        if (session || hasRecoveryParam) {
          setIsValidRecoverySession(true);
          if (session?.user?.email) {
            setUserEmail(session.user.email);
          }
        } else {
          // Si no hay sesión ni parámetros de recuperación en la URL
          setIsValidRecoverySession(false);
        }
      } catch (err) {
        console.warn('Error al verificar sesión de recuperación:', err);
        setIsValidRecoverySession(hasRecoveryParam);
      } finally {
        if (isMounted) {
          setIsCheckingToken(false);
        }
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(checkTimeout);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // ============================================================================
  // 2. CONTEO REGRESIVO Y REDIRECCIÓN AUTOMÁTICA TRAS ÉXITO
  // ============================================================================
  useEffect(() => {
    if (!isSuccess) return;

    if (countdown <= 0) {
      onSuccess();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isSuccess, countdown, onSuccess]);

  // Validaciones en tiempo real
  const isLengthValid = newPassword.length >= 6;
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = isLengthValid && doPasswordsMatch;

  // ============================================================================
  // 3. ACTUALIZACIÓN DE CONTRASEÑA EN SUPABASE
  // ============================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('La contraseña debe tener una longitud mínima de 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          setErrorMessage(error.message || 'No se pudo actualizar la contraseña.');
          setIsLoading(false);
          return;
        }

        // Limpiar tokens de la URL para evitar reintentos con hash inválido
        if (typeof window !== 'undefined' && window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cambiar la contraseña.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        {/* Cabecera / Branding */}
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
            Restablecer Contraseña
          </p>
        </div>

        {/* ==================================================================== */}
        {/* ESTADO 1: VERIFICANDO ENLACE / CARGANDO SESIÓN                        */}
        {/* ==================================================================== */}
        {isCheckingToken && (
          <div className="py-8 text-center space-y-3 animate-in fade-in">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-900 dark:text-slate-100" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Verificando la legitimidad del enlace de recuperación...
            </p>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ESTADO 2: ENLACE INVÁLIDO O INTRODUCCIÓN DE CÓDIGO DE 6 DÍGITOS       */}
        {/* ==================================================================== */}
        {!isCheckingToken && !isValidRecoverySession && !isSuccess && (
          <div className="space-y-4 py-2 animate-in fade-in">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                <KeyRound className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                <span>Restablecer con código de 6 dígitos</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                Si has recibido un código numérico de 6 dígitos desde <strong className="font-mono text-slate-900 dark:text-white">SplitflowNoReplay@gmail.com</strong>, puedes usarlo directamente a través de la ventana de inicio de sesión.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ir al Login / Introducir Código</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ESTADO 3: ÉXITO - CONTRASEÑA ACTUALIZADA                              */}
        {/* ==================================================================== */}
        {!isCheckingToken && isSuccess && (
          <div className="space-y-4 py-3 text-center animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2.25px]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                ¡Contraseña actualizada con éxito!
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Tu credencial ha sido renovada en Supabase. Redirigiendo automáticamente al inicio de sesión en{' '}
                <span className="font-bold text-slate-900 dark:text-white">{countdown}s</span>...
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onSuccess}
                className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Iniciar Sesión Ahora</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ESTADO 4: FORMULARIO DE NUEVA CONTRASEÑA                              */}
        {/* ==================================================================== */}
        {!isCheckingToken && isValidRecoverySession && !isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">Sesión de recuperación validada</span>
              </div>
              {userEmail && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Estableciendo nueva contraseña para <span className="font-mono text-slate-700 dark:text-slate-300">{userEmail}</span>
                </p>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Campo 1: Nueva Contraseña */}
            <div className="space-y-1.5">
              <label 
                htmlFor="new-password"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Nueva contraseña</span>
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="min-h-[44px] w-full pl-3.5 pr-10 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  aria-label={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Indicador de longitud */}
              <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isLengthValid ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                <span className={isLengthValid ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                  Mínimo 6 caracteres {isLengthValid && '✓'}
                </span>
              </div>
            </div>

            {/* Campo 2: Confirmar Contraseña */}
            <div className="space-y-1.5">
              <label 
                htmlFor="confirm-password"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Confirmar contraseña</span>
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="min-h-[44px] w-full pl-3.5 pr-10 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Ver confirmación'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Indicador de coincidencia */}
              {confirmPassword.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${doPasswordsMatch ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className={doPasswordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                    {doPasswordsMatch ? 'Las contraseñas coinciden ✓' : 'Las contraseñas no coinciden'}
                  </span>
                </div>
              )}
            </div>

            {/* Botón de Envío */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando nueva contraseña...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Actualizar Contraseña</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancelar y volver al login</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
