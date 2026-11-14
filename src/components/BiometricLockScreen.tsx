import React, { useState, useEffect, useCallback } from 'react';
import { 
  Fingerprint, 
  Lock, 
  KeyRound, 
  LogOut, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle,
  ScanFace
} from 'lucide-react';
import { User } from '../types';
import { Capacitor } from '@capacitor/core';
import { biometricService, BiometricStatus } from '../lib/capacitor/biometrics';

interface BiometricLockScreenProps {
  currentUser: User;
  onSuccess: () => void;
  onFallbackPassword: () => void;
  onLogout: () => void;
}

export function BiometricLockScreen({
  currentUser,
  onSuccess,
  onFallbackPassword,
  onLogout,
}: BiometricLockScreenProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);

  const performVerification = useCallback(async () => {
    setIsVerifying(true);
    setErrorMessage(null);

    const result = await biometricService.verifyIdentity(
      'Confirma tu identidad para acceder a tus cuentas en SplitFlow'
    );

    setIsVerifying(false);

    if (result.success) {
      onSuccess();
    } else {
      setErrorMessage(result.error || 'Verificacion biometrica no superada. Puedes reintentar o usar tu contrasena.');
    }
  }, [onSuccess]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      onSuccess();
      return;
    }
    biometricService.checkAvailability().then((status) => {
      setBioStatus(status);
    });
    // Disparar verificacion automatica al cargar la pantalla
    performVerification();
  }, [performVerification, onSuccess]);

  const renderBiometricIcon = () => {
    if (bioStatus?.biometryType === 'FACE_AUTHENTICATION') {
      return <ScanFace className="w-10 h-10 text-slate-900 dark:text-slate-100 stroke-[1.5px]" aria-hidden="true" />;
    }
    return <Fingerprint className="w-10 h-10 text-slate-900 dark:text-slate-100 stroke-[1.5px]" aria-hidden="true" />;
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="biometric-lock-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6"
      >
        {/* Marca SplitFlow */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
            <img 
              src="/assets/aistudio/logoSplitflow_5c96e8d4.png" 
              alt="Logo SplitFlow" 
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">
            SplitFlow
          </span>
        </div>

        {/* Icono de Seguridad Biometrica */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-inner">
            {renderBiometricIcon()}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center border-2 border-white dark:border-slate-900">
            <Lock className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
          </div>
        </div>

        {/* Textos descriptivos */}
        <div className="space-y-1.5">
          <h2 id="biometric-lock-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Acceso Biometrico Requerido
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Hola, <span className="font-semibold text-slate-900 dark:text-slate-100">@{currentUser.username || currentUser.name}</span>. Confirma tu huella dactilar o rostro para acceder a tus cuentas.
          </p>
        </div>

        {/* Feedback de error o estado */}
        {errorMessage && (
          <div className="w-full p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-left flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Acciones principales con accesibilidad táctil >= 44x44px */}
        <div className="w-full space-y-2.5 pt-2">
          {/* Boton 1: Reintentar Biometria */}
          <button
            type="button"
            onClick={performVerification}
            disabled={isVerifying}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 disabled:opacity-50"
          >
            {isVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin stroke-[2px]" aria-hidden="true" />
            ) : (
              <Fingerprint className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            )}
            <span>{isVerifying ? 'Verificando...' : 'Reintentar Biometria'}</span>
          </button>

          {/* Boton 2: Iniciar con Contraseña */}
          <button
            type="button"
            onClick={onFallbackPassword}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <KeyRound className="w-4 h-4 text-slate-600 dark:text-slate-400 stroke-[1.75px]" aria-hidden="true" />
            <span>Iniciar con Contrasena</span>
          </button>

          {/* Boton 3: Cambiar de Cuenta / Cerrar Sesion */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[44px] px-4 py-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
            <span>Cambiar de Cuenta (Cerrar Sesion)</span>
          </button>
        </div>

        {/* Nota de Seguridad */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>Proteccion nativa de datos biometricos</span>
        </div>
      </div>
    </div>
  );
}
