/**
 * SplitFlow — Monthly Analytics & Calendar Settlement Engine
 * 
 * Reglas de Dominio:
 * 1. Los gastos y balances se agrupan estrictamente por meses de calendario (ej. Octubre 2026).
 * 2. Cada nuevo mes comienza con el balance a cero para las transacciones corrientes del periodo.
 * 3. Se mantiene el arrastre (carryover) de deudas históricas o liquidaciones pendientes de meses anteriores.
 * 4. Cálculo de métricas: Gastos diarios (hoy), Gasto medio diario, Gasto mensual y Gasto medio anual / proyección.
 */

import { Expense, User, SettlementTransaction, UserBalance } from '../types';

export interface MonthlyFinancialMetrics {
  monthKey: string;             // YYYY-MM (ej: '2026-10')
  monthLabel: string;           // 'Octubre 2026'
  isCurrentMonth: boolean;
  daysElapsed: number;          // Días transcurridos en el mes
  totalDaysInMonth: number;     // Días totales del mes
  
  // 1. Gastos diarios (Hoy)
  todayTotal: number;
  todayCount: number;
  todayExpenses: Expense[];
  
  // 2. Gasto medio diario
  dailyAverage: number;
  
  // 3. Gasto mensual
  monthlyTotal: number;
  monthlyCount: number;
  
  // 4. Gasto medio anual / mensual histórico
  historicalMonthlyAverage: number;
  annualizedTotal: number;
  monthsWithDataCount: number;
}

export interface MonthlyUserBalanceBreakdown {
  userId: string;
  userName: string;
  // Transacciones del periodo actual (empieza en cero)
  currentPeriodPaid: number;
  currentPeriodOwed: number;
  currentPeriodNet: number;
  
  // Arrastre histórico pendiente de meses previos
  carriedOverBalance: number;
  
  // Balance total neto (corriente + arrastre)
  totalNetBalance: number;
}

/**
 * Devuelve la clave YYYY-MM para una fecha
 */
export function getMonthKey(dateStringOrDate: string | Date = new Date()): string {
  const d = typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate) : dateStringOrDate;
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Devuelve el mes actual en formato YYYY-MM
 */
export function getCurrentMonthKey(): string {
  return getMonthKey(new Date());
}

/**
 * Formatea '2026-10' a 'Octubre 2026' con localización en español
 */
export function formatMonthLabel(monthKey: string, locale = 'es-ES'): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  
  if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return monthKey;
  }
  
  const date = new Date(year, monthIndex, 1);
  const formatted = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Calcula el número de días en un mes específico (ej: 31 para octubre)
 */
export function getDaysInMonth(monthKey: string): number {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return new Date(year, month, 0).getDate();
}

/**
 * Obtiene la lista ordenada de meses disponibles con gastos registrados
 */
export function getAvailableMonthKeys(expenses: Expense[]): string[] {
  const current = getCurrentMonthKey();
  const keysSet = new Set<string>();
  keysSet.add(current);
  
  expenses.forEach((e) => {
    if (e.createdAt) {
      keysSet.add(getMonthKey(e.createdAt));
    }
  });

  return Array.from(keysSet).sort().reverse();
}

/**
 * Filtra los gastos pertenecientes a un mes calendario
 */
export function filterExpensesByMonth(expenses: Expense[], monthKey: string): Expense[] {
  return expenses.filter((e) => {
    if (!e.createdAt) return false;
    return getMonthKey(e.createdAt) === monthKey;
  });
}

/**
 * Calcula las 4 métricas financieras requeridas:
 * 1. Gastos diarios (hoy)
 * 2. Gasto medio diario
 * 3. Gasto mensual
 * 4. Gasto medio anual
 */
export function calculateMonthlyFinancialMetrics(
  expenses: Expense[],
  selectedMonthKey: string = getCurrentMonthKey()
): MonthlyFinancialMetrics {
  const currentMonthKey = getCurrentMonthKey();
  const isCurrentMonth = selectedMonthKey === currentMonthKey;
  const now = new Date();
  
  const totalDays = getDaysInMonth(selectedMonthKey);
  const daysElapsed = isCurrentMonth ? Math.min(now.getDate(), totalDays) : totalDays;

  // Filtrar gastos del mes seleccionado
  const monthlyExpenses = filterExpensesByMonth(expenses, selectedMonthKey);
  const monthlyTotal = Math.round(monthlyExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
  const monthlyCount = monthlyExpenses.length;

  // 1. Gastos de hoy
  const todayDateString = now.toISOString().split('T')[0];
  const todayExpenses = isCurrentMonth
    ? monthlyExpenses.filter((e) => e.createdAt && e.createdAt.startsWith(todayDateString))
    : [];
  const todayTotal = Math.round(todayExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;

  // 2. Gasto medio diario
  const effectiveDaysForAverage = Math.max(1, daysElapsed);
  const dailyAverage = Math.round((monthlyTotal / effectiveDaysForAverage) * 100) / 100;

  // 4. Gasto medio anual / histórico
  // Agrupar todos los gastos por mes
  const expensesByMonth = new Map<string, number>();
  expenses.forEach((e) => {
    const key = getMonthKey(e.createdAt);
    expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + e.amount);
  });

  const monthsWithDataCount = Math.max(1, expensesByMonth.size);
  const totalAllTimeExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const historicalMonthlyAverage = Math.round((totalAllTimeExpenses / monthsWithDataCount) * 100) / 100;
  const annualizedTotal = Math.round(historicalMonthlyAverage * 12 * 100) / 100;

  return {
    monthKey: selectedMonthKey,
    monthLabel: formatMonthLabel(selectedMonthKey),
    isCurrentMonth,
    daysElapsed,
    totalDaysInMonth: totalDays,
    todayTotal,
    todayCount: todayExpenses.length,
    todayExpenses,
    dailyAverage,
    monthlyTotal,
    monthlyCount,
    historicalMonthlyAverage,
    annualizedTotal,
    monthsWithDataCount,
  };
}

/**
 * Calcula los balances mensuales con reseteo de transacciones corrientes
 * y arrastre estricto de deudas históricas anteriores.
 */
export function calculateMonthlyUserBalances(
  users: User[],
  expenses: Expense[],
  settlements: SettlementTransaction[] = [],
  selectedMonthKey: string = getCurrentMonthKey()
): MonthlyUserBalanceBreakdown[] {
  const [selYear, selMonth] = selectedMonthKey.split('-').map((n) => parseInt(n, 10));
  const periodStartDate = new Date(selYear, selMonth - 1, 1, 0, 0, 0, 0);
  const periodEndDate = new Date(selYear, selMonth, 0, 23, 59, 59, 999);

  // Inicializar acumuladores
  const userStats = new Map<
    string,
    {
      currentPaid: number;
      currentOwed: number;
      priorPaid: number;
      priorOwed: number;
    }
  >();

  users.forEach((u) => {
    userStats.set(u.id, {
      currentPaid: 0,
      currentOwed: 0,
      priorPaid: 0,
      priorOwed: 0,
    });
  });

  // 1. Clasificar gastos entre periodo actual y periodos históricos anteriores
  expenses.forEach((exp) => {
    const expDate = new Date(exp.createdAt);
    const isCurrent = expDate >= periodStartDate && expDate <= periodEndDate;
    const isPrior = expDate < periodStartDate;

    if (isCurrent) {
      const payer = userStats.get(exp.paidByUserId);
      if (payer) payer.currentPaid += exp.amount;

      exp.splits.forEach((split) => {
        const debtor = userStats.get(split.userId);
        if (debtor) debtor.currentOwed += split.amount;
      });
    } else if (isPrior) {
      const payer = userStats.get(exp.paidByUserId);
      if (payer) payer.priorPaid += exp.amount;

      exp.splits.forEach((split) => {
        const debtor = userStats.get(split.userId);
        if (debtor) debtor.priorOwed += split.amount;
      });
    }
  });

  // 2. Liquidaciones saldadas: atribuir a histórico o periodo actual
  const priorSettlementsAdjustment = new Map<string, number>();
  const currentSettlementsAdjustment = new Map<string, number>();

  users.forEach((u) => {
    priorSettlementsAdjustment.set(u.id, 0);
    currentSettlementsAdjustment.set(u.id, 0);
  });

  settlements.forEach((s) => {
    if (!s.isSettled) return;
    const settleDate = s.settledAt ? new Date(s.settledAt) : new Date();
    const isCurrent = settleDate >= periodStartDate && settleDate <= periodEndDate;
    const isPrior = settleDate < periodStartDate;

    const targetMap = isCurrent ? currentSettlementsAdjustment : isPrior ? priorSettlementsAdjustment : null;
    if (targetMap) {
      targetMap.set(s.fromUserId, (targetMap.get(s.fromUserId) || 0) + s.amount);
      targetMap.set(s.toUserId, (targetMap.get(s.toUserId) || 0) - s.amount);
    }
  });

  return users.map((user) => {
    const stats = userStats.get(user.id) || {
      currentPaid: 0,
      currentOwed: 0,
      priorPaid: 0,
      priorOwed: 0,
    };

    const priorAdj = priorSettlementsAdjustment.get(user.id) || 0;
    const currentAdj = currentSettlementsAdjustment.get(user.id) || 0;

    // Arrastre histórico pendiente previo a este mes
    const rawCarriedOver = (stats.priorPaid - stats.priorOwed) + priorAdj;
    const carriedOverBalance = Math.round(rawCarriedOver * 100) / 100;

    // Balance neto corriente del mes (empieza en 0 si no hay gastos en este mes)
    const rawCurrentNet = (stats.currentPaid - stats.currentOwed) + currentAdj;
    const currentPeriodNet = Math.round(rawCurrentNet * 100) / 100;

    // Total neto consolidado
    const totalNet = Math.round((carriedOverBalance + currentPeriodNet) * 100) / 100;

    const displayName = user.username ? `@${user.username}` : user.name;

    return {
      userId: user.id,
      userName: displayName,
      currentPeriodPaid: Math.round(stats.currentPaid * 100) / 100,
      currentPeriodOwed: Math.round(stats.currentOwed * 100) / 100,
      currentPeriodNet: currentPeriodNet === 0 ? 0 : currentPeriodNet,
      carriedOverBalance: carriedOverBalance === 0 ? 0 : carriedOverBalance,
      totalNetBalance: totalNet === 0 ? 0 : totalNet,
    };
  });
}
