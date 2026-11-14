/**
 * SplitFlow — ExpenseHistoryView Component (Linear / Stripe Aesthetic)
 * 
 * Sección de Histórico que permite:
 * 1. Navegar fluidamente entre meses pasados y el mes en curso.
 * 2. Visualizar el detalle exhaustivo de gastos registrados por periodo cerrado.
 * 3. Consultar las liquidaciones y pagos realizados en periodos anteriores.
 * 4. Conversión de divisas en tiempo real para todos los importes.
 */

import { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Receipt, 
  Search, 
  Sparkles, 
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Home,
  Utensils,
  Zap,
  Film,
  Car,
  MoreHorizontal
} from 'lucide-react';
import { Expense, User, SettlementTransaction, Category, CategoryType } from '../types';
import { 
  getAvailableMonthKeys, 
  formatMonthLabel, 
  filterExpensesByMonth, 
  getCurrentMonthKey,
  getDaysInMonth
} from '../lib/monthly-analytics';
import { convertAmount, formatCurrencyAmount } from '../lib/exchangeRates';
import { useI18n } from '../i18n/I18nContext';

interface ExpenseHistoryViewProps {
  expenses: Expense[];
  users: User[];
  settlements: SettlementTransaction[];
  categories: Category[];
  currency: string;
  userPreferredCurrency?: string;
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
}

export function ExpenseHistoryView({
  expenses,
  users,
  settlements,
  categories,
  currency,
  userPreferredCurrency,
  selectedMonth,
  onSelectMonth,
}: ExpenseHistoryViewProps) {
  const { t, formatAmount } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const currentMonthKey = getCurrentMonthKey();
  const isCurrentMonth = selectedMonth === currentMonthKey;

  const availableMonths = useMemo(() => getAvailableMonthKeys(expenses), [expenses]);

  // Gastos del mes seleccionado
  const monthExpenses = useMemo(() => {
    return filterExpensesByMonth(expenses, selectedMonth);
  }, [expenses, selectedMonth]);

  // Liquidaciones correspondientes a este mes
  const monthSettlements = useMemo(() => {
    return settlements.filter((s) => {
      if (!s.settledAt) return false;
      return s.settledAt.startsWith(selectedMonth);
    });
  }, [settlements, selectedMonth]);

  // Filtrado de búsqueda y categoría
  const filteredExpenses = useMemo(() => {
    return monthExpenses.filter((e) => {
      const matchSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || e.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [monthExpenses, searchTerm, selectedCategory]);

  const monthTotal = useMemo(() => {
    return monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [monthExpenses]);

  const settlementsTotal = useMemo(() => {
    return monthSettlements.reduce((sum, s) => sum + s.amount, 0);
  }, [monthSettlements]);

  const isDifferentCurrency = Boolean(
    userPreferredCurrency && 
    userPreferredCurrency.toUpperCase() !== currency.toUpperCase()
  );

  // Mapeo rápido de usuarios
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  // Navegación de meses
  const currentIndex = availableMonths.indexOf(selectedMonth);
  const hasPrevious = currentIndex < availableMonths.length - 1;
  const hasNext = currentIndex > 0;

  const handlePreviousMonth = () => {
    if (hasPrevious) onSelectMonth(availableMonths[currentIndex + 1]);
  };

  const handleNextMonth = () => {
    if (hasNext) onSelectMonth(availableMonths[currentIndex - 1]);
  };

  // Helper de icono de categoría
  const renderCategoryIcon = (type: CategoryType) => {
    const iconClass = "w-4 h-4 stroke-[1.75px]";
    switch (type) {
      case 'HOUSING': return <Home className={iconClass} />;
      case 'FOOD': return <Utensils className={iconClass} />;
      case 'UTILITIES': return <Zap className={iconClass} />;
      case 'ENTERTAINMENT': return <Film className={iconClass} />;
      case 'TRANSPORT': return <Car className={iconClass} />;
      default: return <MoreHorizontal className={iconClass} />;
    }
  };

  // Desglose por categoría del mes
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([cat, total]) => ({
        category: cat as CategoryType,
        total,
        percentage: monthTotal > 0 ? (total / monthTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [monthExpenses, monthTotal]);

  return (
    <div className="space-y-6 font-sans animate-in fade-in duration-200">
      
      {/* 1. CABECERA Y SELECTOR DE MESES HISTÓRICOS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                <Calendar className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-slate-950 dark:text-white">
                Histórico de Gastos por Periodo Mensual
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Navegue entre los meses cerrados para consultar gastos, repartos y transferencias saldadas.
            </p>
          </div>

          {/* Selector de Mes */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreviousMonth}
              disabled={!hasPrevious}
              aria-label="Mes anterior"
              className="min-h-[36px] min-w-[36px] p-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2px]" />
            </button>

            <span className="min-h-[36px] px-3.5 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold font-mono">
              {formatMonthLabel(selectedMonth)} {isCurrentMonth ? '(Actual)' : ''}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!hasNext}
              aria-label="Mes siguiente"
              className="min-h-[36px] min-w-[36px] p-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4 stroke-[2px]" />
            </button>
          </div>
        </div>

        {/* Píldoras Rápidas de Meses Disponibles */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap mr-1">
            Periodos disponibles:
          </span>
          {availableMonths.map((mKey) => {
            const isSelected = mKey === selectedMonth;
            const count = filterExpensesByMonth(expenses, mKey).length;
            return (
              <button
                key={mKey}
                type="button"
                onClick={() => onSelectMonth(mKey)}
                className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-mono font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{formatMonthLabel(mKey)}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded ${
                  isSelected ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. RESUMEN DEL PERIODO SELECCIONADO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Gastado en el Mes */}
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-between">
            <span>Gasto Total del Periodo</span>
            <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400 stroke-[1.75px]" />
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-950 dark:text-white mt-1.5 tabular-nums">
            {formatAmount(monthTotal, currency)}
          </p>
          {isDifferentCurrency && userPreferredCurrency && (
            <p className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
              ≈ {formatCurrencyAmount(convertAmount(monthTotal, currency, userPreferredCurrency), userPreferredCurrency)}
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            {monthExpenses.length} transacciones en {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        {/* Liquidaciones del Mes */}
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-between">
            <span>Transferencias Saldadas</span>
            <Sparkles className="w-4 h-4 text-amber-500 stroke-[1.75px]" />
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-950 dark:text-white mt-1.5 tabular-nums">
            {formatAmount(settlementsTotal, currency)}
          </p>
          {isDifferentCurrency && userPreferredCurrency && (
            <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              ≈ {formatCurrencyAmount(convertAmount(settlementsTotal, currency, userPreferredCurrency), userPreferredCurrency)}
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            {monthSettlements.length} pagos registrados en este periodo
          </p>
        </div>

        {/* Promedio Diario del Mes */}
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-between">
            <span>Media Diaria de {formatMonthLabel(selectedMonth)}</span>
            <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400 stroke-[1.75px]" />
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-950 dark:text-white mt-1.5 tabular-nums">
            {formatAmount(monthTotal / getDaysInMonth(selectedMonth), currency)}
          </p>
          {isDifferentCurrency && userPreferredCurrency && (
            <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              ≈ {formatCurrencyAmount(convertAmount(monthTotal / getDaysInMonth(selectedMonth), currency, userPreferredCurrency), userPreferredCurrency)} / día
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            Calculado sobre {getDaysInMonth(selectedMonth)} días del mes
          </p>
        </div>

      </div>

      {/* 3. DESGLOSE POR CATEGORÍAS DEL MES HISTÓRICO */}
      {categoryBreakdown.length > 0 && (
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
            Distribución por Categorías en {formatMonthLabel(selectedMonth)}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {categoryBreakdown.map((item) => (
              <div 
                key={item.category}
                className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {renderCategoryIcon(item.category)}
                  <span className="truncate">{t(`expCat.${item.category}`)}</span>
                </div>
                <p className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                  {formatAmount(item.total, currency)}
                </p>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-xs overflow-hidden">
                  <div 
                    className="bg-slate-900 dark:bg-slate-100 h-full rounded-xs" 
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-slate-500 text-right">
                  {item.percentage.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. LISTADO DE GASTOS DETALLADOS DEL PERIODO */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Transacciones de {formatMonthLabel(selectedMonth)}
            </h3>
            <span className="text-xs font-mono text-slate-500">
              ({filteredExpenses.length} {filteredExpenses.length === 1 ? 'registro' : 'registros'})
            </span>
          </div>

          {/* Filtros de Búsqueda y Categoría */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en este mes..."
                className="min-h-[34px] pl-8 pr-3 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-100"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="min-h-[34px] px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.type}>
                  {t(`expCat.${c.type}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla / Lista de Gastos */}
        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-400 stroke-[1.5px]" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No hay gastos registrados en este periodo
            </p>
            <p className="text-xs text-slate-500">
              {monthExpenses.length === 0 
                ? `El mes de ${formatMonthLabel(selectedMonth)} no cuenta con registros de gastos.`
                : 'Ningún gasto coincide con los criterios de búsqueda aplicados.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
            {filteredExpenses.map((exp) => {
              const payer = userMap.get(exp.paidByUserId);
              const payerName = payer ? (payer.username ? `@${payer.username}` : payer.name) : 'Usuario';
              const dateObj = new Date(exp.createdAt);
              const formattedDate = dateObj.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={exp.id}
                  className="p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-slate-950/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
                      {renderCategoryIcon(exp.category)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {exp.description}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span>{formattedDate}</span>
                        <span>·</span>
                        <span>Pagado por <strong className="text-slate-700 dark:text-slate-300 font-semibold">{payerName}</strong></span>
                        <span>·</span>
                        <span className="font-mono">{exp.splits.length} participantes</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right font-mono self-start sm:self-auto shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatAmount(exp.amount, currency)}
                    </p>
                    {isDifferentCurrency && userPreferredCurrency && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                        ≈ {formatCurrencyAmount(convertAmount(exp.amount, currency, userPreferredCurrency), userPreferredCurrency)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. HISTÓRICO DE LIQUIDACIONES Y PAGOS DEL PERIODO */}
      {monthSettlements.length > 0 && (
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2px]" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Liquidaciones Completadas en {formatMonthLabel(selectedMonth)} ({monthSettlements.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {monthSettlements.map((s, idx) => {
              const from = userMap.get(s.fromUserId);
              const to = userMap.get(s.toUserId);
              const fromName = from ? (from.username ? `@${from.username}` : from.name) : 'Usuario';
              const toName = to ? (to.username ? `@${to.username}` : to.name) : 'Usuario';

              return (
                <div
                  key={s.id || `hist-settle-${idx}`}
                  className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="text-slate-800 dark:text-slate-200">
                      <strong>{fromName}</strong> saldó a <strong>{toName}</strong>
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Método: {s.paymentMethod || 'Manual'} · {s.settledAt ? new Date(s.settledAt).toLocaleDateString('es-ES') : ''}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatAmount(s.amount, s.currency || currency)}
                    </span>
                    {isDifferentCurrency && userPreferredCurrency && (
                      <p className="text-[10px] text-slate-500">
                        ≈ {formatCurrencyAmount(convertAmount(s.amount, s.currency || currency, userPreferredCurrency), userPreferredCurrency)}
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
}
