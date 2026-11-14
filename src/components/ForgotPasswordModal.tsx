import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  KeyRound, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  RotateCw, 
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { validatePasswordSecurity, sanitizeTextInput } from '../lib/security';
import { useI18n } from '../i18n/I18nContext';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestReset: (identifier: string, redirectTo?: string) => Promise<{ success: boolean; email?: string; error?: string }>;
  onVerifyOtp?: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  onConfirmReset: (email: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  onSuccessLogin: () => void;
  initialEmail?: string;
}

type Step = 'REQUEST' | 'VERIFY_OTP' | 'SET_NEW_PASSWORD' | 'SUCCESS';

export function ForgotPasswordModal({
  isOpen,
  onClose,
  onRequestReset,
  onVerifyOtp,
  onConfirmReset,
  onSuccessLogin,
  initialEmail = '',
}: ForgotPasswordModalProps) {
  const { t } = useI18n();

  // Estados del flujo progresivo en 3 pasos:
  // Paso 1 (REQUEST): Ingreso de usuario o correo para enviar código desde SplitflowNoReplay@gmail.com
  // Paso 2 (VERIFY_OTP): Ingreso y validación del código numérico aleatorio de 6 dígitos
  // Paso 3 (SET_NEW_PASSWORD): Una vez verificado, solicitar cambiar y confirmar la nueva contraseña
  // Paso 4 (SUCCESS): Confirmación exitosa e inicio de sesión
  const [step, setStep] = useState<Step>('REQUEST');
  const [identifier, setIdentifier] = useState(initialEmail);
  const [targetEmail, setTargetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Estados de OTP (6 casillas numéricas independientes)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Estados de Nueva Contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Temporizador para el reenvío de OTP (60 segundos)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Inicialización al abrir el modal
  useEffect(() => {
    if (isOpen) {
      if (initialEmail) {
        setIdentifier(initialEmail);
      }
      setStep('REQUEST');
      setErrorMsg(null);
      setSuccessToast(null);
      setOtpDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setTargetEmail('');
    }
  }, [isOpen, initialEmail]);

  // Validación de seguridad de la nueva contraseña
  const pwdSecurity = useMemo(() => {
    return validatePasswordSecurity(newPassword);
  }, [newPassword]);

  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  if (!isOpen) return null;

  // ============================================================================
  // PASO 1: SOLICITUD DE CÓDIGO OTP (DESDE SplitflowNoReplay@gmail.com)
  // ============================================================================
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanInput = sanitizeTextInput(identifier).toLowerCase();
    if (!cleanInput) {
      setErrorMsg('Por favor introduce tu nombre de usuario o correo electrónico.');
      return;
    }

    setIsLoading(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const resetUrl = `${origin}/reset-password`;
      const res = await onRequestReset(cleanInput, resetUrl);
      if (res.success) {
        const resolved = res.email || cleanInput;
        setTargetEmail(resolved);
        setStep('VERIFY_OTP');
        setResendCooldown(60);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 150);
      } else {
        setErrorMsg(res.error || 'No se pudo enviar el código. Verifica los datos indicados.');
      }
    } catch {
      setErrorMsg('Error de conexión al enviar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar código OTP numérico
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const cleanEmail = sanitizeTextInput(targetEmail || identifier).toLowerCase();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const resetUrl = `${origin}/reset-password`;
      const res = await onRequestReset(cleanEmail, resetUrl);
      if (res.success) {
        setResendCooldown(60);
        setSuccessToast('Se ha reenviado un nuevo código de 6 dígitos desde SplitflowNoReplay@gmail.com.');
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setErrorMsg(res.error || 'No se pudo reenviar el código de recuperación.');
      }
    } catch {
      setErrorMsg('Error de conexión al solicitar el reenvío.');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // MANIPULACIÓN DE CASILLAS OTP (6 DÍGITOS)
  // ============================================================================
  const handleDigitChange = (index: number, val: string) => {
    setErrorMsg(null);
    const numericChar = val.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = numericChar;
    setOtpDigits(newDigits);

    if (numericChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // ============================================================================
  // PASO 2: VERIFICACIÓN DEL CÓDIGO OTP DE 6 DÍGITOS
  // ============================================================================
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const token = otpDigits.join('');
    if (token.length < 6) {
      setErrorMsg('Debes introducir los 6 dígitos del código de verificación recibido.');
      return;
    }

    setIsLoading(true);
    try {
      const emailToVerify = targetEmail || identifier;
      if (onVerifyOtp) {
        const res = await onVerifyOtp(emailToVerify, token);
        if (res.success) {
          setSuccessToast('Código de 6 dígitos verificado con éxito.');
          setStep('SET_NEW_PASSWORD');
        } else {
          setErrorMsg(res.error || 'El código de 6 dígitos introducido es incorrecto o ha caducado.');
        }
      } else {
        // Si no hay callback específico, verificar directamente con confirm
        setStep('SET_NEW_PASSWORD');
      }
    } catch {
      setErrorMsg('Error al verificar el código. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // PASO 3: ESTABLECER Y CONFIRMAR NUEVA CONTRASEÑA TRAS VERIFICAR
  // ============================================================================
  const handleConfirmPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const token = otpDigits.join('');
    if (token.length < 6) {
      setErrorMsg('Falta el código de verificación.');
      setStep('VERIFY_OTP');
      return;
    }

    if (!pwdSecurity.isValid) {
      setErrorMsg('La nueva contraseña no cumple con los criterios mínimos de seguridad.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanEmail = sanitizeTextInput(targetEmail || identifier).toLowerCase();
      const res = await onConfirmReset(cleanEmail, token, newPassword);
      if (res.success) {
        setStep('SUCCESS');
        setSuccessToast('Contraseña actualizada con éxito.');
        // Auto-cierre y redirección fluida tras confirmar en Supabase
        setTimeout(() => {
          onSuccessLogin();
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.error || 'No se pudo actualizar la contraseña. Verifica el código o solicita uno nuevo.');
      }
    } catch {
      setErrorMsg('Ocurrió un error al procesar la actualización de contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-center">
              <KeyRound className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="forgot-password-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                {step === 'REQUEST' && 'Recuperar Contraseña'}
                {step === 'VERIFY_OTP' && 'Verificar Código de 6 Dígitos'}
                {step === 'SET_NEW_PASSWORD' && 'Cambiar y Confirmar Contraseña'}
                {step === 'SUCCESS' && '¡Contraseña Actualizada!'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {step === 'REQUEST' && 'Paso 1 de 3: Solicitud'}
                {step === 'VERIFY_OTP' && 'Paso 2 de 3: Verificación'}
                {step === 'SET_NEW_PASSWORD' && 'Paso 3 de 3: Nueva Contraseña'}
                {step === 'SUCCESS' && 'Finalizado'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
          </button>
        </div>

        {/* Contenedor de formulario */}
        <div className="p-5 space-y-4">
          
          {/* Alertas de error */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Toast / Alerta informativa de éxito */}
          {successToast && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>{successToast}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 1: FORMULARIO PARA INGRESAR USUARIO O CORREO             */}
          {/* ============================================================== */}
          {step === 'REQUEST' && (
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Mail className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span>Envío oficial mediante SplitflowNoReplay</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Ingresa tu nombre de usuario o tu correo electrónico. Te enviaremos un código numérico aleatorio de 6 dígitos desde <strong className="font-mono text-slate-900 dark:text-white">SplitflowNoReplay@gmail.com</strong> para verificar tu identidad.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>Usuario o correo electrónico</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="usuario o usuario@correo.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !identifier.trim()}
                  className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-md transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>{isLoading ? 'Enviando código...' : 'Enviar código de 6 dígitos'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* PASO 2: VERIFICACIÓN DEL CÓDIGO OTP (6 DÍGITOS)               */}
          {/* ============================================================== */}
          {step === 'VERIFY_OTP' && (
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              {/* Información del correo receptor */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs truncate">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Código enviado a:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white truncate block">
                      {targetEmail || identifier}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('REQUEST')}
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white font-medium underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                    <span>Cambiar</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Revisa tu bandeja de entrada o spam. El correo ha sido remitido desde <strong className="font-mono text-slate-800 dark:text-slate-200">SplitflowNoReplay@gmail.com</strong> con tu código de 6 dígitos.
                </p>
              </div>

              {/* Casillas de código numérico OTP */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Código de verificación (6 dígitos)
                  </label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isLoading}
                    className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCw className="w-3 h-3" aria-hidden="true" />
                    <span>
                      {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-1" onPaste={handleDigitPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      aria-label={`Dígito ${idx + 1}`}
                      className="w-11 sm:w-12 h-12 text-center text-lg font-bold font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 shadow-2xs"
                    />
                  ))}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('REQUEST')}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || otpDigits.join('').length < 6}
                  className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-md transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>{isLoading ? 'Verificando...' : 'Verificar código'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* PASO 3: CAMBIAR Y CONFIRMAR LA CONTRASEÑA DE LA CUENTA        */}
          {/* ============================================================== */}
          {step === 'SET_NEW_PASSWORD' && (
            <form onSubmit={handleConfirmPasswordSubmit} className="space-y-4">
              
              {/* Badge de código verificado */}
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold block">Código verificado con éxito</span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Establece tu nueva contraseña para <span className="font-mono font-bold">{targetEmail || identifier}</span>
                  </span>
                </div>
              </div>

              {/* Campos de Contraseña */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      <span>Nueva contraseña</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      <span>Confirmar nueva contraseña</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showConfirmPassword ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="min-h-[44px] w-full px-3.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                  />
                </div>

                {/* Indicador de coincidencia */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${doPasswordsMatch ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className={doPasswordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                      {doPasswordsMatch ? 'Las contraseñas coinciden ✓' : 'Las contraseñas no coinciden'}
                    </span>
                  </div>
                )}

                {/* Indicadores de requisitos de contraseña */}
                <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                    Requisitos mínimos de seguridad
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${pwdSecurity.hasMinLength ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
                      <span>8+ caracteres</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdSecurity.hasUppercase ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
                      <span>Mayúscula</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdSecurity.hasNumber ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
                      <span>Número</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdSecurity.hasSpecialChar ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
                      <span>Especial (#@!)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('VERIFY_OTP')}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !pwdSecurity.isValid || !doPasswordsMatch}
                  className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-md transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>{isLoading ? 'Guardando...' : 'Cambiar y confirmar contraseña'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* CONFIRMACIÓN EXITOSA Y ACCESO DIRECTO                         */}
          {/* ============================================================== */}
          {step === 'SUCCESS' && (
            <div className="py-6 text-center space-y-3 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-6 h-6 stroke-[2.5px]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ¡Contraseña actualizada con éxito!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Tus nuevas credenciales han sido verificadas en Supabase. Redirigiendo a tu cuenta...
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
