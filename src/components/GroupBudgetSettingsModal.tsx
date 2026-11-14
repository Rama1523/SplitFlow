/**
 * SplitFlow — GroupBudgetSettingsModal Component
 * Modal accesible (WCAG AAA) para configurar y personalizar los bloques de gasto y presupuestos del grupo.
 * Permite activar/desactivar categorías (Alquiler, Alimentación, etc.), editar límites mensuales
 * y recalcula dinámicamente el Presupuesto Total del Grupo.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  Wallet, 
  Home, 
  Utensils, 
  Film, 
  Zap, 
  Car, 
  Package, 
  Calculator,
  Sliders
} from 'lucide-react';
import { Group, GroupBudgetBlock, CategoryType } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface GroupBudgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onSave: (updatedBlocks: GroupBudgetBlock[], incomeModuleEnabled?: boolean) => Promise<{ success: boolean; error?: string }>;
}

export const CATEGORY_META: Record<CategoryType, { label: string; icon: React.ElementType; defaultLimit: number }> = {
  HOUSING: { label: 'Alquiler / Vivienda', icon: Home, defaultLimit: 1200 },
  FOOD: { label: 'Alimentación / Supermercado', icon: Utensils, defaultLimit: 500 },
  UTILITIES: { label: 'Suministros (Luz, Agua, Gas)', icon: Zap, defaultLimit: 200 },
  ENTERTAINMENT: { label: 'Ocio y Salidas', icon: Film, defaultLimit: 250 },
  TRANSPORT: { label: 'Transporte y Movilidad', icon: Car, defaultLimit: 150 },
  OTHER: { label: 'Otros Gastos', icon: Package, defaultLimit: 100 },
};

export const DEFAULT_BUDGET_BLOCKS: GroupBudgetBlock[] = (Object.keys(CATEGORY_META) as CategoryType[]).map((cat) => ({
  category: cat,
  isActive: cat !== 'OTHER',
  limit: CATEGORY_META[cat].defaultLimit,
}));

export function GroupBudgetSettingsModal({
  isOpen,
  onClose,
  group,
  onSave,
}: GroupBudgetSettingsModalProps) {
  const { formatAmount } = useI18n();
  const [blocks, setBlocks] = useState<GroupBudgetBlock[]>([]);
  const [incomeModuleEnabled, setIncomeModuleEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIncomeModuleEnabled(Boolean(group.incomeModuleEnabled));
      if (group.budgetBlocks && group.budgetBlocks.length > 0) {
        // Merge with all categories to ensure no category is missing
        const existingMap = new Map(group.budgetBlocks.map((b) => [b.category, b]));
        const merged: GroupBudgetBlock[] = (Object.keys(CATEGORY_META) as CategoryType[]).map((cat) => {
          if (existingMap.has(cat)) {
            return { ...existingMap.get(cat)! };
          }
          return {
            category: cat,
            isActive: cat !== 'OTHER',
            limit: CATEGORY_META[cat].defaultLimit,
          };
        });
        setBlocks(merged);
      } else {
        setBlocks(DEFAULT_BUDGET_BLOCKS);
      }
      setErrorMsg(null);
    }
  }, [isOpen, group]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  // Cálculo dinámico del presupuesto total sumando sólo bloques activos
  const totalBudget = useMemo(() => {
    return blocks
      .filter((b) => b.isActive)
      .reduce((sum, b) => sum + (Number(b.limit) || 0), 0);
  }, [blocks]);

  const activeCount = useMemo(() => {
    return blocks.filter((b) => b.isActive).length;
  }, [blocks]);

  if (!isOpen) return null;

  const handleToggleBlock = (category: CategoryType) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.category === category ? { ...b, isActive: !b.isActive } : b
      )
    );
  };

  const handleLimitChange = (category: CategoryType, rawVal: string) => {
    const parsed = parseFloat(rawVal);
    const num = isNaN(parsed) ? 0 : Math.max(0, Math.min(1000000, parsed));
    const rounded = Math.round(num * 100) / 100;
    setBlocks((prev) =>
      prev.map((b) =>
        b.category === category ? { ...b, limit: rounded } : b
      )
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const res = await onSave(blocks, incomeModuleEnabled);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al guardar los presupuestos.');
        setIsSaving(false);
      } else {
        setIsSaving(false);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado al guardar presupuestos.');
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="budget-settings-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Bloques de Gasto y Presupuesto
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personaliza los módulos activos y sus límites para {group.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
          </button>
        </div>

        {/* Resumen dinámico del Total */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Presupuesto Total del Grupo ({activeCount} activos)
              </p>
              <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatAmount(totalBudget, group.currency || 'EUR')} / mes
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            Suma dinámica
          </span>
        </div>

        {/* Formulario con lista de bloques */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-3.5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Toggle de Módulo de Ingresos y Reparto Proporcional */}
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
                  aria-label="Habilitar módulo de ingresos en el grupo"
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-slate-900"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Opcional. Si se desactiva, los balances y liquidaciones se calcularán basándose exclusivamente en el reparto de gastos, ocultando formularios y etiquetas de ingresos en toda la interfaz.
            </p>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Activa las categorías de gasto que aplican a este grupo y asigna el tope mensual estimado.
          </p>

          <div className="space-y-2.5">
            {blocks.map((block) => {
              const meta = CATEGORY_META[block.category] || { label: block.category, icon: Package, defaultLimit: 100 };
              const IconComp = meta.icon;

              return (
                <div
                  key={block.category}
                  className={`p-3 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    block.isActive
                      ? 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-2xs'
                      : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Botón toggle accesible */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={block.isActive}
                      onClick={() => handleToggleBlock(block.category)}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md cursor-pointer transition ${
                        block.isActive
                          ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={block.isActive}
                        onChange={() => {}}
                        aria-label={`Activar ${meta.label}`}
                        className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer pointer-events-none"
                      />
                    </button>

                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                        block.isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        <IconComp className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {meta.label}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {block.isActive ? 'Módulo activo' : 'Inactivo / Omitido'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Input de Límite Numérico */}
                  <div className="flex items-center gap-2 self-end sm:self-auto pl-12 sm:pl-0">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Límite:
                    </span>
                    <div className="relative w-32">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        disabled={!block.isActive}
                        value={block.limit || ''}
                        onChange={(e) => handleLimitChange(block.category, e.target.value)}
                        placeholder="0"
                        className={`min-h-[44px] w-full text-right font-mono text-xs pr-8 pl-2.5 py-1.5 rounded-md border transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 ${
                          block.isActive
                            ? 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                            : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      />
                      <span className="absolute right-2.5 top-3 text-[11px] font-mono text-slate-500 pointer-events-none">
                        {group.currency || 'EUR'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 disabled:opacity-40 text-xs font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                  <span>Guardar presupuesto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
