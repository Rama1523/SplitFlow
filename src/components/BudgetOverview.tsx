/**
 * SplitFlow — BudgetOverview Component
 * Monitoreo de presupuestos del hogar por categoría con barras de progreso dinámicas,
 * alertas por sobrepaso y cálculo de margen disponible.
 * Adaptado a Modo Claro y Modo Oscuro con soporte multilingüe y de todas las divisas.
 * Totalmente sin emoticonos.
 */

import { useMemo } from 'react';
import { 
  PiggyBank, 
  AlertTriangle, 
  Home, 
  Utensils, 
  Zap, 
  Film, 
  Car, 
  MoreHorizontal,
  Sliders
} from 'lucide-react';
import { Category, Expense, CategoryType, GroupBudgetBlock } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { convertAmount, formatCurrencyAmount } from '../lib/exchangeRates';

interface BudgetOverviewProps {
  categories: Category[];
  expenses: Expense[];
  currency?: string;
  userPreferredCurrency?: string;
  budgetBlocks?: GroupBudgetBlock[];
  onOpenBudgetSettings?: () => void;
}

export function BudgetOverview({ 
  categories, 
  expenses, 
  currency = 'EUR',
  userPreferredCurrency,
  budgetBlocks,
  onOpenBudgetSettings,
}: BudgetOverviewProps) {
  const { t, formatAmount } = useI18n();

  const isDifferentCurrency = Boolean(
    userPreferredCurrency && 
    userPreferredCurrency.toUpperCase() !== currency.toUpperCase()
  );

  const renderCategoryIcon = (type: CategoryType) => {
    const iconClass = "w-4 h-4 stroke-[1.75px] text-slate-700 dark:text-slate-300";
    switch (type) {
      case 'HOUSING': return <Home className={iconClass} />;
      case 'FOOD': return <Utensils className={iconClass} />;
      case 'UTILITIES': return <Zap className={iconClass} />;
      case 'ENTERTAINMENT': return <Film className={iconClass} />;
      case 'TRANSPORT': return <Car className={iconClass} />;
      default: return <MoreHorizontal className={iconClass} />;
    }
  };

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Determinar categorías activas y sus límites según budgetBlocks del grupo
  const effectiveCategories = useMemo(() => {
    if (!budgetBlocks || budgetBlocks.length === 0) {
      return categories;
    }
    const activeBlocksMap = new Map(
      budgetBlocks.filter((b) => b.isActive).map((b) => [b.category, b.limit])
    );
    return categories
      .filter((c) => activeBlocksMap.has(c.type))
      .map((c) => ({
        ...c,
        monthlyBudgetLimit: activeBlocksMap.get(c.type) ?? c.monthlyBudgetLimit,
      }));
  }, [categories, budgetBlocks]);

  const totalBudget = effectiveCategories.reduce((sum, c) => sum + c.monthlyBudgetLimit, 0);
  const globalPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="space-y-5 font-sans">
      {/* Resumen Global */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              <PiggyBank className="w-4 h-4 stroke-[1.75px]" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.groupBudget')}</h3>
            {onOpenBudgetSettings && (
              <button
                type="button"
                onClick={onOpenBudgetSettings}
                className="min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5 ml-2 border border-slate-200 dark:border-slate-700"
              >
                <Sliders className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                <span>Configurar bloques</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('budget.subtitle')} ({currency}) — {effectiveCategories.length} bloques activos
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
          <div className="text-left sm:text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('budget.spent')}</p>
            <p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
              {formatAmount(totalSpent, currency)}
            </p>
            {isDifferentCurrency && userPreferredCurrency && (
              <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                ≈ {formatCurrencyAmount(convertAmount(totalSpent, currency, userPreferredCurrency), userPreferredCurrency)}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right sm:border-l sm:border-slate-100 dark:sm:border-slate-800 sm:pl-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('budget.limit')}</p>
            <p className="text-lg font-bold font-mono text-slate-600 dark:text-slate-300 tabular-nums">
              {formatAmount(totalBudget, currency)}
            </p>
            {isDifferentCurrency && userPreferredCurrency && (
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-medium">
                ≈ {formatCurrencyAmount(convertAmount(totalBudget, currency, userPreferredCurrency), userPreferredCurrency)}
              </p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1 text-left sm:text-right sm:border-l sm:border-slate-100 dark:sm:border-slate-800 sm:pl-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">Consumo</p>
            <p className={`text-lg font-bold font-mono tabular-nums ${
              globalPercentage > 100 ? 'text-rose-600 dark:text-rose-400' : globalPercentage > 80 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'
            }`}>
              {globalPercentage}%
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {effectiveCategories.map((cat) => {
          const spent = expenses
            .filter((e) => e.category === cat.type)
            .reduce((sum, e) => sum + e.amount, 0);
          const limit = cat.monthlyBudgetLimit;
          const percentage = Math.round((spent / limit) * 100);
          const remaining = limit - spent;
          const isOver = spent > limit;
          const isWarning = !isOver && percentage >= 80;

          return (
            <div
              key={cat.id}
              className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      {renderCategoryIcon(cat.type)}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {t(`expCat.${cat.type}`)}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {t('budget.limit')}: {formatAmount(limit, currency)}
                        {isDifferentCurrency && userPreferredCurrency && (
                          <span className="text-slate-400 ml-1">
                            (≈ {formatCurrencyAmount(convertAmount(limit, currency, userPreferredCurrency), userPreferredCurrency)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {isOver && (
                    <span className="px-1.5 py-0.5 rounded-sm bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-[10px] font-mono font-medium flex items-center gap-1 border border-rose-200 dark:border-rose-900">
                      <AlertTriangle className="w-3 h-3 stroke-[2px]" />
                      {t('budget.statusExceeded')}
                    </span>
                  )}
                  {isWarning && (
                    <span className="px-1.5 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-medium border border-amber-200 dark:border-amber-900">
                      {t('budget.statusWarning')}
                    </span>
                  )}
                  {!isOver && !isWarning && (
                    <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono font-medium border border-slate-200 dark:border-slate-700">
                      {t('budget.statusSafe')}
                    </span>
                  )}
                </div>

                {/* Barra de Progreso */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {formatAmount(spent, currency)}
                      {isDifferentCurrency && userPreferredCurrency && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-1">
                          (≈ {formatCurrencyAmount(convertAmount(spent, currency, userPreferredCurrency), userPreferredCurrency)})
                        </span>
                      )}
                    </span>
                    <span className={isOver ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                      {percentage}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-xs bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-xs transition-all duration-300 ${
                        isOver
                          ? 'bg-rose-600'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-slate-900 dark:bg-slate-200'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Pie de Tarjeta */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {isOver ? t('budget.exceeded') : t('budget.remaining')}:
                </span>
                <span className={`font-semibold ${
                  isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formatAmount(Math.abs(remaining), currency)}
                  {isDifferentCurrency && userPreferredCurrency && (
                    <span className="text-[10px] opacity-80 ml-1 font-normal">
                      (≈ {formatCurrencyAmount(convertAmount(Math.abs(remaining), currency, userPreferredCurrency), userPreferredCurrency)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
