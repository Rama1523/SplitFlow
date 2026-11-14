/**
 * SplitFlow — UserProfileModal Component
 * Formulario accesible (WCAG AAA) de edición de perfil de usuario.
 * Targets táctiles >= 44x44px, navegación por teclado y contraste corporativo óptimo.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  User as UserIcon, 
  Mail, 
  Check, 
  Wallet,
  AlertCircle,
  AtSign,
  Globe,
  Trash2,
  AlertTriangle,
  Fingerprint,
  ShieldCheck,
  Loader2,
  Bell,
  Send,
  Flag,
  ImagePlus,
  Film,
  Paperclip
} from 'lucide-react';
import { User } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { Language } from '../i18n/types';
import { LanguageSelector } from './LanguageSelector';
import { CurrencySelector } from './CurrencySelector';
import { sendNotificationEmail, sendBugReport } from '../lib/emailNotifications';
import { Capacitor } from '@capacitor/core';
import { biometricService, BiometricStatus } from '../lib/capacitor/biometrics';
import { 
  validateUsername, 
  sanitizeUsername, 
  detectDangerousUsernameChars, 
  isUsernameAvailableInList,
  sanitizeTextInput,
  validateEmailFormat
} from '../lib/security';

export type ProfileModalTab = 'PROFILE' | 'REPORTS';

interface ReportAttachmentItem {
  id: string;
  file: File;
  previewUrl?: string;
  isVideo: boolean;
}

const MAX_REPORT_FILES = 5;
const MAX_REPORT_TOTAL_BYTES = 8 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAllowedMediaFile(file: File): boolean {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name);
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers?: User[];
  initialTab?: ProfileModalTab;
  checkUsernameAvailability?: (username: string, excludeUserId?: string) => Promise<{ available: boolean; error?: string; cleanUsername: string }>;
  onUpdateUser: (updatedUser: User) => void;
  onDeleteAccount?: () => Promise<{ success: boolean; error?: string } | boolean | void> | void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  allUsers = [],
  initialTab = 'PROFILE',
  onUpdateUser,
  onDeleteAccount,
}: UserProfileModalProps) {
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const [name, setName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username || '');
  const [email, setEmail] = useState(currentUser.email);
  const [incomeStr, setIncomeStr] = useState(String(currentUser.monthlyIncome || 2000));
  const [preferredCurrency, setPreferredCurrency] = useState(currentUser.preferredCurrency || 'EUR');
  const [emailNotifications, setEmailNotifications] = useState(currentUser.emailNotifications !== false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Estado para prueba de envío de correo SMTP
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Pestaña activa dentro del perfil ('PROFILE' | 'REPORTS')
  const [activeTab, setActiveTab] = useState<ProfileModalTab>(initialTab);

  // Estado del módulo de Reportes de incidencias / bugs
  const [reportSubject, setReportSubject] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [reportAttachments, setReportAttachments] = useState<ReportAttachmentItem[]>([]);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const reportFileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado de Autenticación Biométrica Móvil
  const [biometricsActive, setBiometricsActive] = useState(false);
  const [biometricsLoading, setBiometricsLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [biometricFeedback, setBiometricFeedback] = useState<string | null>(null);

  const handleSendTestEmail = async () => {
    const targetEmail = (email || currentUser.email).trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setTestEmailResult({ success: false, message: 'Introduce un correo válido antes de enviar la prueba.' });
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const res = await sendNotificationEmail({
        recipient_email: targetEmail,
        recipient_name: name || currentUser.name,
        subject: 'Prueba de conexión SMTP — SplitFlow',
        title: '¡Servicio de notificaciones operativo!',
        message: `Este es un mensaje de prueba enviado a través de la cuenta oficial SplitflowNoReplay@gmail.com.\n\n` +
          `A partir de este momento recibirás avisos automáticos cuando se registren nuevos gastos, liquidaciones y solicitudes en tus grupos de SplitFlow.`,
      });

      if (res.success) {
        if (res.simulated) {
          setTestEmailResult({
            success: true,
            message: 'Notificación procesada en modo simulado (recuerda configurar SMTP_PASS en Supabase Secrets si usas la Edge Function en producción).',
          });
        } else {
          setTestEmailResult({
            success: true,
            message: `¡Correo de prueba enviado con éxito a ${targetEmail}! Revisa tu bandeja de entrada o spam.`,
          });
        }
      } else {
        setTestEmailResult({
          success: false,
          message: res.error || 'No se pudo enviar el correo de prueba.',
        });
      }
    } catch (err: unknown) {
      setTestEmailResult({
        success: false,
        message: err instanceof Error ? err.message : 'Error inesperado al enviar el correo.',
      });
    } finally {
      setIsSendingTestEmail(false);
      setTimeout(() => setTestEmailResult(null), 8000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteAccount) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res: any = await onDeleteAccount();
      if (res && res.success === false) {
        setDeleteError(res.error || 'No se pudo eliminar la cuenta en Supabase.');
        setIsDeleting(false);
        return;
      }
      setShowDeleteModal(false);
      onClose();
    } catch (err: unknown) {
      setIsDeleting(false);
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar la cuenta.');
    }
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name);
      setUsername(currentUser.username || '');
      setEmail(currentUser.email);
      setIncomeStr(currentUser.monthlyIncome != null && currentUser.monthlyIncome > 0 ? String(currentUser.monthlyIncome) : '');
      setPreferredCurrency(currentUser.preferredCurrency || 'EUR');
      setEmailNotifications(currentUser.emailNotifications !== false);
      setSavedSuccess(false);
      setSecurityWarning(null);
      setFormError(null);
      setUsernameTouched(false);
      setBiometricFeedback(null);
      setDeleteError(null);
      setIsDeleting(false);

      // Cargar estado de biometria exclusivamente en plataforma nativa (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        biometricService.isEnabled().then((active) => setBiometricsActive(active));
        biometricService.checkAvailability().then((status) => setBiometricStatus(status));
      } else {
        setBiometricsActive(false);
        setBiometricStatus(null);
      }
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setReportError(null);
      setReportSuccess(null);
    } else {
      setReportAttachments((prev) => {
        prev.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return [];
      });
      setReportSubject('');
      setReportComment('');
      setReportError(null);
      setReportSuccess(null);
    }
  }, [isOpen, initialTab]);

  const reportTotalBytes = useMemo(
    () => reportAttachments.reduce((acc, item) => acc + item.file.size, 0),
    [reportAttachments]
  );

  const appendReportFiles = (incomingFiles: FileList | File[] | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setReportError(null);
    setReportSuccess(null);

    const incomingArray = Array.from(incomingFiles);
    const validMedia = incomingArray.filter(isAllowedMediaFile);
    if (validMedia.length < incomingArray.length) {
      setReportError(t('reports.errorInvalidType'));
    }

    if (validMedia.length === 0) return;

    setReportAttachments((prev) => {
      const next = [...prev];
      let currentBytes = prev.reduce((acc, item) => acc + item.file.size, 0);

      for (const file of validMedia) {
        if (next.length >= MAX_REPORT_FILES || currentBytes + file.size > MAX_REPORT_TOTAL_BYTES) {
          setReportError(t('reports.errorSizeLimit'));
          break;
        }
        const isVideo =
          file.type.startsWith('video/') ||
          /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name);
        const previewUrl = !isVideo ? URL.createObjectURL(file) : undefined;
        next.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl,
          isVideo,
        });
        currentBytes += file.size;
      }

      return next;
    });
  };

  const handleRemoveReportAttachment = (attachmentId: string) => {
    setReportAttachments((prev) => {
      const target = prev.find((item) => item.id === attachmentId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== attachmentId);
    });
    setReportError(null);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError(null);
    setReportSuccess(null);

    const cleanSubject = sanitizeTextInput(reportSubject, 120);
    const cleanComment = reportComment.trim();

    if (!cleanSubject || !cleanComment) {
      setReportError(t('reports.errorRequired'));
      return;
    }

    if (reportAttachments.length > MAX_REPORT_FILES || reportTotalBytes > MAX_REPORT_TOTAL_BYTES) {
      setReportError(t('reports.errorSizeLimit'));
      return;
    }

    setIsSendingReport(true);
    try {
      const res = await sendBugReport({
        user: currentUser,
        subject: cleanSubject,
        comment: cleanComment,
        files: reportAttachments.map((item) => item.file),
      });

      if (!res.success) {
        if (res.error === 'validation_required') {
          setReportError(t('reports.errorRequired'));
        } else if (res.error === 'size_or_count_exceeded') {
          setReportError(t('reports.errorSizeLimit'));
        } else {
          setReportError(t('reports.errorGeneric'));
        }
        return;
      }

      reportAttachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setReportAttachments([]);
      setReportSubject('');
      setReportComment('');
      setReportSuccess(t('reports.success'));
    } catch {
      setReportError(t('reports.errorGeneric'));
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    setBiometricsLoading(true);
    setBiometricFeedback(null);
    try {
      const ok = await biometricService.setEnabled(enabled);
      if (ok) {
        setBiometricsActive(enabled);
        setBiometricFeedback(
          enabled
            ? 'Acceso biometrico activado correctamente. Se solicitara huella o rostro al abrir SplitFlow.'
            : 'Acceso biometrico desactivado.'
        );
      } else {
        setBiometricFeedback('No se pudo verificar la huella o rostro. El ajuste permanece sin cambios.');
      }
    } catch (err) {
      console.warn('Biometric toggle error:', err);
      setBiometricFeedback('Error al configurar la biometria.');
    } finally {
      setBiometricsLoading(false);
      setTimeout(() => setBiometricFeedback(null), 4000);
    }
  };

  // Validación y unicidad en tiempo real del nombre de usuario
  const usernameStatus = useMemo(() => {
    const raw = username.trim();
    if (!raw) {
      return {
        isValid: false,
        status: 'empty' as const,
        message: 'El nombre de usuario es obligatorio.',
        cleanUsername: '',
      };
    }

    const val = validateUsername(raw);
    if (!val.isValid) {
      return {
        isValid: false,
        status: 'invalid' as const,
        message: val.error || 'Formato de usuario no válido',
        cleanUsername: val.cleanUsername,
      };
    }

    // Si coincide con su propio usuario actual
    const currentClean = sanitizeUsername(currentUser.username || '');
    if (currentClean && currentClean === val.cleanUsername) {
      return {
        isValid: true,
        status: 'current' as const,
        message: 'Tu nombre de usuario actual',
        cleanUsername: val.cleanUsername,
      };
    }

    // Comprobar unicidad frente a los demás usuarios
    const isAvailable = isUsernameAvailableInList(val.cleanUsername, allUsers, currentUser.id);
    if (!isAvailable) {
      return {
        isValid: false,
        status: 'taken' as const,
        message: `El usuario @${val.cleanUsername} ya está ocupado por otro participante.`,
        cleanUsername: val.cleanUsername,
      };
    }

    return {
      isValid: true,
      status: 'available' as const,
      message: `Disponible: @${val.cleanUsername}`,
      cleanUsername: val.cleanUsername,
    };
  }, [username, allUsers, currentUser]);

  const handleUsernameChange = (inputVal: string) => {
    setUsernameTouched(true);
    setFormError(null);
    const rawWithoutAt = inputVal.replace(/^@+/, '');
    const dangerous = detectDangerousUsernameChars(rawWithoutAt);
    if (dangerous.hasDangerousChars) {
      setSecurityWarning('Saneamiento de seguridad: comillas y delimitadores de inyección bloqueados.');
    } else {
      setSecurityWarning(null);
    }
    const clean = sanitizeUsername(inputVal);
    setUsername(clean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = sanitizeTextInput(name, 60);
    if (!cleanName) {
      setFormError('El nombre completo no puede estar vacío.');
      return;
    }

    if (!usernameStatus.isValid) {
      setFormError(usernameStatus.message);
      return;
    }

    const cleanEmail = sanitizeTextInput(email).toLowerCase();
    if (!cleanEmail) {
      setFormError('El correo electrónico es obligatorio.');
      return;
    }
    if (!validateEmailFormat(cleanEmail)) {
      setFormError('Introduce un correo electrónico válido.');
      return;
    }

    const isEmailTaken = allUsers.some(
      (u) => u.id !== currentUser.id && u.email.trim().toLowerCase() === cleanEmail
    );
    if (isEmailTaken) {
      setFormError('Este correo electrónico ya está registrado por otro usuario.');
      return;
    }

    let cleanIncome: number | undefined = undefined;
    if (incomeStr.trim()) {
      const parsed = parseFloat(incomeStr);
      if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
        cleanIncome = Math.round(Math.min(1000000, parsed) * 100) / 100;
      }
    }

    const updatedUser: User = {
      ...currentUser,
      name: cleanName,
      username: usernameStatus.cleanUsername,
      email: cleanEmail,
      monthlyIncome: cleanIncome,
      preferredCurrency: preferredCurrency.toUpperCase(),
      emailNotifications,
    };

    try {
      onUpdateUser(updatedUser);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar los cambios.');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              {activeTab === 'REPORTS' ? (
                <Flag className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              ) : (
                <UserIcon className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 id="user-profile-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {activeTab === 'REPORTS' ? t('reports.title') : t('profile.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeTab === 'REPORTS' ? t('reports.subtitle') : t('profile.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <X className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
          </button>
        </div>

        {/* Selector de Pestañas dentro de Perfil: Datos del Perfil | Reportes */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 shrink-0">
          <div
            role="tablist"
            aria-label={t('profile.title')}
            className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'PROFILE'}
              onClick={() => setActiveTab('PROFILE')}
              className={`min-h-[40px] flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'PROFILE'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 stroke-[1.75px] shrink-0" aria-hidden="true" />
              <span className="truncate">{t('reports.profileTab')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'REPORTS'}
              onClick={() => setActiveTab('REPORTS')}
              className={`min-h-[40px] flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'REPORTS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Flag className="w-3.5 h-3.5 stroke-[1.75px] shrink-0" aria-hidden="true" />
              <span className="truncate">{t('reports.tab')}</span>
            </button>
          </div>
        </div>

        {/* Pestaña 1: Formulario de Perfil */}
        {activeTab === 'PROFILE' ? (
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Mensaje de error general si falla validación o guardado */}
          {formError && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75px]" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {/* Tarjeta de Identificación */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono font-semibold flex items-center justify-center text-sm shrink-0">
              {(name || currentUser.name).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {name || currentUser.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {email || currentUser.email}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {username && (
                  <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    @{username}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Campos con Target Táctil >= 44x44px */}
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                {t('profile.fullName')}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[1.75px]" aria-hidden="true" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label 
                  htmlFor="profile-username"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <AtSign className="w-3.5 h-3.5 text-slate-400 stroke-[1.75px]" aria-hidden="true" />
                    <span>Nombre de Usuario (@)</span>
                  </span>
                  {username && (
                    <span className={`text-[10px] font-mono font-medium ${
                      usernameStatus.isValid 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {usernameStatus.isValid ? 'Válido' : 'No disponible'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="text-slate-400 absolute left-3.5 top-3 text-xs font-mono font-medium select-none" aria-hidden="true">
                    @
                  </span>
                  <input
                    id="profile-username"
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="usuario"
                    aria-invalid={usernameTouched && !usernameStatus.isValid}
                    aria-describedby="profile-username-desc"
                    className={`min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border rounded-md pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus-visible:outline-none focus-visible:ring-1 ${
                      usernameTouched && username
                        ? usernameStatus.isValid
                          ? 'border-emerald-500 dark:border-emerald-600 focus-visible:ring-emerald-600'
                          : 'border-rose-500 dark:border-rose-600 focus-visible:ring-rose-600'
                        : 'border-slate-200 dark:border-slate-700 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100'
                    }`}
                  />
                </div>

                {/* Advertencia de Caracteres Peligrosos */}
                {securityWarning && (
                  <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span>{securityWarning}</span>
                  </div>
                )}

                {/* Feedback de disponibilidad en tiempo real */}
                {username && !securityWarning && (
                  <p 
                    id="profile-username-desc"
                    className={`text-[11px] font-mono font-medium flex items-center gap-1.5 ${
                      usernameStatus.isValid
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {usernameStatus.isValid ? (
                      <Check className="w-3.5 h-3.5 shrink-0 stroke-[2px]" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{usernameStatus.message}</span>
                  </p>
                )}

                {!usernameTouched && !username && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    3 a 24 caracteres (a-z, 0-9, _ y -).
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  {t('profile.email')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[1.75px]" aria-hidden="true" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@dominio.com"
                    className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Guardado para notificaciones, invitaciones y recuperación. Para iniciar sesión sólo necesitas tu usuario.
                </p>
              </div>
            </div>

            {/* Ingresos Mensuales para Reparto Proporcional (Opcional) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  {t('profile.monthlyIncome')}
                </label>
                <span className="text-[11px] font-mono text-slate-400">Opcional</span>
              </div>
              <div className="relative">
                <Wallet className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[1.75px]" aria-hidden="true" />
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="Opcional (ej. 2000)"
                  value={incomeStr}
                  onChange={(e) => setIncomeStr(e.target.value)}
                  className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-3 py-2 text-xs font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('profile.incomeHint')} Déjalo en blanco si prefieres no registrar ingresos.
              </p>
            </div>
          </div>

          {/* Preferencias de Idioma y Divisa */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
              <span>Preferencias de Idioma y Divisa</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <LanguageSelector
                  value={language}
                  onChange={(newLang) => setLanguage(newLang)}
                  label={t('common.language')}
                />
              </div>
              <div>
                <CurrencySelector
                  value={preferredCurrency}
                  onChange={setPreferredCurrency}
                  label={t('common.currency')}
                />
              </div>
            </div>

            {/* Notificaciones por Correo Electrónico (Resend / Edge Functions) */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 text-slate-900 dark:text-slate-100 mt-0.5 shadow-2xs">
                    <Bell className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Notificaciones por correo electrónico
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Recibe avisos automáticos cuando se añadan nuevos gastos, se desglosen cuentas o se registren liquidaciones en tus grupos.
                    </p>
                  </div>
                </div>

                {/* Toggle switch accesible (min-h-[44px] min-w-[44px]) */}
                <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center shrink-0">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    aria-label="Activar notificaciones por correo electrónico"
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-slate-900"></div>
                </label>
              </div>

              {/* Botón para probar la conexión SMTP / Edge Function */}
              {emailNotifications && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Servidor SMTP oficial: <strong className="font-mono text-slate-700 dark:text-slate-300 font-semibold">SplitflowNoReplay@gmail.com</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={isSendingTestEmail}
                    className="min-h-[36px] px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                  >
                    {isSendingTestEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Enviando prueba...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
                        <span>Enviar correo de prueba</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Feedback del envío de prueba */}
              {testEmailResult && (
                <div
                  className={`mt-2.5 p-2.5 rounded-md text-[11px] flex items-start gap-2 animate-in fade-in ${
                    testEmailResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {testEmailResult.success ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span className="leading-relaxed">{testEmailResult.message}</span>
                </div>
              )}
            </div>

            {/* Seguridad y Autenticacion Biometrica Movil (Exclusivo para plataforma nativa Android/iOS) */}
            {Capacitor.isNativePlatform() && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-900 dark:text-slate-100 mt-0.5">
                        <Fingerprint className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Acceso con Huella / Biometria
                          </p>
                          {biometricStatus?.isAvailable && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {biometricStatus.label}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          Solicita autenticacion por huella dactilar o rostro antes de mostrar el dashboard al abrir la app en movil.
                        </p>
                      </div>
                    </div>

                    {/* Toggle switch accesible (min-h-[44px] min-w-[44px]) */}
                    <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center shrink-0">
                      <input
                        type="checkbox"
                        checked={biometricsActive}
                        disabled={biometricsLoading}
                        onChange={(e) => handleToggleBiometrics(e.target.checked)}
                        aria-label="Activar acceso con Huella o Biometria"
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-slate-900"></div>
                    </label>
                  </div>

                  {biometricsLoading && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <Loader2 className="w-3 h-3 animate-spin text-slate-500" aria-hidden="true" />
                      <span>Configurando sensor biometrico...</span>
                    </div>
                  )}

                  {biometricFeedback && (
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5 animate-in fade-in">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>{biometricFeedback}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Zona de Peligro: Eliminar cuenta */}
            {onDeleteAccount && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                      {t('profile.deleteAccount')}
                    </p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                      {t('profile.deleteAccountHint')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="min-h-[44px] px-3.5 py-2 rounded-md bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white text-xs font-semibold transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline mr-1.5 stroke-[2px]" aria-hidden="true" />
                    <span>{t('profile.deleteAccount')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!usernameStatus.isValid}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white stroke-[2px]" aria-hidden="true" />
                  <span>{t('common.saved') || 'Guardado'}</span>
                </>
              ) : (
                <span>{t('profile.save')}</span>
              )}
            </button>
          </div>
        </form>
        ) : (
        /* Pestaña 2: Formulario de Reportes de Incidencias / Bugs */
        <form onSubmit={handleSubmitReport} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {reportError && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.75px]" aria-hidden="true" />
              <span>{reportError}</span>
            </div>
          )}

          {reportSuccess && (
            <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-start gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400 stroke-[2px]" aria-hidden="true" />
              <span>{reportSuccess}</span>
            </div>
          )}

          {/* Campo Asunto */}
          <div className="space-y-1.5">
            <label htmlFor="bug-report-subject" className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              {t('reports.subjectLabel')}
            </label>
            <input
              id="bug-report-subject"
              type="text"
              required
              maxLength={120}
              value={reportSubject}
              onChange={(e) => {
                setReportSubject(e.target.value);
                if (reportError) setReportError(null);
              }}
              placeholder={t('reports.subjectPlaceholder')}
              className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            />
          </div>

          {/* Campo Comentario */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="bug-report-comment" className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                {t('reports.commentLabel')}
              </label>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {reportComment.length}/2500
              </span>
            </div>
            <textarea
              id="bug-report-comment"
              required
              rows={5}
              maxLength={2500}
              value={reportComment}
              onChange={(e) => {
                setReportComment(e.target.value);
                if (reportError) setReportError(null);
              }}
              placeholder={t('reports.commentPlaceholder')}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed resize-y min-h-[120px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            />
          </div>

          {/* Adjuntar Imágenes o Vídeos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                <span>{t('reports.attachmentsLabel')}</span>
              </label>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {reportAttachments.length}/{MAX_REPORT_FILES} · {formatFileSize(reportTotalBytes)} / 8 MB
              </span>
            </div>

            <input
              ref={reportFileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                appendReportFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFiles(false);
                appendReportFiles(e.dataTransfer.files);
              }}
              className={`rounded-lg border border-dashed p-4 text-center transition ${
                isDraggingFiles
                  ? 'border-slate-900 dark:border-slate-100 bg-slate-100 dark:bg-slate-800/60'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
              }`}
            >
              <button
                type="button"
                disabled={reportAttachments.length >= MAX_REPORT_FILES || isSendingReport}
                onClick={() => reportFileInputRef.current?.click()}
                className="min-h-[44px] w-full flex flex-col sm:flex-row items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <ImagePlus className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                  <Film className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                </span>
                <span>{t('reports.addFiles')}</span>
              </button>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {t('reports.attachmentsHint')}
              </p>
            </div>

            {/* Lista de archivos adjuntos */}
            {reportAttachments.length > 0 && (
              <ul className="space-y-2 pt-1" aria-label={t('reports.attachmentsLabel')}>
                {reportAttachments.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.isVideo ? (
                        <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <Film className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                        </div>
                      ) : (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.file.name}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveReportAttachment(item.id)}
                      aria-label={`${t('common.delete')} ${item.file.name}`}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                    >
                      <X className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Botones de Acción de Reportes */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSendingReport}
              className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSendingReport || !reportSubject.trim() || !reportComment.trim()}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              {isSendingReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{t('reports.sending')}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 stroke-[2px]" aria-hidden="true" />
                  <span>{t('reports.submit')}</span>
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>

      {/* Modal de Advertencia y Confirmación de Eliminación de Cuenta */}
      {showDeleteModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-lg shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[2px]" aria-hidden="true" />
              </div>
              <div>
                <h3 id="delete-account-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t('profile.deleteAccount')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Confirmación de pérdida irreversible
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
              {t('profile.deleteAccountWarning')}
            </div>

            {deleteError && (
              <div className="p-3 rounded-md bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-900 dark:text-rose-200 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="font-medium">{deleteError}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Trash2 className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                <span>{isDeleting ? 'Eliminando...' : t('profile.confirmDeleteAccount')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
