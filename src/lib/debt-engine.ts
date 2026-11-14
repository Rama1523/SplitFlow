/**
 * SplitFlow — Debt Engine
 * Algoritmo de minimización de transferencias cruzadas (Greedy Settlement Graph Algorithm)
 * y cálculo de balances de los usuarios del grupo.
 */

import { User, Expense, SettlementTransaction, UserBalance } from '../types';
import { formatCurrency } from './currencies';

export interface CalculatedSettlement {
  id: string;
  fromUser: User;
  toUser: User;
  amount: number;
  formattedAmount: string;
}

/**
 * Calcula el balance neto de cada usuario a partir de los gastos registrados y pagos ya saldados.
 */
export function calculateUserBalances(
  users: User[],
  expenses: Expense[],
  settlements: SettlementTransaction[] = []
): UserBalance[] {
  // Inicializamos acumuladores por usuario
  const userMap = new Map<string, { totalPaid: number; totalOwed: number; net: number }>();

  users.forEach((u) => {
    userMap.set(u.id, { totalPaid: 0, totalOwed: 0, net: 0 });
  });

  // 1. Sumar gastos
  expenses.forEach((expense) => {
    const payerData = userMap.get(expense.paidByUserId);
    if (payerData) {
      payerData.totalPaid += expense.amount;
      payerData.net += expense.amount;
    }

    expense.splits.forEach((split) => {
      const splitUserData = userMap.get(split.userId);
      if (splitUserData) {
        splitUserData.totalOwed += split.amount;
        splitUserData.net -= split.amount;
      }
    });
  });

  // 2. Ajustar por liquidaciones ya saldadas
  settlements.forEach((s) => {
    if (s.isSettled) {
      const fromData = userMap.get(s.fromUserId);
      const toData = userMap.get(s.toUserId);
      if (fromData) {
        fromData.net += s.amount; // Usuario A pagó a Usuario B, reduce su deuda
      }
      if (toData) {
        toData.net -= s.amount; // Usuario B cobró, reduce lo que se le debe
      }
    }
  });

  return users.map((user) => {
    const data = userMap.get(user.id) || { totalPaid: 0, totalOwed: 0, net: 0 };
    // Redondear a 2 decimales para evitar problemas de coma flotante
    const roundedNet = Math.round(data.net * 100) / 100;

    const displayName = user.username ? `@${user.username}` : user.name;
    return {
      userId: user.id,
      userName: displayName,
      totalPaid: Math.round(data.totalPaid * 100) / 100,
      totalOwed: Math.round(data.totalOwed * 100) / 100,
      netBalance: roundedNet === 0 ? 0 : roundedNet,
    };
  });
}

/**
 * Algoritmo Greedy de Simplificación de Deudas:
 * Transforma un grafo complejo de deudas en el número mínimo de pagos directos.
 */
export function calculateOptimalSettlements(
  users: User[],
  balances: UserBalance[],
  currencyCode = 'EUR'
): CalculatedSettlement[] {
  const userById = new Map<string, User>();
  users.forEach((u) => userById.set(u.id, u));

  interface NodeBalance {
    userId: string;
    amount: number;
  }

  const debtors: NodeBalance[] = [];
  const creditors: NodeBalance[] = [];

  balances.forEach((b) => {
    // Tolerancia de 0.01 para evitar micro-transacciones debidas a redondeo
    if (b.netBalance < -0.01) {
      debtors.push({ userId: b.userId, amount: Math.abs(b.netBalance) });
    } else if (b.netBalance > 0.01) {
      creditors.push({ userId: b.userId, amount: b.netBalance });
    }
  });

  const settlements: CalculatedSettlement[] = [];

  // Ordenar deudores y acreedores de mayor a menor para emparejamiento óptimo
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let i = 0; // puntero deudores
  let j = 0; // puntero acreedores

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledAmount = Math.min(debtor.amount, creditor.amount);
    const roundedAmount = Math.round(settledAmount * 100) / 100;

    if (roundedAmount >= 0.01) {
      const fromUser = userById.get(debtor.userId);
      const toUser = userById.get(creditor.userId);

      if (fromUser && toUser) {
        settlements.push({
          id: `opt-settle-${debtor.userId}-${creditor.userId}-${i}-${j}`,
          fromUser,
          toUser,
          amount: roundedAmount,
          formattedAmount: formatCurrency(roundedAmount, currencyCode),
        });
      }
    }

    debtor.amount = Math.round((debtor.amount - settledAmount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - settledAmount) * 100) / 100;

    if (debtor.amount <= 0.005) {
      i++;
    }
    if (creditor.amount <= 0.005) {
      j++;
    }
  }

  return settlements;
}
