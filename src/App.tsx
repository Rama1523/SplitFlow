/**
 * SplitFlow — Main Application Shell
 * Gestor Inteligente de Gastos Compartidos y Presupuesto del Hogar
 * Soporte Completo: 
 * - 5 Idiomas: Español, English, Français, Deutsch, Italiano
 * - Múltiples divisas: Euros, Pesos (todos los tipos oficiales vigentes), Libras y Dólares
 * - Modo Claro y Modo Oscuro (Paleta Nórdica Mint & Slate)
 * - Acceso directo instantáneo y Zero Emojis
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Receipt, 
  Wallet, 
  PiggyBank, 
  Sparkles, 
  Users, 
  Share2, 
  Home,
  Plane,
  Heart,
  PartyPopper,
  Package,
  Sun,
  Moon,
  UserPlus,
  KeyRound,
  Mail,
  LogOut,
  Copy,
  Check,
  Trash2,
  Calendar,
  Crown,
  ShieldCheck
} from 'lucide-react';

import { MOCK_CATEGORIES } from './store/mock-data';
import { Group, User } from './types';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import { UserNavDropdown } from './components/UserNavDropdown';
import { UserProfileModal } from './components/UserProfileModal';
import { RequestsModal } from './components/RequestsModal';
import { GroupSelectorDropdown } from './components/GroupSelectorDropdown';
import { CreateGroupModal } from './components/CreateGroupModal';
import { JoinGroupModal } from './components/JoinGroupModal';
import { LeaveGroupModal } from './components/LeaveGroupModal';
import { TransferAdminModal } from './components/TransferAdminModal';
import { GroupMembersModal } from './components/GroupMembersModal';
import { RemoveMemberModal } from './components/RemoveMemberModal';
import { DeleteGroupModal } from './components/DeleteGroupModal';
import { GroupSettingsDropdown } from './components/GroupSettingsDropdown';
import { GroupBudgetSettingsModal } from './components/GroupBudgetSettingsModal';
import { AddExpenseModal } from './components/AddExpenseModal';
import { BalancesAndSettlement } from './components/BalancesAndSettlement';
import { ExpenseList } from './components/ExpenseList';
import { BudgetOverview } from './components/BudgetOverview';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { ExportSummaryModal } from './components/ExportSummaryModal';
import { DownloadApkModal } from './components/DownloadApkModal';
import { FinancialMetricsPanel } from './components/FinancialMetricsPanel';
import { ExpenseHistoryView } from './components/ExpenseHistoryView';
import { NotificationCenterDropdown } from './components/NotificationCenterDropdown';
import { InAppNotificationToast } from './components/InAppNotificationToast';
import { BiometricLockScreen } from './components/BiometricLockScreen';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from './lib/capacitor/secureStorage';
import { calculateUserBalances, calculateOptimalSettlements } from './lib/debt-engine';
import { convertAmount, formatCurrencyAmount, getExchangeRate } from './lib/exchangeRates';
import { getCurrentMonthKey } from './lib/monthly-analytics';
import { useSplitFlowBackend } from './hooks/useSplitFlowBackend';
import { useTheme } from './lib/theme';
import { useI18n } from './i18n/I18nContext';
import { ResetPasswordView } from './components/ResetPasswordView';
import { VerifyEmailView } from './components/VerifyEmailView';

type ViewMode = 'LANDING' | 'APP' | 'AUTH' | 'RESET_PASSWORD' | 'VERIFY_EMAIL';
type NavTab = 'DASHBOARD' | 'EXPENSES' | 'SETTLEMENTS' | 'BUDGET';

export default function App() {
  // Manejo de tema global (claro y oscuro)
  const { theme, toggleTheme } = useTheme();

  // Internacionalización (i18n) y formateo de divisas
  const { t, formatAmount } = useI18n();

  // Hook unificado de backend y sincronización (Supabase PostgreSQL)
  const {
    users,
    allUsers,
    currentUser,
    groups,
    activeGroupId,
    setActiveGroupId,
    expenses,
    settlements,
    requests,
    unreadRequestsCount,
    backendError,
    setBackendError,
    unverifiedEmail,
    setUnverifiedEmail,
    login,
    register,
    resendVerification,
    verifyEmailToken,
    logout,
    deleteAccount,
    updateUser,
    addExpense,
    deleteExpense,
    createGroup,
    joinGroupByCode,
    transferGroupAdmin,
    promoteGroupAdmin,
    revokeGroupAdmin,
    transferSupremeAdmin,
    removeGroupMember,
    leaveGroup,
    deleteGroup,
    updateGroup,
    settleDebt,
    resetSettlements,
    sendGroupInvitation,
    acceptGroupInvitation,
    rejectGroupInvitation,
    cancelGroupInvitation,
    markAllRequestsAsRead,
    searchPublicUsers,
    getContactSuggestions,
    requestPasswordReset,
    verifyPasswordResetOtp,
    updateUserPassword,
    confirmPasswordReset,
  } = useSplitFlowBackend();

  // Control de vista: LANDING (presentación), APP (dashboard), AUTH (login/registro), RESET_PASSWORD, VERIFY_EMAIL
  const [verificationParams, setVerificationParams] = useState<{ token: string; email: string }>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return {
        token: params.get('verify_email') || params.get('token') || '',
        email: params.get('email') || '',
      };
    }
    return { token: '', email: '' };
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      if (search.includes('verify_email=') || path.includes('/verify-email')) {
        return 'VERIFY_EMAIL';
      }
      if (
        path.includes('/reset-password') || 
        hash.includes('type=recovery') || 
        search.includes('type=recovery')
      ) {
        return 'RESET_PASSWORD';
      }
    }
    return 'LANDING';
  });
  const [authInitialMode, setAuthInitialMode] = useState<'LOGIN' | 'REGISTER'>('REGISTER');
  const [authConfirmationMessage, setAuthConfirmationMessage] = useState<string | null>(null);

  // Escuchar cambios en la URL (enlaces directos y botones atrás/adelante)
  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      if (search.includes('verify_email=') || path.includes('/verify-email')) {
        const params = new URLSearchParams(search);
        setVerificationParams({
          token: params.get('verify_email') || params.get('token') || '',
          email: params.get('email') || '',
        });
        setViewMode('VERIFY_EMAIL');
        return;
      }
      if (
        path.includes('/reset-password') || 
        hash.includes('type=recovery') || 
        search.includes('type=recovery')
      ) {
        setViewMode('RESET_PASSWORD');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Redirección estricta / Navigation Guard: si el usuario está autenticado, redirigir y bloquear regreso a landing
  useEffect(() => {
    if (currentUser && viewMode !== 'APP' && viewMode !== 'RESET_PASSWORD' && viewMode !== 'VERIFY_EMAIL') {
      setViewMode('APP');
    }
  }, [currentUser, viewMode]);

  // Estado de Autenticación Biométrica Móvil (Capacitor Native Biometrics - Solo en Android/iOS nativo)
  const [isBiometricsActive, setIsBiometricsActive] = useState(false);
  const [isBiometricallyUnlocked, setIsBiometricallyUnlocked] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setIsBiometricsActive(false);
      setIsBiometricallyUnlocked(true);
      return;
    }
    secureStorage.isBiometricsActive().then((active) => {
      setIsBiometricsActive(active);
      if (!active) {
        setIsBiometricallyUnlocked(true);
      }
    });
  }, [currentUser]);

  // Modales y Navegación dentro del Dashboard
  const [activeTab, setActiveTab] = useState<NavTab>('DASHBOARD');
  const [expenseSubTab, setExpenseSubTab] = useState<'CURRENT' | 'HISTORY'>('CURRENT');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<'PROFILE' | 'REPORTS'>('PROFILE');
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isJoinGroupModalOpen, setIsJoinGroupModalOpen] = useState(false);
  const [isLeaveGroupModalOpen, setIsLeaveGroupModalOpen] = useState(false);
  const [isTransferAdminModalOpen, setIsTransferAdminModalOpen] = useState(false);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [isBudgetSettingsModalOpen, setIsBudgetSettingsModalOpen] = useState(false);
  const [isDownloadApkModalOpen, setIsDownloadApkModalOpen] = useState(false);
  const [isGroupMembersModalOpen, setIsGroupMembersModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<User | null>(null);

  // Helper para renderizar iconos de categoría de grupo sin emojis
  const renderGroupIcon = (category?: string, className = "w-4 h-4") => {
    const strokeClass = `${className} stroke-[1.75px] text-slate-700 dark:text-slate-300`;
    switch (category) {
      case 'HOME': return <Home className={strokeClass} aria-hidden="true" />;
      case 'TRIP': return <Plane className={strokeClass} aria-hidden="true" />;
      case 'COUPLE': return <Heart className={strokeClass} aria-hidden="true" />;
      case 'EVENT': return <PartyPopper className={strokeClass} aria-hidden="true" />;
      default: return <Package className={strokeClass} aria-hidden="true" />;
    }
  };

  // Grupo Activo
  const activeGroup = useMemo(() => {
    return groups.find((g) => g.id === activeGroupId) || groups[0];
  }, [groups, activeGroupId]);

  // Determinar si el usuario actual es el Administrador Supremo del grupo activo
  const isCurrentUserSupremeAdmin = useMemo(() => {
    if (!activeGroup || !currentUser) return false;
    const supremeId = activeGroup.adminId || activeGroup.created_by;
    return currentUser.id === supremeId;
  }, [activeGroup, currentUser]);

  // Determinar si el usuario actual es administrador del grupo activo (hasta 4 por grupo)
  const isCurrentUserAdmin = useMemo(() => {
    if (!activeGroup || !currentUser) return false;
    return (
      activeGroup.adminId === currentUser.id ||
      (!activeGroup.adminId && activeGroup.created_by === currentUser.id) ||
      activeGroup.members.some((m) => m.id === currentUser.id && m.role === 'admin')
    );
  }, [activeGroup, currentUser]);

  // Divisa activa del grupo (ej: EUR, ARS, CLP, COP, CUP, DOP, MXN, PHP, UYU, GBP, USD, etc.)
  const currentCurrency = activeGroup?.currency || 'EUR';

  // Miembros sincronizados del grupo activo
  const currentGroupMembers = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.members.map((m) => users.find((u) => u.id === m.id) || m);
  }, [activeGroup, users]);

  // Gastos específicos del grupo activo
  const currentGroupExpenses = useMemo(() => {
    if (!activeGroup) return [];
    return expenses.filter((e) => e.groupId === activeGroup.id);
  }, [expenses, activeGroup]);

  // Liquidaciones específicas de miembros de este grupo con aislamiento por groupId
  const currentGroupSettlements = useMemo(() => {
    if (!activeGroup) return [];
    const memberIds = new Set(currentGroupMembers.map((m) => m.id));
    return settlements.filter((s) => {
      if (s.groupId) {
        return s.groupId === activeGroup.id;
      }
      return memberIds.has(s.fromUserId) && memberIds.has(s.toUserId);
    });
  }, [settlements, activeGroup, currentGroupMembers]);

  // Balances y minimización de deudas reactivos por grupo
  const balances = useMemo(() => {
    return calculateUserBalances(currentGroupMembers, currentGroupExpenses, currentGroupSettlements);
  }, [currentGroupMembers, currentGroupExpenses, currentGroupSettlements]);

  const optimalTransfers = useMemo(() => {
    return calculateOptimalSettlements(currentGroupMembers, balances, currentCurrency);
  }, [currentGroupMembers, balances, currentCurrency]);

  // Balance neto del usuario actual en el grupo activo
  const currentUserBalance = useMemo(() => {
    if (!currentUser) return 0;
    const userBal = balances.find((b) => b.userId === currentUser.id);
    return userBal ? userBal.netBalance : 0;
  }, [balances, currentUser]);

  // Categorías efectivas para el grupo activo (respetando bloques activos y sus límites)
  const groupEffectiveCategories = useMemo(() => {
    if (!activeGroup?.budgetBlocks || activeGroup.budgetBlocks.length === 0) {
      return MOCK_CATEGORIES;
    }
    const activeBlocksMap = new Map(
      activeGroup.budgetBlocks.filter((b) => b.isActive).map((b) => [b.category, b.limit])
    );
    return MOCK_CATEGORIES
      .filter((c) => activeBlocksMap.has(c.type))
      .map((c) => ({
        ...c,
        monthlyBudgetLimit: activeBlocksMap.get(c.type) ?? c.monthlyBudgetLimit,
      }));
  }, [activeGroup]);

  const totalSpent = useMemo(() => {
    return currentGroupExpenses.reduce((acc, exp) => acc + exp.amount, 0);
  }, [currentGroupExpenses]);

  const totalPendingSettlement = useMemo(() => {
    return balances
      .filter((b) => b.netBalance < 0)
      .reduce((sum, b) => sum + Math.abs(b.netBalance), 0);
  }, [balances]);

  // Navegación hacia Registro ("Comenzar ahora")
  const handleOpenRegisterFromLanding = () => {
    if (currentUser) {
      setViewMode('APP');
    } else {
      setAuthInitialMode('REGISTER');
      setViewMode('AUTH');
    }
  };

  // Navegación hacia Inicio de Sesión ("Iniciar sesión")
  const handleOpenLoginFromLanding = () => {
    if (currentUser) {
      setViewMode('APP');
    } else {
      setAuthInitialMode('LOGIN');
      setViewMode('AUTH');
    }
  };

  // ============================================================================
  // RENDER: LANDING PAGE DE PRESENTACIÓN (BLOQUEADO SI ESTÁ LOGUEADO)
  // ============================================================================
  if (viewMode === 'LANDING' && !currentUser) {
    return (
      <>
        <LandingPage
          onOpenRegister={handleOpenRegisterFromLanding}
          onOpenLogin={handleOpenLoginFromLanding}
          onEnterApp={handleOpenRegisterFromLanding}
          onOpenAuth={handleOpenLoginFromLanding}
          onOpenDownloadApk={() => setIsDownloadApkModalOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          confirmationMessage={authConfirmationMessage}
        />
        <DownloadApkModal
          isOpen={isDownloadApkModalOpen}
          onClose={() => setIsDownloadApkModalOpen(false)}
        />
      </>
    );
  }

  // ============================================================================
  // RENDER: VISTA DEDICADA DE VERIFICACIÓN DE CORREO (?verify_email=...)
  // ============================================================================
  if (viewMode === 'VERIFY_EMAIL') {
    return (
      <VerifyEmailView
        token={verificationParams.token}
        email={verificationParams.email}
        onVerifyEmail={verifyEmailToken}
        onResendVerification={resendVerification}
        onBackToLogin={(verifiedInfo) => {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/');
          }
          setBackendError(null);
          setUnverifiedEmail(null);
          setAuthInitialMode('LOGIN');
          if (verifiedInfo?.email) {
            setAuthConfirmationMessage(
              t('auth.emailVerifiedDesc', { email: verifiedInfo.email })
            );
          }
          setViewMode('AUTH');
        }}
      />
    );
  }

  // ============================================================================
  // RENDER: VISTA DEDICADA DE RESTABLECIMIENTO DE CONTRASEÑA (/reset-password)
  // ============================================================================
  if (viewMode === 'RESET_PASSWORD') {
    return (
      <ResetPasswordView
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/');
          }
          setAuthInitialMode('LOGIN');
          setAuthConfirmationMessage('¡Contraseña actualizada con éxito! Inicia sesión con tu nueva contraseña.');
          setViewMode('AUTH');
        }}
        onBackToLogin={() => {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/');
          }
          setAuthInitialMode('LOGIN');
          setViewMode('AUTH');
        }}
      />
    );
  }

  // ============================================================================
  // RENDER: PANTALLA DE AUTENTICACIÓN (LOGIN & REGISTRO DIRECTO)
  // ============================================================================
  if (viewMode === 'AUTH' && !currentUser) {
    return (
      <AuthScreen
        initialMode={authInitialMode}
        availableUsers={users}
        allUsers={allUsers}
        onLogin={async (email, password) => {
          await login(email, password);
          setIsBiometricallyUnlocked(true);
        }}
        onRegister={async (newUser, pwd) => {
          const res = await register(newUser, pwd);
          if (res?.success && !res.requiresEmailConfirmation) {
            setIsBiometricallyUnlocked(true);
            setViewMode('APP');
          }
          return res;
        }}
        onResendVerification={resendVerification}
        onBack={() => {
          setAuthConfirmationMessage(null);
          setBackendError(null);
          setUnverifiedEmail(null);
          setViewMode('LANDING');
        }}
        backendErrorMessage={backendError}
        unverifiedEmail={unverifiedEmail}
        onClearErrors={() => {
          setBackendError(null);
          setUnverifiedEmail(null);
        }}
        confirmationMessage={authConfirmationMessage}
        onRequestPasswordReset={requestPasswordReset}
        onVerifyPasswordResetOtp={verifyPasswordResetOtp}
        onUpdateUserPassword={updateUserPassword}
        onConfirmPasswordReset={confirmPasswordReset}
        onPasswordResetSuccess={() => {
          setIsBiometricallyUnlocked(true);
          setViewMode('APP');
        }}
      />
    );
  }

  // Fallback de usuario si no está logueado en modo aplicación
  if (!currentUser) {
    return (
      <AuthScreen
        initialMode={authInitialMode}
        availableUsers={users}
        allUsers={allUsers}
        onLogin={async (email, password) => {
          await login(email, password);
          setIsBiometricallyUnlocked(true);
        }}
        onRegister={async (newUser, pwd) => {
          const res = await register(newUser, pwd);
          if (res?.success && !res.requiresEmailConfirmation) {
            setIsBiometricallyUnlocked(true);
            setViewMode('APP');
          }
          return res;
        }}
        onResendVerification={resendVerification}
        onBack={() => {
          setAuthConfirmationMessage(null);
          setBackendError(null);
          setUnverifiedEmail(null);
          setViewMode('LANDING');
        }}
        backendErrorMessage={backendError}
        unverifiedEmail={unverifiedEmail}
        onClearErrors={() => {
          setBackendError(null);
          setUnverifiedEmail(null);
        }}
        confirmationMessage={authConfirmationMessage}
        onRequestPasswordReset={requestPasswordReset}
        onVerifyPasswordResetOtp={verifyPasswordResetOtp}
        onUpdateUserPassword={updateUserPassword}
        onConfirmPasswordReset={confirmPasswordReset}
        onPasswordResetSuccess={() => {
          setIsBiometricallyUnlocked(true);
          setViewMode('APP');
        }}
      />
    );
  }

  // ============================================================================
  // RENDER: APLICACIÓN PRINCIPAL / DASHBOARD
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 w-full overflow-x-hidden">
      
      {/* Enlace de accesibilidad para saltar al contenido principal (WCAG AAA) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-teal-800 focus:text-white focus:rounded-xl focus:shadow-xl focus:font-bold focus:outline-none focus:ring-2 focus:ring-teal-400"
      >
        Saltar al contenido principal
      </a>

      {/* 1. Header Global de la Aplicación (z-30, dropdowns en z-40, modales en z-50) */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Lado Izquierdo: Marca SplitFlow con Logo oficial en fondo blanco cuadrado y Selector de grupo */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              type="button"
              onClick={() => {
                if (currentUser) {
                  setActiveTab('DASHBOARD');
                } else {
                  setViewMode('LANDING');
                }
              }}
              className="flex min-h-[44px] min-w-[44px] items-center gap-2.5 cursor-pointer shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100" 
              title="SplitFlow Dashboard"
              aria-label="SplitFlow — Ir al panel principal"
            >
              <div className="h-8 w-8 rounded-md bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-xs shrink-0 overflow-hidden">
                <img 
                  src="/assets/aistudio/logoSplitflow_5c96e8d4.png" 
                  alt="Logo SplitFlow" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 hidden sm:inline">
                SplitFlow
              </span>
            </button>

            {/* Selector de Grupos Accesible con Target Táctil >= 44x44px */}
            <GroupSelectorDropdown
              groups={groups}
              activeGroup={activeGroup}
              onSelectGroup={(g: Group) => setActiveGroupId(g.id)}
              onOpenCreateModal={() => setIsCreateGroupModalOpen(true)}
              onOpenJoinModal={() => setIsJoinGroupModalOpen(true)}
              onOpenLeaveModal={() => setIsLeaveGroupModalOpen(true)}
              onOpenDeleteModal={() => setIsDeleteGroupModalOpen(true)}
            />
          </div>

          {/* Lado Derecho: En móvil ÚNICAMENTE el avatar/menú de usuario; en desktop incluye herramientas auxiliares */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Alternador de Modo Claro / Modo Oscuro (desktop) */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
              className="hidden md:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500 stroke-[1.75px]" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 stroke-[1.75px]" aria-hidden="true" />
              )}
            </button>


            {/* Acciones principales en cabecera desktop */}
            {groups.length > 0 ? (
              <>
                {/* Botón Exportar (desktop) */}
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  aria-label={t('nav.export')}
                  className="hidden md:flex min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition items-center justify-center gap-1.5 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                  title={t('nav.export')}
                >
                  <Share2 className="w-4 h-4 stroke-[1.75px] text-slate-700 dark:text-slate-300" aria-hidden="true" />
                  <span className="hidden lg:inline">{t('nav.export')}</span>
                </button>

                {/* Botón Nuevo Gasto (desktop) */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  aria-label={t('nav.newExpense')}
                  className="hidden md:flex min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition shadow-xs items-center justify-center gap-1.5 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                >
                  <Plus className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                  <span>{t('nav.newExpense')}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateGroupModalOpen(true)}
                className="hidden md:flex min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition shadow-xs items-center justify-center gap-1.5 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <Plus className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                <span>Crear grupo</span>
              </button>
            )}

            {/* Centro de Notificaciones Hibridas In-App (Web + Movil) */}
            <NotificationCenterDropdown
              onOpenRequestsModal={() => setIsRequestsModalOpen(true)}
              onSelectGroup={(gId) => setActiveGroupId(gId)}
              theme={theme}
            />

            {/* Desplegable de Usuario Logueado con Notificación de Solicitudes y Selector de Idioma integrado */}
            <UserNavDropdown
              currentUser={currentUser}
              currency={currentCurrency}
              incomeModuleEnabled={activeGroup?.incomeModuleEnabled ?? false}
              unreadRequestsCount={unreadRequestsCount}
              theme={theme}
              onToggleTheme={toggleTheme}
              onOpenExport={() => setIsExportModalOpen(true)}
              onOpenProfile={() => {
                setProfileInitialTab('PROFILE');
                setIsProfileModalOpen(true);
              }}
              onOpenReports={() => {
                setProfileInitialTab('REPORTS');
                setIsProfileModalOpen(true);
              }}
              onOpenRequests={() => setIsRequestsModalOpen(true)}
              onOpenDownloadApk={() => setIsDownloadApkModalOpen(true)}
              onLogout={() => {
                logout();
                setViewMode('LANDING');
              }}
            />
          </div>

        </div>
      </header>

      {/* 2. Barra de Navegación de Pestañas en Escritorio (>= md) */}
      {groups.length > 0 && (
        <nav 
          aria-label="Navegación principal de escritorio"
          className="hidden md:block border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none py-2" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'DASHBOARD'}
              onClick={() => setActiveTab('DASHBOARD')}
              className={`min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'DASHBOARD'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Wallet className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              <span>{t('nav.dashboard')}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'EXPENSES'}
              onClick={() => setActiveTab('EXPENSES')}
              className={`min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'EXPENSES'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              <span>{t('nav.expenses')}</span>
              <span className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${activeTab === 'EXPENSES' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {currentGroupExpenses.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'SETTLEMENTS'}
              onClick={() => setActiveTab('SETTLEMENTS')}
              className={`min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'SETTLEMENTS'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 stroke-[1.75px] text-amber-500 dark:text-amber-400" aria-hidden="true" />
              <span>{t('nav.settlements')}</span>
              {optimalTransfers.length > 0 && (
                <span className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md font-bold ${activeTab === 'SETTLEMENTS' ? 'bg-emerald-900 text-white' : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'}`}>
                  {optimalTransfers.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'BUDGET'}
              onClick={() => setActiveTab('BUDGET')}
              className={`min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'BUDGET'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <PiggyBank className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              <span>{t('nav.budget')}</span>
            </button>
          </div>
        </nav>
      )}

      {/* 3. Contenedor Principal (con padding inferior amplio pb-28 para respetar barra táctil en móvil) */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 pb-28 md:pb-8 focus:outline-none">
        
        {/* Vista Limpia: Sin grupos aún (Empty State para usuarios nuevos) */}
        {groups.length === 0 ? (
          <div className="max-w-xl mx-auto py-12 sm:py-20 px-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-12 text-center shadow-xs">
              
              {/* Icono corporativo sobrio */}
              <div className="mx-auto w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 mb-5">
                <Users className="w-7 h-7 stroke-[1.75px]" aria-hidden="true" />
              </div>

              {/* Título y descripción */}
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {t('emptyState.noGroupsTitle')}
              </h2>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {t('emptyState.noGroupsDesc')}
              </p>

              {/* Botones prominentes de acción primaria y secundaria */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateGroupModalOpen(true)}
                  className="min-h-[44px] px-6 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                >
                  <Plus className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                  <span>{t('emptyState.createGroupBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsJoinGroupModalOpen(true)}
                  className="min-h-[44px] px-6 py-2.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                >
                  <KeyRound className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                  <span>{t('emptyState.joinWithCodeBtn')}</span>
                </button>
              </div>

              {/* Notificación sutil de invitaciones pendientes si las hay */}
              {unreadRequestsCount > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>{t('emptyState.pendingInvitesNote')}</span>
                  <button
                    type="button"
                    onClick={() => setIsRequestsModalOpen(true)}
                    className="font-semibold text-slate-900 dark:text-slate-100 underline hover:no-underline cursor-pointer ml-1"
                  >
                    {t('emptyState.viewInvitesBtn', { count: unreadRequestsCount })}
                  </button>
                </div>
              )}

            </div>
          </div>
        ) : (
          <>
            {/* Banner de Contexto de Grupo Activo */}
            {activeGroup && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                {renderGroupIcon(activeGroup.category, "w-4 h-4")}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{activeGroup.name}</h2>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold font-mono">
                    {currentCurrency}
                  </span>

                  {currentUser?.preferredCurrency && currentUser.preferredCurrency.toUpperCase() !== currentCurrency.toUpperCase() && (
                    <span 
                      className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-[10px] font-mono font-medium flex items-center gap-1"
                      title={`Conversión automática activa: 1 ${currentCurrency} ≈ ${getExchangeRate(currentCurrency, currentUser.preferredCurrency).toFixed(2)} ${currentUser.preferredCurrency}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{currentUser.preferredCurrency} (1 {currentCurrency} ≈ {getExchangeRate(currentCurrency, currentUser.preferredCurrency).toFixed(2)} {currentUser.preferredCurrency})</span>
                    </span>
                  )}

                  {/* Insignia de rol en el grupo (el código de invitación reside en Ajustes) */}
                  {isCurrentUserSupremeAdmin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                      <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2px]" aria-hidden="true" />
                      <span>{t('roles.supremeAdmin')}</span>
                    </span>
                  ) : isCurrentUserAdmin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                      <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2px]" aria-hidden="true" />
                      <span>{t('roles.admin')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-medium">
                      <ShieldCheck className="w-3 h-3 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>{t('roles.member')}</span>
                    </span>
                  )}
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">{activeGroup.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setIsGroupMembersModalOpen(true)}
                className="flex items-center gap-2 hover:opacity-85 transition cursor-pointer"
                title={t('groupSettings.membersDesc')}
              >
                <div className="flex -space-x-1.5 overflow-hidden">
                  {currentGroupMembers.slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      title={`@${m.username || m.name}${activeGroup.incomeModuleEnabled && m.monthlyIncome ? ` (${formatAmount(m.monthlyIncome, currentCurrency)}/m)` : ''}`}
                      className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300"
                    >
                      {(m.username || m.name).slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono underline decoration-slate-300 dark:decoration-slate-700 hover:decoration-slate-900">
                  {currentGroupMembers.length} {t('metrics.members').toLowerCase()}
                </span>
              </button>

              {/* Menú de Opciones del Grupo con Icono de Engranaje */}
              <GroupSettingsDropdown
                groupName={activeGroup.name}
                isSupremeAdmin={isCurrentUserSupremeAdmin}
                isAdmin={isCurrentUserAdmin}
                memberCount={currentGroupMembers.length}
                inviteCode={activeGroup.inviteCode || activeGroup.codigoGrupo}
                onOpenMembers={() => setIsGroupMembersModalOpen(true)}
                onOpenInvite={() => setIsRequestsModalOpen(true)}
                onOpenTransferAdmin={() => setIsTransferAdminModalOpen(true)}
                onOpenLeaveGroup={() => setIsLeaveGroupModalOpen(true)}
                onOpenDeleteGroup={() => setIsDeleteGroupModalOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Métricas Hero Superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>{t('metrics.totalSpent')}</span>
              <Receipt className="w-4 h-4 stroke-[1.75px] text-slate-600 dark:text-slate-300" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
              {formatAmount(totalSpent, currentCurrency)}
            </p>
            {currentUser?.preferredCurrency && currentUser.preferredCurrency.toUpperCase() !== currentCurrency.toUpperCase() && (
              <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                ≈ {formatCurrencyAmount(convertAmount(totalSpent, currentCurrency, currentUser.preferredCurrency), currentUser.preferredCurrency)}
              </p>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {t('metrics.inExpenses', { count: currentGroupExpenses.length })}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>{t('metrics.pendingSettlement')}</span>
              <Wallet className="w-4 h-4 stroke-[1.75px] text-slate-600 dark:text-slate-300" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-1.5 tabular-nums">
              {formatAmount(totalPendingSettlement, currentCurrency)}
            </p>
            {currentUser?.preferredCurrency && currentUser.preferredCurrency.toUpperCase() !== currentCurrency.toUpperCase() && (
              <p className="text-xs font-mono font-medium text-rose-600/80 dark:text-rose-400/80 mt-0.5 tabular-nums">
                ≈ {formatCurrencyAmount(convertAmount(totalPendingSettlement, currentCurrency, currentUser.preferredCurrency), currentUser.preferredCurrency)}
              </p>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {t('metrics.totalToEven')}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>{t('metrics.optimalTransfers')}</span>
              <Sparkles className="w-4 h-4 stroke-[1.75px] text-slate-600 dark:text-slate-300" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
              {optimalTransfers.length} {t('settlement.title').toLowerCase().split(' ')[0]}
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
              {optimalTransfers.length === 0 ? t('metrics.allSettled') : t('metrics.manualTransfersRoute')}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>{t('metrics.members')}</span>
              <Users className="w-4 h-4 stroke-[1.75px] text-slate-600 dark:text-slate-300" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
              {currentGroupMembers.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {t('metrics.withSalaries')}
            </p>
          </div>
        </div>

        {/* 4. Renderizado según Tab Activa */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Panel de Métricas Financieras y Ciclo Mensual */}
            <FinancialMetricsPanel
              expenses={currentGroupExpenses}
              currency={currentCurrency}
              userPreferredCurrency={currentUser?.preferredCurrency}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              onViewHistory={() => {
                setExpenseSubTab('HISTORY');
                setActiveTab('EXPENSES');
              }}
            />

            {/* GRID ANALÍTICO: Gráfico de Categorías + Tarjeta de Presupuesto del Hogar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Gráficos de Distribución (Donut / Barras) */}
              <div className="lg:col-span-7">
                <AnalyticsCharts
                  expenses={currentGroupExpenses}
                  categories={MOCK_CATEGORIES}
                  currency={currentCurrency}
                />
              </div>

              {/* Tarjeta de Monitoreo de Presupuestos */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-between shadow-xs space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        <PiggyBank className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.groupBudget')}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('BUDGET')}
                      className="min-h-[44px] inline-flex items-center text-xs text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                    >
                      {t('dashboard.viewDetail')} →
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">
                    {activeGroup?.name || 'SplitFlow'}
                  </p>
                </div>

                {/* Barras de progreso por categoría */}
                <div className="space-y-3.5 pt-1">
                  {groupEffectiveCategories.map((cat) => {
                    const spent = currentGroupExpenses
                      .filter((e) => e.category === cat.type)
                      .reduce((sum, e) => sum + e.amount, 0);
                    const limit = cat.monthlyBudgetLimit;
                    const percentage = Math.round((spent / limit) * 100);
                    const isExceeded = spent > limit;
                    const isWarning = !isExceeded && percentage >= 80;

                    return (
                      <div key={cat.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {t(`expCat.${cat.type}`)}
                          </span>
                          <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatAmount(spent, currentCurrency)} / <strong className="text-slate-900 dark:text-slate-100 font-semibold">{formatAmount(limit, currentCurrency)}</strong>
                            <span
                              className={`ml-2 font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${
                                isExceeded
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                                  : isWarning
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
                              }`}
                            >
                              {percentage}%
                            </span>
                          </span>
                        </div>

                        {/* Barra de progreso sobria */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-sm overflow-hidden">
                          <div
                            className={`h-full rounded-sm transition-all duration-300 ${
                              isExceeded
                                ? 'bg-rose-600'
                                : isWarning
                                ? 'bg-amber-500'
                                : 'bg-slate-900 dark:bg-slate-200'
                            }`}
                            style={{ width: `${Math.min(100, percentage)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-sm bg-slate-900 dark:bg-slate-200 inline-block" aria-hidden="true" />
                    <span>{t('budget.statusSafe')}</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" aria-hidden="true" />
                    <span>{t('budget.statusWarning')}</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-sm bg-rose-600 inline-block" aria-hidden="true" />
                    <span>{t('budget.statusExceeded')}</span>
                  </span>
                </div>
              </div>

            </div>

            {/* Balances y Engine de Liquidación Óptima con Reseteo Mensual y Arrastre Histórico */}
            <BalancesAndSettlement
              users={currentGroupMembers}
              expenses={currentGroupExpenses}
              settlements={currentGroupSettlements}
              currency={currentCurrency}
              userPreferredCurrency={currentUser?.preferredCurrency}
              selectedMonth={selectedMonth}
              groupId={activeGroup?.id}
              onSettleDebt={settleDebt}
              onResetSettlements={() => resetSettlements(currentGroupMembers.map((m) => m.id))}
            />

            {/* Vista previa rápida de los últimos gastos del grupo */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400 stroke-[1.75px]" aria-hidden="true" />
                  <span>{t('dashboard.recentActivity')}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('EXPENSES')}
                  className="min-h-[44px] inline-flex items-center text-xs text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                >
                  {t('dashboard.viewAllExpenses')} ({currentGroupExpenses.length}) →
                </button>
              </div>

              <ExpenseList
                expenses={currentGroupExpenses.slice(0, 4)}
                users={currentGroupMembers}
                categories={MOCK_CATEGORIES}
                currency={currentCurrency}
                userPreferredCurrency={currentUser?.preferredCurrency}
                isRecentPreview={true}
                onDeleteExpense={deleteExpense}
                onOpenAddModal={() => setIsAddModalOpen(true)}
              />
            </div>
          </div>
        )}

        {activeTab === 'EXPENSES' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t('expenses.title')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeGroup?.name || 'SplitFlow'}
                </p>
              </div>
            </div>

            <ExpenseList
              expenses={currentGroupExpenses}
              users={currentGroupMembers}
              categories={MOCK_CATEGORIES}
              currency={currentCurrency}
              userPreferredCurrency={currentUser?.preferredCurrency}
              settlements={currentGroupSettlements}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              activeSubTab={expenseSubTab}
              onSubTabChange={setExpenseSubTab}
              onDeleteExpense={deleteExpense}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'SETTLEMENTS' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <BalancesAndSettlement
              users={currentGroupMembers}
              expenses={currentGroupExpenses}
              settlements={currentGroupSettlements}
              currency={currentCurrency}
              userPreferredCurrency={currentUser?.preferredCurrency}
              groupId={activeGroup?.id}
              onSettleDebt={settleDebt}
              onResetSettlements={() => resetSettlements(currentGroupMembers.map((m) => m.id))}
            />
          </div>
        )}

        {activeTab === 'BUDGET' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <BudgetOverview
              categories={MOCK_CATEGORIES}
              expenses={currentGroupExpenses}
              currency={currentCurrency}
              userPreferredCurrency={currentUser?.preferredCurrency}
              budgetBlocks={activeGroup?.budgetBlocks}
              onOpenBudgetSettings={() => setIsBudgetSettingsModalOpen(true)}
            />
          </div>
        )}
          </>
        )}
      </main>

      {/* 4. Barra de Navegación Táctil Inferior para Móviles */}
      {groups.length > 0 && (
        <nav 
          aria-label="Navegación táctil móvil"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 h-16 grid grid-cols-5 items-center px-1 pb-safe"
        >
          {/* 1. Dashboard */}
          <button
            type="button"
            onClick={() => setActiveTab('DASHBOARD')}
            aria-label={t('nav.dashboard')}
            aria-current={activeTab === 'DASHBOARD' ? 'page' : undefined}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'DASHBOARD'
                ? 'text-slate-950 dark:text-slate-50 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Wallet className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
            <span className="text-[10px] leading-tight truncate">{t('nav.dashboard')}</span>
          </button>

          {/* 2. Gastos (incluye Histórico) */}
          <button
            type="button"
            onClick={() => setActiveTab('EXPENSES')}
            aria-label={`${t('nav.expenses')} (${currentGroupExpenses.length})`}
            aria-current={activeTab === 'EXPENSES' ? 'page' : undefined}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 relative transition cursor-pointer ${
              activeTab === 'EXPENSES'
                ? 'text-slate-950 dark:text-slate-50 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Receipt className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
            <span className="text-[10px] leading-tight truncate">{t('nav.expenses')}</span>
            {currentGroupExpenses.length > 0 && (
              <span className="absolute top-1 right-2 text-[9px] font-mono tabular-nums px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {currentGroupExpenses.length}
              </span>
            )}
          </button>

          {/* 3. BOTÓN CENTRAL: NUEVO GASTO - PERFECTAMENTE CENTRADO (Columna 3 de 5) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              aria-label={t('nav.newExpense')}
              className="w-11 h-11 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-xs active:scale-95 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            >
              <Plus className="w-5 h-5 stroke-[2px]" aria-hidden="true" />
            </button>
          </div>

          {/* 4. Liquidaciones */}
          <button
            type="button"
            onClick={() => setActiveTab('SETTLEMENTS')}
            aria-label={t('nav.settlements')}
            aria-current={activeTab === 'SETTLEMENTS' ? 'page' : undefined}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 relative transition cursor-pointer ${
              activeTab === 'SETTLEMENTS'
                ? 'text-slate-950 dark:text-slate-50 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-5 h-5 stroke-[1.75px] text-slate-700 dark:text-slate-300" aria-hidden="true" />
            <span className="text-[10px] leading-tight truncate">{t('nav.settlements')}</span>
            {optimalTransfers.length > 0 && (
              <span className="absolute top-1 right-2 text-[9px] font-mono tabular-nums px-1.5 py-0.2 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                {optimalTransfers.length}
              </span>
            )}
          </button>

          {/* 5. Presupuesto */}
          <button
            type="button"
            onClick={() => setActiveTab('BUDGET')}
            aria-label={t('nav.budget')}
            aria-current={activeTab === 'BUDGET' ? 'page' : undefined}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'BUDGET'
                ? 'text-slate-950 dark:text-slate-50 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <PiggyBank className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
            <span className="text-[10px] leading-tight truncate">{t('nav.budget')}</span>
          </button>
        </nav>
      )}

      {/* 5. Modales */}
      {activeGroup && (
        <>
          <AddExpenseModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            users={currentGroupMembers}
            categories={MOCK_CATEGORIES}
            groupId={activeGroup.id}
            currency={currentCurrency}
            incomeModuleEnabled={activeGroup.incomeModuleEnabled ?? false}
            onAddExpense={addExpense}
          />

          <ExportSummaryModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            group={activeGroup}
            users={currentGroupMembers}
            expenses={currentGroupExpenses}
            categories={MOCK_CATEGORIES}
            balances={balances}
            optimalTransfers={optimalTransfers}
          />
        </>
      )}

      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          allUsers={allUsers}
          initialTab={profileInitialTab}
          onUpdateUser={updateUser}
          onDeleteAccount={async () => {
            const res = await deleteAccount();
            if (res.success) {
              setIsProfileModalOpen(false);
              setAuthConfirmationMessage('Tu cuenta ha sido eliminada permanentemente.');
              setAuthInitialMode('LOGIN');
              setViewMode('AUTH');
              return { success: true };
            }
            return { success: false, error: res.error };
          }}
        />
      )}

      {currentUser && (
        <CreateGroupModal
          isOpen={isCreateGroupModalOpen}
          onClose={() => setIsCreateGroupModalOpen(false)}
          currentUser={currentUser}
          allUsers={allUsers}
          onCreateGroup={createGroup}
          onSearchUsers={searchPublicUsers}
          onGetContactSuggestions={getContactSuggestions}
        />
      )}

      {currentUser && (
        <JoinGroupModal
          isOpen={isJoinGroupModalOpen}
          onClose={() => setIsJoinGroupModalOpen(false)}
          onJoinGroup={joinGroupByCode}
        />
      )}

      {currentUser && activeGroup && (
        <LeaveGroupModal
          isOpen={isLeaveGroupModalOpen}
          onClose={() => setIsLeaveGroupModalOpen(false)}
          onConfirmLeave={leaveGroup}
          group={activeGroup}
          userBalance={currentUserBalance}
          isAdmin={isCurrentUserAdmin}
        />
      )}

      {currentUser && activeGroup && (
        <TransferAdminModal
          isOpen={isTransferAdminModalOpen}
          onClose={() => setIsTransferAdminModalOpen(false)}
          group={activeGroup}
          currentUser={currentUser}
          onTransferAdmin={transferSupremeAdmin}
        />
      )}

      {/* Modal de Gestión de Miembros y Roles (hasta 4 administradores, revocación y bajas) */}
      {currentUser && activeGroup && (
        <GroupMembersModal
          isOpen={isGroupMembersModalOpen}
          onClose={() => setIsGroupMembersModalOpen(false)}
          group={activeGroup}
          currentUser={currentUser}
          onPromoteAdmin={promoteGroupAdmin}
          onRevokeAdmin={revokeGroupAdmin}
          onTransferSupremeAdmin={transferSupremeAdmin}
          onRequestRemoveMember={(member) => setMemberToRemove(member)}
          onOpenInvite={() => setIsRequestsModalOpen(true)}
        />
      )}

      {/* Modal de Advertencia para Eliminar Integrante del Grupo */}
      {currentUser && activeGroup && memberToRemove && (
        <RemoveMemberModal
          isOpen={Boolean(memberToRemove)}
          onClose={() => setMemberToRemove(null)}
          group={activeGroup}
          targetMember={memberToRemove}
          onConfirmRemove={removeGroupMember}
        />
      )}

      {currentUser && activeGroup && (
        <DeleteGroupModal
          isOpen={isDeleteGroupModalOpen}
          onClose={() => setIsDeleteGroupModalOpen(false)}
          onConfirmDelete={deleteGroup}
          group={activeGroup}
          expenseCount={currentGroupExpenses.length}
        />
      )}

      {currentUser && activeGroup && (
        <GroupBudgetSettingsModal
          isOpen={isBudgetSettingsModalOpen}
          onClose={() => setIsBudgetSettingsModalOpen(false)}
          group={activeGroup}
          onSave={async (updatedBlocks, incomeModuleEnabled) => {
            const updatedGroup: Group = {
              ...activeGroup,
              budgetBlocks: updatedBlocks,
              incomeModuleEnabled: incomeModuleEnabled !== undefined ? incomeModuleEnabled : activeGroup.incomeModuleEnabled,
            };
            return await updateGroup(updatedGroup);
          }}
        />
      )}

      {currentUser && (
        <RequestsModal
          isOpen={isRequestsModalOpen}
          onClose={() => setIsRequestsModalOpen(false)}
          currentUser={currentUser}
          groups={groups}
          activeGroupId={activeGroupId}
          allUsers={allUsers}
          requests={requests}
          onAcceptRequest={acceptGroupInvitation}
          onRejectRequest={rejectGroupInvitation}
          onCancelRequest={cancelGroupInvitation}
          onSendRequest={sendGroupInvitation}
          onMarkAllAsRead={markAllRequestsAsRead}
          onSearchUsers={searchPublicUsers}
          onGetContactSuggestions={getContactSuggestions}
        />
      )}

      {/* Modal de Descarga de APK para Android */}
      <DownloadApkModal
        isOpen={isDownloadApkModalOpen}
        onClose={() => setIsDownloadApkModalOpen(false)}
      />

      {/* Pantalla de Bloqueo y Autenticacion Biometrica Movil (Solo en plataforma nativa Android/iOS) */}
      {Capacitor.isNativePlatform() && currentUser && isBiometricsActive && !isBiometricallyUnlocked && (
        <BiometricLockScreen
          currentUser={currentUser}
          onSuccess={() => setIsBiometricallyUnlocked(true)}
          onFallbackPassword={() => {
            setIsBiometricallyUnlocked(false);
            setViewMode('AUTH');
            setAuthInitialMode('LOGIN');
          }}
          onLogout={() => {
            logout();
            setIsBiometricallyUnlocked(false);
            setViewMode('LANDING');
          }}
        />
      )}

      {/* Toast Flotante Interactivo de Notificaciones In-App */}
      <InAppNotificationToast
        onSelectGroup={(gId) => setActiveGroupId(gId)}
        onOpenRequestsModal={() => setIsRequestsModalOpen(true)}
      />
    </div>
  );
}
