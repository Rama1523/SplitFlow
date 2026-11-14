/**
 * SplitFlow — AddExpenseModal Component
 * Modal interactivo y accesible (WCAG AAA) para registrar nuevos gastos compartidos.
 * Targets táctiles >= 44x44px, navegación por teclado, soporte de pantalla táctil y contraste corporativo óptimo.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Receipt, 
  Check, 
  Scale, 
  Percent, 
  TrendingUp, 
  Home, 
  Utensils, 
  Zap, 
  Film, 
  Car, 
  MoreHorizontal,
  Info
} from 'lucide-react';
import { User, Category, CategoryType, SplitType, SplitDetail, Expense } from '../types';
import { sanitizeTextInput, validateMonetaryAmount } from '../lib/security';
import { useI18n } from '../i18n/I18nContext';
import { getCurrencyInfo } from '../lib/currencies';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  categories: Category[];
  groupId: string;
  currency?: string;
  incomeModuleEnabled?: boolean;
  onAddExpense: (expense: Expense) => void;
}

export function AddExpenseModal({
  isOpen,
  onClose,
  users,
  categories,
  groupId,
  currency = 'EUR',
  incomeModuleEnabled = false,
  onAddExpense,
}: AddExpenseModalProps) {
  const { t, formatAmount } = useI18n();
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidByUserId, setPaidByUserId] = useState<string>(users[0]?.id || '');
  const [category, setCategory] = useState<CategoryType>('FOOD');
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(users.map((u) => u.id));
  
  // Para repartos porcentuales manuales
  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const currencyInfo = getCurrencyInfo(currency);

  useEffect(() => {
    if (!incomeModuleEnabled && splitType === 'INCOME_PROPORTIONAL') {
      setSplitType('EQUAL');
    }
  }, [incomeModuleEnabled, splitType]);
  const amount = parseFloat(amountStr) || 0;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Resincronizar usuario pagador y participantes al abrir modal o cambiar de grupo
  useEffect(() => {
    if (isOpen && users.length > 0) {
      if (!users.some((u) => u.id === paidByUserId)) {
        setPaidByUserId(users[0].id);
      }
      setSelectedUserIds((prev) => {
        const validIds = prev.filter((id) => users.some((u) => u.id === id));
        return validIds.length > 0 ? validIds : users.map((u) => u.id);
      });
      setValidationError(null);
    }
  }, [isOpen, groupId, users]);

  // Inicializar repartos equitativos para modo PERCENTAGE y EXACT
  useEffect(() => {
    if (selectedUserIds.length > 0) {
      const equalPct = Math.round((100 / selectedUserIds.length) * 100) / 100;
      const initialPcts: Record<string, number> = {};
      const initialAmts: Record<string, number> = {};
      selectedUserIds.forEach((uid, index) => {
        if (index === selectedUserIds.length - 1) {
          const sumPrevious = equalPct * (selectedUserIds.length - 1);
          initialPcts[uid] = Math.max(0, Math.round((100 - sumPrevious) * 100) / 100);
        } else {
          initialPcts[uid] = equalPct;
        }
        initialAmts[uid] = amount > 0 ? Math.round((amount / selectedUserIds.length) * 100) / 100 : 0;
      });
      setCustomPercentages(initialPcts);
      setCustomAmounts(initialAmts);
    }
  }, [selectedUserIds.length, splitType]);

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      if (selectedUserIds.length <= 1) return;
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  // Validaciones en tiempo real
  const totalCustomPercent = useMemo(() => {
    return selectedUserIds.reduce((sum, uid) => sum + (customPercentages[uid] || 0), 0);
  }, [selectedUserIds, customPercentages]);

  const totalCustomAmount = useMemo(() => {
    return selectedUserIds.reduce((sum, uid) => sum + (customAmounts[uid] || 0), 0);
  }, [selectedUserIds, customAmounts]);

  const isCustomPercentValid = splitType !== 'PERCENTAGE' || Math.abs(totalCustomPercent - 100) < 0.1;
  const isCustomAmountValid = splitType !== 'EXACT' || Math.abs(totalCustomAmount - amount) < 0.05;

  const computedSplits = useMemo((): SplitDetail[] => {
    if (amount <= 0 || selectedUserIds.length === 0) return [];

    const activeUsers = users.filter((u) => selectedUserIds.includes(u.id));

    if (splitType === 'EQUAL') {
      const baseAmount = Math.floor((amount / selectedUserIds.length) * 100) / 100;
      const remainder = Math.round((amount - baseAmount * selectedUserIds.length) * 100) / 100;

      return selectedUserIds.map((uid, index) => ({
        userId: uid,
        amount: index === 0 ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount,
        percentage: Math.round((100 / selectedUserIds.length) * 10) / 10,
      }));
    }

    if (splitType === 'INCOME_PROPORTIONAL' && incomeModuleEnabled) {
      const totalIncome = activeUsers.reduce((sum, u) => sum + (u.monthlyIncome || 0), 0);
      if (totalIncome <= 0) {
        const equalAmt = Math.round((amount / selectedUserIds.length) * 100) / 100;
        return selectedUserIds.map((uid) => ({ userId: uid, amount: equalAmt }));
      }

      let distributed = 0;
      return activeUsers.map((u, index) => {
        const userIncome = u.monthlyIncome || 0;
        const ratio = userIncome / totalIncome;
        let userShare = Math.round(amount * ratio * 100) / 100;

        if (index === activeUsers.length - 1) {
          userShare = Math.round((amount - distributed) * 100) / 100;
        } else {
          distributed += userShare;
        }

        return {
          userId: u.id,
          amount: Math.max(0, userShare),
          percentage: Math.round(ratio * 1000) / 10,
        };
      });
    }

    if (splitType === 'PERCENTAGE') {
      const isHundred = Math.abs(totalCustomPercent - 100) < 0.1;
      let distributed = 0;
      return selectedUserIds.map((uid, index) => {
        const pct = customPercentages[uid] || 0;
        let userAmt = Math.round((amount * (pct / 100)) * 100) / 100;

        if (isHundred && index === selectedUserIds.length - 1) {
          userAmt = Math.round((amount - distributed) * 100) / 100;
        } else {
          distributed += userAmt;
        }

        return {
          userId: uid,
          amount: Math.max(0, userAmt),
          percentage: pct,
        };
      });
    }

    if (splitType === 'EXACT') {
      return selectedUserIds.map((uid) => {
        const exact = customAmounts[uid] || 0;
        return {
          userId: uid,
          amount: exact,
          percentage: amount > 0 ? Math.round((exact / amount) * 1000) / 10 : 0,
        };
      });
    }

    return [];
  }, [amount, selectedUserIds, splitType, customPercentages, customAmounts, users, totalCustomPercent]);

  const isFormValid =
    description.trim().length > 0 &&
    amount > 0 &&
    selectedUserIds.length > 0 &&
    isCustomPercentValid &&
    isCustomAmountValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanDescription = sanitizeTextInput(description, 100);
    if (!cleanDescription) {
      setValidationError(t('expenses.descriptionLabel'));
      return;
    }

    const amountValidation = validateMonetaryAmount(amount);
    if (!amountValidation.isValid) {
      setValidationError(amountValidation.error || t('common.error'));
      return;
    }

    if (!isCustomPercentValid) {
      setValidationError(`El reparto porcentual debe sumar exactamente 100% (actual: ${totalCustomPercent.toFixed(1)}%).`);
      return;
    }

    if (!isCustomAmountValid) {
      setValidationError(`La suma de importes exactos (${formatAmount(totalCustomAmount, currency)}) debe coincidir con el total del gasto (${formatAmount(amount, currency)}).`);
      return;
    }

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      groupId,
      description: cleanDescription,
      amount: amountValidation.value,
      paidByUserId,
      category,
      splitType,
      splits: computedSplits,
      createdAt: new Date().toISOString(),
    };

    onAddExpense(newExpense);
    onClose();

    setDescription('');
    setAmountStr('');
    setValidationError(null);
  };

  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-expense-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="add-expense-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('expenses.addModalTitle')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {currency} ({currencyInfo.symbol})
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {validationError && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 stroke-[1.75px]" aria-hidden="true" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Fila: Descripción & Monto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                {t('expenses.descriptionLabel')}
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('expenses.descriptionPlaceholder')}
                className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                {t('expenses.amountLabel')}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-mono font-bold text-slate-400 dark:text-slate-500 pointer-events-none">
                  {currencyInfo.symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="min-h-[46px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-16 py-2.5 text-sm font-mono text-slate-950 dark:text-white font-bold tabular-nums placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 transition-all shadow-2xs"
                />
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 absolute right-3 pointer-events-none bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {currencyInfo.code}
                </span>
              </div>
            </div>
          </div>

          {/* Fila: Pagado por */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              {t('expenses.payerLabel')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {users.map((u) => {
                const isSelected = paidByUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setPaidByUserId(u.id)}
                    className={`min-h-[44px] flex items-center gap-2.5 p-2 rounded-md border text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-sm font-mono font-semibold flex items-center justify-center text-[10px] shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}>
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-medium truncate">{u.name.split(' ')[0]}</p>
                      {incomeModuleEnabled && u.monthlyIncome && u.monthlyIncome > 0 ? (
                        <p className={`text-[10px] font-mono tabular-nums ${isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500'}`}>
                          {formatAmount(u.monthlyIncome, currency)}
                        </p>
                      ) : (
                        <p className={`text-[10px] font-mono truncate ${isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500'}`}>
                          {u.username ? `@${u.username}` : ''}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              {t('expenses.categoryLabel')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {categories.map((cat) => {
                const isSelected = category === cat.type;
                const catName = t(`expCat.${cat.type}`);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.type)}
                    className={`min-h-[44px] flex flex-col items-center justify-center p-2 rounded-md border text-xs gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.type === 'HOUSING' && <Home className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                    {cat.type === 'FOOD' && <Utensils className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                    {cat.type === 'UTILITIES' && <Zap className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                    {cat.type === 'ENTERTAINMENT' && <Film className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                    {cat.type === 'TRANSPORT' && <Car className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                    {cat.type === 'OTHER' && <MoreHorizontal className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                    <span className="text-[11px] font-medium truncate max-w-full">{catName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Método de Reparto */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              {t('expenses.splitTypeLabel')}
            </label>
            <div className={`grid gap-2 ${incomeModuleEnabled ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
              <button
                type="button"
                onClick={() => setSplitType('EQUAL')}
                className={`min-h-[44px] flex items-center gap-2 p-2 rounded-md border text-left text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                  splitType === 'EQUAL'
                    ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Scale className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span className="font-medium">{t('expenses.splitEqual')}</span>
              </button>

              {incomeModuleEnabled && (
                <button
                  type="button"
                  onClick={() => setSplitType('INCOME_PROPORTIONAL')}
                  className={`min-h-[44px] flex items-center gap-2 p-2 rounded-md border text-left text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                    splitType === 'INCOME_PROPORTIONAL'
                      ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                  <span className="font-medium">{t('expenses.splitProportional')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSplitType('PERCENTAGE')}
                className={`min-h-[44px] flex items-center gap-2 p-2 rounded-md border text-left text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                  splitType === 'PERCENTAGE'
                    ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Percent className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span className="font-medium">{t('expenses.splitPercentage')}</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitType('EXACT')}
                className={`min-h-[44px] flex items-center gap-2 p-2 rounded-md border text-left text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                  splitType === 'EXACT'
                    ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Receipt className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                <span className="font-medium">{t('expenses.splitExact')}</span>
              </button>
            </div>
          </div>

          {/* Participantes y Desglose en Vivo */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('expenses.splitPreview')}
              </label>

              {/* Indicadores de Balance */}
              {splitType === 'PERCENTAGE' && (
                <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border tabular-nums ${
                  isCustomPercentValid
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                }`}>
                  Total: {totalCustomPercent.toFixed(1)}% / 100% {Math.abs(totalCustomPercent - 100) > 0.05 ? `(${100 - totalCustomPercent > 0 ? `Falta ${(100 - totalCustomPercent).toFixed(1)}%` : `Sobra ${(totalCustomPercent - 100).toFixed(1)}%`})` : '✓'}
                </span>
              )}

              {splitType === 'EXACT' && (
                <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border tabular-nums ${
                  isCustomAmountValid
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                }`}>
                  Asignado: {formatAmount(totalCustomAmount, currency)} / {formatAmount(amount, currency)}
                </span>
              )}

              {splitType !== 'PERCENTAGE' && splitType !== 'EXACT' && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {selectedUserIds.length} participantes
                </span>
              )}
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {users.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                const splitItem = computedSplits.find((s) => s.userId === u.id);

                return (
                  <div
                    key={u.id}
                    className={`min-h-[44px] flex items-center justify-between p-2.5 rounded-md border transition ${
                      isSelected
                        ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        : 'opacity-50 border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(u.id)}
                        className="w-4 h-4 accent-slate-900 dark:accent-slate-100 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {u.name}
                      </span>
                    </label>

                    {isSelected ? (
                      <div className="flex items-center gap-2 sm:gap-3">
                        {splitType === 'PERCENTAGE' && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={customPercentages[u.id] ?? ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCustomPercentages({ ...customPercentages, [u.id]: val });
                              }}
                              className="w-20 min-h-[44px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-2 text-xs text-right font-mono font-medium text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                            />
                            <span className="text-xs text-slate-500 font-mono">%</span>
                          </div>
                        )}

                        {splitType === 'EXACT' && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={customAmounts[u.id] ?? ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCustomAmounts({ ...customAmounts, [u.id]: val });
                              }}
                              className="w-24 min-h-[44px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-2 text-xs text-right font-mono font-medium text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                            />
                            <span className="text-xs text-slate-500 font-mono">{currencyInfo.code}</span>
                          </div>
                        )}

                        <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {splitItem ? formatAmount(splitItem.amount, currency) : formatAmount(0, currency)}
                        </span>
                        {splitItem?.percentage !== undefined && splitType !== 'PERCENTAGE' && (
                          <span className="text-xs text-slate-500 font-mono tabular-nums">
                            ({splitItem.percentage.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No participa</span>
                    )}
                  </div>
                );
              })}
            </div>

            {splitType === 'INCOME_PROPORTIONAL' && incomeModuleEnabled && (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-md border border-slate-200 dark:border-slate-800">
                <Info className="w-4 h-4 shrink-0 stroke-[1.75px]" aria-hidden="true" />
                <span className="font-normal">
                  {t('profile.incomeHint')}
                </span>
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
              disabled={!isFormValid}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 disabled:opacity-40 text-xs font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              <Check className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
              <span>{t('expenses.submitCreate')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
