/**
 * SplitFlow — FinancialMetricsPanel Component (Linear / Stripe Aesthetic)
 * 
 * Componente visual de métricas financieras clave:
 * 1. Gastos diarios: Desglose o visualización del día actual.
 * 2. Gasto medio diario: Calculado sobre los días transcurridos del mes en curso.
 * 3. Gasto mensual: Acumulado total del mes seleccionado.
 * 4. Gasto medio anual: Promedio histórico y proyección anualizada.
 * 
 * Incluye selector de mes de calendario y conversión de divisas en tiempo real.
 */

import { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  TrendingUp, 
  Receipt, 
  Clock, 
  ArrowRight,
  RotateCcw,
  Info
} from 'lucide-react';
import { Expense } from '../types';
import { 
  calculateMonthlyFinancialMetrics, 
  getAvailableMonthKeys, 
  getCurrentMonthKey, 
  formatMonthLabel,
  MonthlyFinancialMetrics 
} from '../lib/monthly-analytics';
import { convertAmount, formatCurrencyAmount } from '../lib/exchangeRates';
import { useI18n } from '../i18n/I18nContext';

interface FinancialMetricsPanelProps {
  expenses: Expense[];
  currency: string;
  userPreferredCurrency?: string;
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  onViewHistory?: () => void;
}

export function FinancialMetricsPanel({
  expenses,
  currency,
  userPreferredCurrency,
  selectedMonth,
  onSelectMonth,
  onViewHistory,
}: FinancialMetricsPanelProps) {
  const { formatAmount } = useI18n();
  const [showTodayDetails, setShowTodayDetails] = useState(false);

  const currentMonthKey = getCurrentMonthKey();
  const isCurrentMonth = selectedMonth === currentMonthKey;

  // Lista de meses disponibles ordenada
  const availableMonths = useMemo(() => getAvailableMonthKeys(expenses), [expenses]);

  // Métricas calculadas para el mes seleccionado
  const metrics: MonthlyFinancialMetrics = useMemo(() => {
    return calculateMonthlyFinancialMetrics(expenses, selectedMonth);
  }, [expenses, selectedMonth]);

  const isDifferentCurrency = Boolean(
    userPreferredCurrency && 
    userPreferredCurrency.toUpperCase() !== currency.toUpperCase()
  );

  // Navegación secuencial de meses
  const currentIndex = availableMonths.indexOf(selectedMonth);
  const hasPrevious = currentIndex < availableMonths.length - 1;
  const hasNext = currentIndex > 0;

  const handlePreviousMonth = () => {
    if (hasPrevious) {
      onSelectMonth(availableMonths[currentIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    if (hasNext) {
      onSelectMonth(availableMonths[currentIndex - 1]);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      
      {/* Barra de Encabezado: Selector de Mes de Calendario y Estado de Periodo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            <Calendar className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Métricas Financieras del Periodo
              </h3>
              {isCurrentMonth ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Mes en curso
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Periodo histórico
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isCurrentMonth 
                ? `Ciclo de ${metrics.monthLabel} · Reseteo a cero de transacciones corrientes y arrastre de deudas previas`
                : `Consulta de gastos cerrados correspondientes a ${metrics.monthLabel}`}
            </p>
          </div>
        </div>

        {/* Selector de Meses y Controles de Navegación */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePreviousMonth}
            disabled={!hasPrevious}
            aria-label="Mes anterior"
            className="min-h-[36px] min-w-[36px] p-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center cursor-pointer"
            title="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
          </button>

          {/* Menú de selección directa de mes */}
          <select
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="min-h-[36px] px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-semibold font-mono cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
          >
            {availableMonths.map((mKey) => (
              <option key={mKey} value={mKey}>
                {formatMonthLabel(mKey)} {mKey === currentMonthKey ? '(Actual)' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={!hasNext}
            aria-label="Mes siguiente"
            className="min-h-[36px] min-w-[36px] p-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center cursor-pointer"
            title="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
          </button>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => onSelectMonth(currentMonthKey)}
              className="min-h-[36px] px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1 ml-1"
              title="Volver al mes en curso"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
              <span className="hidden sm:inline">Mes actual</span>
            </button>
          )}

          {onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              className="min-h-[36px] px-2.5 py-1.5 rounded-md bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer flex items-center gap-1 ml-1 shadow-2xs"
            >
              <span>Histórico</span>
              <ArrowRight className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Grid de las 4 Tarjetas de Métricas Principales (Linear / Stripe style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* 1. GASTOS DIARIOS (HOY) */}
        <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 stroke-[1.75px]" aria-hidden="true" />
              <span>Gastos Diarios (Hoy)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {metrics.todayCount} {metrics.todayCount === 1 ? 'gasto' : 'gastos'}
            </span>
          </div>

          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-950 dark:text-white tabular-nums">
              {formatAmount(metrics.todayTotal, currency)}
            </p>
            {isDifferentCurrency && userPreferredCurrency && (
              <p className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                ≈ {formatCurrencyAmount(convertAmount(metrics.todayTotal, currency, userPreferredCurrency), userPreferredCurrency)}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {metrics.todayCount === 0 
                ? 'Sin transacciones hoy' 
                : `${metrics.todayCount} registrado${metrics.todayCount > 1 ? 's' : ''} hoy`}
            </span>
            {metrics.todayCount > 0 && (
              <button
                type="button"
                onClick={() => setShowTodayDetails(!showTodayDetails)}
                className="text-slate-800 dark:text-slate-200 font-medium hover:underline cursor-pointer"
              >
                {showTodayDetails ? 'Ocultar' : 'Ver detalle'}
              </button>
            )}
          </div>
        </div>

        {/* 2. GASTO MEDIO DIARIO */}
        <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 stroke-[1.75px]" aria-hidden="true" />
              <span>Gasto Medio Diario</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {metrics.daysElapsed}d calculados
            </span>
          </div>

          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-950 dark:text-white tabular-nums">
              {formatAmount(metrics.dailyAverage, currency)}
              <span className="text-xs font-normal text-slate-500 ml-1 font-sans">/ día</span>
            </p>
            {isDifferentCurrency && userPreferredCurrency && (
              <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                ≈ {formatCurrencyAmount(convertAmount(metrics.dailyAverage, currency, userPreferredCurrency), userPreferredCurrency)} / día
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {isCurrentMonth 
                ? `Sobre ${metrics.daysElapsed} días transcurridos`
                : `Promedio mensual cerrado (${metrics.totalDaysInMonth} días)`}
            </span>
          </div>
        </div>

        {/* 3. GASTO MENSUAL */}
        <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 stroke-[1.75px]" aria-hidden="true" />
              <span>Gasto Mensual</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {metrics.monthlyCount} gastos
            </span>
          </div>

          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-950 dark:text-white tabular-nums">
              {formatAmount(metrics.monthlyTotal, currency)}
            </p>
            {isDifferentCurrency && userPreferredCurrency && (
              <p className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                ≈ {formatCurrencyAmount(convertAmount(metrics.monthlyTotal, currency, userPreferredCurrency), userPreferredCurrency)}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Acumulado de {metrics.monthLabel}</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {metrics.monthlyCount > 0 ? `${(metrics.monthlyTotal / metrics.monthlyCount).toFixed(0)} ${currency} / gasto` : '—'}
            </span>
          </div>
        </div>

        {/* 4. GASTO MEDIO ANUAL */}
        <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 stroke-[1.75px]" aria-hidden="true" />
              <span>Gasto Medio Anual</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {metrics.monthsWithDataCount} {metrics.monthsWithDataCount === 1 ? 'mes' : 'meses'} hist.
            </span>
          </div>

          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-950 dark:text-white tabular-nums">
              {formatAmount(metrics.annualizedTotal, currency)}
              <span className="text-xs font-normal text-slate-500 ml-1 font-sans">/ año</span>
            </p>
            {isDifferentCurrency && userPreferredCurrency && (
              <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                ≈ {formatCurrencyAmount(convertAmount(metrics.annualizedTotal, currency, userPreferredCurrency), userPreferredCurrency)} / año
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Media mensual:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {formatAmount(metrics.historicalMonthlyAverage, currency)}/m
            </span>
          </div>
        </div>

      </div>

      {/* Desglose Expandible de Gastos de Hoy */}
      {showTodayDetails && metrics.todayExpenses.length > 0 && (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white pb-1">
            <span>Desglose de transacciones de hoy ({metrics.todayExpenses.length})</span>
            <button
              type="button"
              onClick={() => setShowTodayDetails(false)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {metrics.todayExpenses.map((exp) => (
              <div
                key={exp.id}
                className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{exp.description}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(exp.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {exp.category}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatAmount(exp.amount, currency)}
                  </span>
                  {isDifferentCurrency && userPreferredCurrency && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      ≈ {formatCurrencyAmount(convertAmount(exp.amount, currency, userPreferredCurrency), userPreferredCurrency)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nota informativa de Reseteo Mensual y Arrastre de Deudas */}
      <div className="p-3 rounded-md bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 stroke-[1.75px]" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong>Regla de ciclo mensual:</strong> Cada nuevo mes comienza con el balance a cero para las transacciones corrientes del periodo. Las deudas no liquidadas de meses anteriores se mantienen de forma continua como saldo arrastrado (carryover) hasta que sean saldadas.
        </p>
      </div>

    </div>
  );
}
