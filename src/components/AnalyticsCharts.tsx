/**
 * SplitFlow — AnalyticsCharts Component
 * Gráficos interactivos de distribución de gastos por categoría (Donut SVG interactivo y Barras)
 * con tooltip, desglose porcentual e importes en tiempo real.
 * Adaptado a Modo Claro y Modo Oscuro con soporte multilingüe y de todas las divisas.
 * Totalmente sin emoticonos.
 */

import { useState, useMemo } from 'react';
import { PieChart as PieIcon, BarChart3, Home, Utensils, Zap, Film, Car, MoreHorizontal } from 'lucide-react';
import { Expense, Category, CategoryType } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface AnalyticsChartsProps {
  expenses: Expense[];
  categories: Category[];
  currency?: string;
}

export function AnalyticsCharts({ expenses, categories, currency = 'EUR' }: AnalyticsChartsProps) {
  const { t, formatAmount } = useI18n();
  const [chartType, setChartType] = useState<'DONUT' | 'BAR'>('DONUT');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  // Agrupar gastos por categoría
  const categoryData = useMemo(() => {
    return categories
      .map((cat) => {
        const spent = expenses
          .filter((e) => e.category === cat.type)
          .reduce((sum, e) => sum + e.amount, 0);
        const percentage = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
        return {
          ...cat,
          spent,
          percentage,
          formattedPercentage: percentage.toFixed(1),
          count: expenses.filter((e) => e.category === cat.type).length,
        };
      })
      .filter((cat) => cat.spent > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [categories, expenses, totalSpent]);

  // Helper para iconos
  const renderCategoryIcon = (type: CategoryType) => {
    switch (type) {
      case 'HOUSING': return <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'FOOD': return <Utensils className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'UTILITIES': return <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'ENTERTAINMENT': return <Film className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />;
      case 'TRANSPORT': return <Car className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      default: return <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  // Color mapping corporativo sobrio para los arcos SVG
  const getCategoryColor = (type: CategoryType) => {
    switch (type) {
      case 'HOUSING': return '#0f172a';
      case 'FOOD': return '#059669';
      case 'UTILITIES': return '#d97706';
      case 'ENTERTAINMENT': return '#475569';
      case 'TRANSPORT': return '#334155';
      default: return '#64748b';
    }
  };

  // Construcción de segmentos para el Donut Chart SVG
  const radius = 68;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const donutSegments = categoryData.map((cat) => {
    const strokeDasharray = `${(cat.percentage * circumference) / 100} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent * circumference) / 100);
    accumulatedPercent += cat.percentage;

    return {
      ...cat,
      strokeDasharray,
      strokeDashoffset,
      color: getCategoryColor(cat.type),
    };
  });

  const activeCategory = hoveredCategory
    ? categoryData.find((c) => c.id === hoveredCategory)
    : categoryData[0];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-5 font-sans">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              <PieIcon className="w-4 h-4 stroke-[1.75px]" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('analytics.categoryDistribution')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {formatAmount(totalSpent, currency)} {t('metrics.inExpenses', { count: expenses.length })}
          </p>
        </div>

        {/* Selector de Tipo de Gráfico con Targets >= 44x44px */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md self-start sm:self-auto" role="group" aria-label="Tipo de gráfico">
          <button
            type="button"
            onClick={() => setChartType('DONUT')}
            aria-pressed={chartType === 'DONUT'}
            className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
              chartType === 'DONUT'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <PieIcon className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            <span>Donut</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('BAR')}
            aria-pressed={chartType === 'BAR'}
            className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
              chartType === 'BAR'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            <span>Barras</span>
          </button>
        </div>
      </div>

      {categoryData.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
          {t('analytics.noData')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Gráfico Donut o Barras */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            {chartType === 'DONUT' ? (
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.id}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="20"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="transition-all duration-300 cursor-pointer hover:opacity-80"
                      onMouseEnter={() => setHoveredCategory(seg.id)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  ))}
                </svg>

                {/* Centro del Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                  <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                    {activeCategory ? t(`expCat.${activeCategory.type}`) : t('metrics.totalSpent')}
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {activeCategory ? formatAmount(activeCategory.spent, currency) : formatAmount(totalSpent, currency)}
                  </span>
                  {activeCategory && (
                    <span className="text-[10px] font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      {activeCategory.formattedPercentage}%
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Gráfico de Barras Verticales */
              <div className="w-full h-48 flex items-end justify-around gap-2 px-2 pt-6 pb-2 border-b border-slate-200 dark:border-slate-800">
                {categoryData.map((cat) => {
                  const barHeight = Math.max(12, Math.min(100, Math.round(cat.percentage)));
                  const isHovered = hoveredCategory === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                      onMouseEnter={() => setHoveredCategory(cat.id)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      <span className={`text-[10px] font-mono font-semibold transition tabular-nums ${isHovered ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
                        {cat.formattedPercentage}%
                      </span>
                      <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-t-sm h-full flex items-end overflow-hidden p-0.5">
                        <div
                          className="w-full rounded-t-xs transition-all duration-300"
                          style={{
                            height: `${barHeight}%`,
                            backgroundColor: getCategoryColor(cat.type),
                            opacity: isHovered ? 1 : 0.85,
                          }}
                        />
                      </div>
                      <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-full">
                        {t(`expCat.${cat.type}`).slice(0, 4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desglose Lateral por Categoría */}
          <div className="lg:col-span-7 space-y-2">
            {categoryData.map((cat) => {
              const isHovered = hoveredCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  onMouseEnter={() => setHoveredCategory(cat.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`p-2.5 rounded-md border transition cursor-pointer flex items-center justify-between ${
                    isHovered
                      ? 'bg-slate-50 dark:bg-slate-950 border-slate-400 dark:border-slate-600'
                      : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: getCategoryColor(cat.type) }}
                    />
                    <div className="p-1 rounded-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                      {renderCategoryIcon(cat.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-200 truncate">
                        {t(`expCat.${cat.type}`)}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {cat.count} {t('nav.expenses').toLowerCase()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatAmount(cat.spent, currency)}
                    </p>
                    <p className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                      {cat.formattedPercentage}%
                    </p>
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
