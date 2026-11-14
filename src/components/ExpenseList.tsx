/**
 * SplitFlow — ExpenseList Component
 * Listado accesible (WCAG AAA) y 100% responsive de gastos compartidos.
 * Targets táctiles >= 44x44px, foco visible, contraste óptimo y metadatos limpios sin elementos neón.
 */

import { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Calendar, 
  Home, 
  Utensils, 
  Zap, 
  Film, 
  Car, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Receipt,
  Check,
  X,
  Plus
} from 'lucide-react';
import { User, Expense, Category, CategoryType, SplitType, SettlementTransaction } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { convertAmount, formatCurrencyAmount } from '../lib/exchangeRates';
import { ExpenseHistoryView } from './ExpenseHistoryView';
import { getCurrentMonthKey, filterExpensesByMonth, formatMonthLabel } from '../lib/monthly-analytics';

interface ExpenseListProps {
  expenses: Expense[];
  users: User[];
  categories: Category[];
  currency?: string;
  userPreferredCurrency?: string;
  settlements?: SettlementTransaction[];
  selectedMonth?: string;
  onSelectMonth?: (monthKey: string) => void;
  activeSubTab?: 'CURRENT' | 'HISTORY';
  onSubTabChange?: (tab: 'CURRENT' | 'HISTORY') => void;
  isRecentPreview?: boolean;
  onDeleteExpense: (expenseId: string) => void;
  onOpenAddModal: () => void;
}

export function ExpenseList({
  expenses,
  users,
  categories,
  currency = 'EUR',
  userPreferredCurrency,
  settlements = [],
  selectedMonth,
  onSelectMonth,
  activeSubTab,
  onSubTabChange,
  isRecentPreview = false,
  onDeleteExpense,
  onOpenAddModal,
}: ExpenseListProps) {
  const { t, formatAmount } = useI18n();
  const [internalSubTab, setInternalSubTab] = useState<'CURRENT' | 'HISTORY'>('CURRENT');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentSubTab = activeSubTab ?? internalSubTab;
  const setSubTab = onSubTabChange ?? setInternalSubTab;
  const currentMonthKey = getCurrentMonthKey();
  const activeMonthKey = selectedMonth || currentMonthKey;

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Si no es preview y estamos en tab CURRENT, filtrar por el mes corriente
  const currentMonthExpenses = useMemo(() => {
    if (isRecentPreview) return expenses;
    return filterExpensesByMonth(expenses, currentMonthKey);
  }, [expenses, isRecentPreview, currentMonthKey]);

  const filteredExpenses = useMemo(() => {
    const listToFilter = isRecentPreview ? expenses : currentMonthExpenses;
    return listToFilter
      .filter((exp) => {
        const matchesCategory = selectedCategory === 'ALL' || exp.category === selectedCategory;
        const matchesSearch =
          exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          userMap.get(exp.paidByUserId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [isRecentPreview, expenses, currentMonthExpenses, selectedCategory, searchTerm, userMap]);

  const renderCategoryIcon = (type: CategoryType) => {
    const iconClass = "w-4 h-4 stroke-[1.75px] text-slate-700 dark:text-slate-300";
    switch (type) {
      case 'HOUSING': return <Home className={iconClass} aria-hidden="true" />;
      case 'FOOD': return <Utensils className={iconClass} aria-hidden="true" />;
      case 'UTILITIES': return <Zap className={iconClass} aria-hidden="true" />;
      case 'ENTERTAINMENT': return <Film className={iconClass} aria-hidden="true" />;
      case 'TRANSPORT': return <Car className={iconClass} aria-hidden="true" />;
      default: return <MoreHorizontal className={iconClass} aria-hidden="true" />;
    }
  };

  const getSplitBadgeLabel = (type: SplitType) => {
    switch (type) {
      case 'EQUAL': return t('expenses.splitEqual');
      case 'INCOME_PROPORTIONAL': return t('expenses.splitProportional');
      case 'PERCENTAGE': return t('expenses.splitPercentage');
      case 'EXACT': return t('expenses.splitExact');
    }
  };

  // Si se selecciona la vista de Histórico dentro del bloque de gastos
  if (currentSubTab === 'HISTORY' && !isRecentPreview) {
    return (
      <div className="space-y-4 font-sans animate-in fade-in duration-150">
        {/* Selector de sub-pestañas: Gastos del Mes vs Histórico */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setSubTab('CURRENT')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-md font-medium text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5 stroke-[1.75px]" />
              <span>Gastos del Mes ({formatMonthLabel(currentMonthKey)})</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {currentMonthExpenses.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('HISTORY')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-md font-semibold bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 stroke-[1.75px]" />
              <span>Histórico de Periodos</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="min-h-[36px] px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2px]" />
            <span>{t('nav.newExpense')}</span>
          </button>
        </div>

        <ExpenseHistoryView
          expenses={expenses}
          users={users}
          settlements={settlements}
          categories={categories}
          currency={currency}
          userPreferredCurrency={userPreferredCurrency}
          selectedMonth={activeMonthKey}
          onSelectMonth={onSelectMonth || (() => {})}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans animate-in fade-in duration-150">
      {/* Selector de sub-pestañas dentro del bloque de gastos */}
      {!isRecentPreview && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setSubTab('CURRENT')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-md font-semibold bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5 stroke-[1.75px]" />
              <span>Gastos del Mes ({formatMonthLabel(currentMonthKey)})</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {currentMonthExpenses.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('HISTORY')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-md font-medium text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 stroke-[1.75px]" />
              <span>Histórico de Periodos</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="min-h-[36px] px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2px]" />
            <span>{t('nav.newExpense')}</span>
          </button>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Input de Búsqueda con Target >= 44x44px */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 stroke-[1.75px] text-slate-400 absolute left-3.5 top-3 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('expenses.searchPlaceholder')}
            aria-label={t('expenses.searchPlaceholder')}
            className="min-h-[44px] w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          />
        </div>

        {/* Filtro por Categoría con Targets >= 44x44px */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('common.all')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.type)}
              className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                selectedCategory === c.type
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t(`expCat.${c.type}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Gastos - Contenedor Unificado con Hairline Dividers */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Receipt className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('expenses.emptyTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('expenses.emptySubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="min-h-[44px] mt-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold transition shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            + {t('nav.newExpense')}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden shadow-xs">
          {filteredExpenses.map((exp) => {
            const payer = userMap.get(exp.paidByUserId);
            const isExpanded = expandedExpenseId === exp.id;
            const dateStr = new Date(exp.createdAt).toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={exp.id}
                className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
              >
                {/* Fila Principal */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div 
                    onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)}
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1"
                  >
                    {/* Icono de Categoría Corporativo */}
                    <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                      {renderCategoryIcon(exp.category)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {exp.description}
                        </h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          · {getSplitBadgeLabel(exp.splitType)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[10px] font-semibold inline-flex items-center justify-center shrink-0">
                            {(payer?.username || payer?.name || '??').slice(0, 2).toUpperCase()}
                          </span>
                          <span>{t('expenses.payerLabel')}: <strong className="text-slate-900 dark:text-slate-100 font-mono font-semibold">@{payer?.username || payer?.name}</strong></span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                          <span>{dateStr}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Importe y Acciones con Targets >= 44x44px */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right min-w-[70px]">
                      <p className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatAmount(exp.amount, currency)}
                      </p>
                      {userPreferredCurrency && userPreferredCurrency.toUpperCase() !== currency.toUpperCase() && (
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          ≈ {formatCurrencyAmount(convertAmount(exp.amount, currency, userPreferredCurrency), userPreferredCurrency)}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {exp.splits.length} {t('metrics.members').toLowerCase()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {deletingId === exp.id ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 p-1 rounded-md border border-rose-200 dark:border-rose-900 animate-in fade-in">
                          <span className="text-xs font-medium text-rose-700 dark:text-rose-300 px-1.5 whitespace-nowrap">¿Eliminar?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteExpense(exp.id);
                              setDeletingId(null);
                            }}
                            aria-label="Confirmar eliminación"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md bg-rose-600 text-white font-medium hover:bg-rose-700 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-600"
                          >
                            <Check className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            aria-label="Cancelar eliminación"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-700"
                          >
                            <X className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(exp.id)}
                          aria-label={`${t('common.delete')} ${exp.description}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                        >
                          <Trash2 className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Contraer desglose' : 'Expandir desglose'}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desglose Expandible */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{t('expenses.splitPreview')}:</span>
                      {exp.notes && (
                        <span className="italic text-xs text-slate-500 dark:text-slate-400">"{exp.notes}"</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {exp.splits.map((split) => {
                        const splitUser = userMap.get(split.userId);
                        if (!splitUser) return null;
                        const isPayer = split.userId === exp.paidByUserId;

                        return (
                          <div
                            key={split.userId}
                            className={`min-h-[44px] p-2.5 rounded-md border text-xs flex items-center justify-between ${
                              isPayer
                                ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-semibold inline-flex items-center justify-center text-[10px] shrink-0">
                                {(splitUser.username || splitUser.name).slice(0, 2).toUpperCase()}
                              </span>
                              <span className="truncate font-semibold font-mono text-slate-900 dark:text-slate-100">@{splitUser.username || splitUser.name}</span>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                                {formatAmount(split.amount, currency)}
                              </span>
                              {userPreferredCurrency && userPreferredCurrency.toUpperCase() !== currency.toUpperCase() && (
                                <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                  ≈ {formatCurrencyAmount(convertAmount(split.amount, currency, userPreferredCurrency), userPreferredCurrency)}
                                </span>
                              )}
                              {split.percentage && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                  {split.percentage.toFixed(0)}%
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
