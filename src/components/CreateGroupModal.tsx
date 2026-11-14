/**
 * SplitFlow — CreateGroupModal Component
 * Modal interactivo y accesible (WCAG AAA) para crear y configurar nuevos grupos.
 * Targets táctiles >= 44x44px, navegación por teclado, soporte de pantalla táctil y contraste óptimo.
 * Regla estricta: Los miembros adicionales solo se pueden invitar buscando por @usuario o correo.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Users, 
  Home, 
  Plane, 
  Heart, 
  PartyPopper, 
  Package, 
  Check, 
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Mail,
  Calculator,
  Sliders,
  Wallet,
  Loader2,
  History,
  UserCheck
} from 'lucide-react';
import { Group, GroupCategory, User, GroupBudgetBlock, CategoryType, PublicUser } from '../types';
import { sanitizeTextInput } from '../lib/security';
import { useI18n } from '../i18n/I18nContext';
import { CurrencySelector } from './CurrencySelector';
import { DEFAULT_BUDGET_BLOCKS, CATEGORY_META } from './GroupBudgetSettingsModal';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  onCreateGroup: (newGroup: Group, invitedQueries?: string[]) => void;
  onSearchUsers?: (query: string, groupId?: string) => Promise<PublicUser[]>;
  onGetContactSuggestions?: (groupId?: string) => Promise<PublicUser[]>;
}

const CATEGORY_OPTIONS: { type: GroupCategory; nameKey: string }[] = [
  { type: 'HOME', nameKey: 'cat.HOME' },
  { type: 'TRIP', nameKey: 'cat.TRIP' },
  { type: 'COUPLE', nameKey: 'cat.COUPLE' },
  { type: 'EVENT', nameKey: 'cat.EVENT' },
  { type: 'OTHER', nameKey: 'cat.OTHER' },
];

export function CreateGroupModal({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onCreateGroup,
  onSearchUsers,
  onGetContactSuggestions,
}: CreateGroupModalProps) {
  const { t, formatAmount } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GroupCategory>('HOME');
  const [currency, setCurrency] = useState('EUR');
  const [budgetBlocks, setBudgetBlocks] = useState<GroupBudgetBlock[]>(DEFAULT_BUDGET_BLOCKS);
  const [incomeModuleEnabled, setIncomeModuleEnabled] = useState(false);

  // Invitaciones pendientes por usuario o correo
  const [inviteSearch, setInviteSearch] = useState('');
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sugerencias rápidas por historial de contactos compartidos
  const [contactSuggestions, setContactSuggestions] = useState<PublicUser[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Búsqueda predictiva (debounced autocomplete)
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Cargar contactos sugeridos al abrir el modal
  useEffect(() => {
    let isCurrent = true;
    if (isOpen) {
      setIsLoadingSuggestions(true);
      if (onGetContactSuggestions) {
        onGetContactSuggestions()
          .then((suggs) => {
            if (isCurrent) {
              setContactSuggestions(suggs);
              setIsLoadingSuggestions(false);
            }
          })
          .catch(() => {
            if (isCurrent) setIsLoadingSuggestions(false);
          });
      } else {
        const fallbacks: PublicUser[] = allUsers
          .filter((u) => u.id !== currentUser.id)
          .slice(0, 6)
          .map((u) => ({
            id: u.id,
            username: u.username || u.name.toLowerCase().replace(/\s+/g, '_'),
            isPastContact: true,
          }));
        setContactSuggestions(fallbacks);
        setIsLoadingSuggestions(false);
      }
    }
    return () => {
      isCurrent = false;
    };
  }, [isOpen, onGetContactSuggestions, allUsers, currentUser.id]);

  // Búsqueda predictiva con debounce de 250ms mientras escribe
  useEffect(() => {
    const clean = inviteSearch.trim().replace(/^@/, '');
    if (!clean) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        if (onSearchUsers) {
          const results = await onSearchUsers(clean);
          setSearchResults(results);
        } else {
          const matches: PublicUser[] = allUsers
            .filter((u) => {
              if (u.id === currentUser.id) return false;
              const uName = (u.username || '').toLowerCase();
              return uName.includes(clean.toLowerCase());
            })
            .slice(0, 8)
            .map((u) => ({
              id: u.id,
              username: u.username || u.name.toLowerCase().replace(/\s+/g, '_'),
            }));
          setSearchResults(matches);
        }
      } catch (err) {
        console.warn('Search error in CreateGroupModal:', err);
      } finally {
        setIsSearching(false);
        setHasSearched(true);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inviteSearch, onSearchUsers, allUsers, currentUser.id]);

  // Cálculo dinámico del total del presupuesto según bloques activos
  const totalBudget = useMemo(() => {
    return budgetBlocks
      .filter((b) => b.isActive)
      .reduce((sum, b) => sum + (Number(b.limit) || 0), 0);
  }, [budgetBlocks]);

  const handleToggleBlock = (cat: CategoryType) => {
    setBudgetBlocks((prev) =>
      prev.map((b) => (b.category === cat ? { ...b, isActive: !b.isActive } : b))
    );
  };

  const handleLimitChange = (cat: CategoryType, rawVal: string) => {
    const num = Math.max(0, parseFloat(rawVal) || 0);
    setBudgetBlocks((prev) =>
      prev.map((b) => (b.category === cat ? { ...b, limit: num } : b))
    );
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

  if (!isOpen) return null;

  const handleAddInvite = (queryToAdd?: string) => {
    setErrorMsg(null);
    const target = queryToAdd || inviteSearch;
    const cleanQuery = sanitizeTextInput(target, 100).trim();

    if (!cleanQuery) {
      setErrorMsg(t('requests.searchPlaceholder'));
      return;
    }

    if (
      cleanQuery.toLowerCase() === currentUser.email.toLowerCase() ||
      (currentUser.username && cleanQuery.toLowerCase().replace('@', '') === currentUser.username.toLowerCase())
    ) {
      setErrorMsg('No puedes enviarte una solicitud a ti mismo.');
      return;
    }

    if (pendingInvites.includes(cleanQuery)) {
      setErrorMsg(t('requests.alreadyInvited'));
      return;
    }

    setPendingInvites([...pendingInvites, cleanQuery]);
    setInviteSearch('');
  };

  const handleRemoveInvite = (query: string) => {
    setPendingInvites(pendingInvites.filter((item) => item !== query));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanName = sanitizeTextInput(name, 80);
    const cleanDesc = sanitizeTextInput(description, 200);

    if (!cleanName) {
      setErrorMsg(t('group.nameLabel'));
      return;
    }

    // Generar código de invitación único legible y limpio (ej: SF-9A82B3)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inviteCode = 'SF-';
    for (let i = 0; i < 6; i++) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: cleanName,
      description: cleanDesc || 'SplitFlow Shared Group',
      category,
      avatar: category,
      currency,
      members: [{ ...currentUser, role: 'admin' }],
      inviteCode,
      codigoGrupo: inviteCode,
      adminId: currentUser.id,
      created_by: currentUser.id,
      budgetBlocks,
      incomeModuleEnabled,
      createdAt: new Date().toISOString(),
    };

    onCreateGroup(newGroup, pendingInvites);
    onClose();

    // Reset
    setName('');
    setDescription('');
    setBudgetBlocks(DEFAULT_BUDGET_BLOCKS);
    setIncomeModuleEnabled(false);
    setPendingInvites([]);
    setInviteSearch('');
    setErrorMsg(null);
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="create-group-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('group.createTitle')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('group.createSubtitle')}</p>
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Nombre & Descripción */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              {t('group.nameLabel')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('group.namePlaceholder')}
              className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              {t('group.descLabel')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve..."
              className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            />
          </div>

          {/* Categoría del Grupo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              {t('group.categoryLabel')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const isSelected = category === cat.type;
                return (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => setCategory(cat.type)}
                    className={`min-h-[44px] flex items-center gap-2.5 p-2 rounded-md border text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.type === 'HOME' && <Home className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />}
                    {cat.type === 'TRIP' && <Plane className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />}
                    {cat.type === 'COUPLE' && <Heart className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />}
                    {cat.type === 'EVENT' && <PartyPopper className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />}
                    {cat.type === 'OTHER' && <Package className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />}
                    <span className="text-xs truncate">{t(cat.nameKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selector de Moneda */}
          <CurrencySelector
            value={currency}
            onChange={setCurrency}
            label={t('group.currencyLabel')}
          />

          {/* Bloques de Gastos y Presupuesto Personalizable */}
          <div className="space-y-2 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px]" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Bloques de Gastos y Presupuesto
                </span>
              </div>
              <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                {budgetBlocks.filter((b) => b.isActive).length} activos
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Selecciona los módulos de gasto activos y asigna su límite mensual estimado.
            </p>

            {/* Presupuesto Total Calculado Dinámicamente */}
            <div className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Presupuesto Total del Grupo:
                </span>
              </div>
              <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatAmount(totalBudget, currency)} / mes
              </span>
            </div>

            {/* Lista de Bloques */}
            <div className="space-y-1.5 pt-1">
              {budgetBlocks.map((block) => {
                const meta = CATEGORY_META[block.category];
                if (!meta) return null;
                const IconComp = meta.icon;

                return (
                  <div
                    key={block.category}
                    className={`flex items-center justify-between p-2 rounded-md border transition text-xs ${
                      block.isActive
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                        : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={block.isActive}
                        onChange={() => handleToggleBlock(block.category)}
                        aria-label={`Activar ${meta.label}`}
                        className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                      />
                      <IconComp className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {meta.label}
                      </span>
                    </label>

                    <div className="relative w-28 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        disabled={!block.isActive}
                        value={block.limit || ''}
                        onChange={(e) => handleLimitChange(block.category, e.target.value)}
                        placeholder="0"
                        className={`min-h-[38px] w-full text-right font-mono text-xs pr-7 pl-2 py-1 rounded border transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 ${
                          block.isActive
                            ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                            : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      />
                      <span className="absolute right-2 top-2.5 text-[10px] font-mono text-slate-400 pointer-events-none">
                        {currency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Módulo de Ingresos y Reparto Proporcional (Estrictamente Opcional) */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px]" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Módulo de Ingresos y Reparto Proporcional
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
                <input
                  type="checkbox"
                  checked={incomeModuleEnabled}
                  onChange={(e) => setIncomeModuleEnabled(e.target.checked)}
                  aria-label="Habilitar módulo de ingresos"
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-slate-900"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Opcional. Si está deshabilitado, los balances se basan exclusivamente en el reparto y compensación de gastos (equitativo, porcentajes o montos fijos), ocultando todos los indicadores de ingresos.
            </p>
          </div>

          {/* Regla de Invitación */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500 stroke-[1.75px] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Invitación Obligatoria y Segura
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                  {t('requests.invitationRuleNote')}
                </p>
              </div>
            </div>

            {/* Creador actual como miembro inicial */}
            <div className="flex items-center justify-between p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {currentUser.name} (Tú - Creador)
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                Admin
              </span>
            </div>
          </div>

          {/* Buscador de Miembros */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
              <span>Invitar miembros (por nombre de usuario o correo)</span>
            </label>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 stroke-[1.75px]" aria-hidden="true" />
                <input
                  type="text"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="ej: @usuario_1 o usuario@splitflow.app"
                  className="min-h-[44px] w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                />
                {isSearching ? (
                  <Loader2 className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400 animate-spin" aria-hidden="true" />
                ) : inviteSearch ? (
                  <button
                    type="button"
                    onClick={() => setInviteSearch('')}
                    aria-label="Limpiar búsqueda"
                    className="min-h-[36px] min-w-[36px] absolute right-1 top-1 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleAddInvite()}
                disabled={!inviteSearch.trim()}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white disabled:opacity-40 text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
              >
                <Plus className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                <span>Invitar</span>
              </button>
            </div>

            {/* Caso 1: Búsqueda predictiva activa */}
            {inviteSearch.trim().length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Search className="w-3 h-3" aria-hidden="true" />
                    Resultados predictivos
                  </span>
                  {isSearching && (
                    <span className="flex items-center gap-1 font-normal lowercase">
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                      buscando...
                    </span>
                  )}
                </div>

                {isSearching ? (
                  <div className="p-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    <span>Buscando usuarios por coincidencia...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
                    {searchResults.map((u) => {
                      const alreadyAdded = pendingInvites.includes(`@${u.username}`);
                      return (
                        <div
                          key={u.id}
                          className="min-h-[44px] flex items-center justify-between p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 font-mono truncate">
                              @{u.username}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                              <span>ID: {u.id.slice(0, 8)}...</span>
                              {u.isPastContact && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                  <History className="w-2.5 h-2.5" />
                                  Contacto previo
                                </span>
                              )}
                            </div>
                          </div>

                          {alreadyAdded ? (
                            <span className="min-h-[36px] px-2.5 py-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5" />
                              Añadido
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddInvite(`@${u.username}`)}
                              className="min-h-[36px] px-3 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                            >
                              + Añadir
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : hasSearched ? (
                  <div className="p-2.5 rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500">
                    No hay coincidencias para &quot;{inviteSearch.trim()}&quot;. Pulsa &quot;Invitar&quot; para añadir como consulta directa.
                  </div>
                ) : null}
              </div>
            ) : (
              /* Caso 2: Sugerencias Rápidas de contactos previos */
              contactSuggestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      Sugerencias de contactos previos:
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {contactSuggestions.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                    {contactSuggestions.map((u) => {
                      const alreadyAdded = pendingInvites.includes(`@${u.username}`);
                      return (
                        <div
                          key={u.id}
                          className="min-h-[44px] flex items-center justify-between p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="truncate min-w-0 pr-1.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                              @{u.username}
                            </span>
                            {u.sharedGroupsCount ? (
                              <p className="text-[10px] text-slate-400 truncate">
                                {u.sharedGroupsCount} grupo{u.sharedGroupsCount > 1 ? 's' : ''} en común
                              </p>
                            ) : null}
                          </div>

                          {alreadyAdded ? (
                            <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                              Añadido
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddInvite(`@${u.username}`)}
                              className="min-h-[36px] px-2.5 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-[11px] font-semibold transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                            >
                              + Añadir
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* Lista de invitaciones que se enviarán al crear el grupo */}
            {pendingInvites.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Solicitudes a enviar ({pendingInvites.length}):
                </p>
                <div className="space-y-1">
                  {pendingInvites.map((query) => (
                    <div
                      key={query}
                      className="min-h-[44px] flex items-center justify-between p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-500 stroke-[1.75px] shrink-0" aria-hidden="true" />
                        <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">{query}</span>
                        <span className="text-xs text-slate-500">
                          (Pendiente de envío)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(query)}
                        aria-label={`Eliminar invitación para ${query}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
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
              disabled={!name.trim()}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 disabled:opacity-40 text-xs font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              <Check className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
              <span>{t('group.submit')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
