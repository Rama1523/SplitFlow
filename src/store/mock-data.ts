/**
 * SplitFlow — Domain Configuration & Seedless Store
 * Se han eliminado completamente todos los datos ficticios, usuarios de prueba
 * y transacciones mock para operar de forma exclusiva con datos reales en Supabase.
 */

import { User, Category, Group, Expense, SettlementTransaction, GroupInvitation } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-housing',
    type: 'HOUSING',
    name: 'Vivienda y Alquiler',
    icon: 'Home',
    color: '#3B82F6',
    monthlyBudgetLimit: 1200,
  },
  {
    id: 'cat-food',
    type: 'FOOD',
    name: 'Alimentación y Supermercado',
    icon: 'Utensils',
    color: '#10B981',
    monthlyBudgetLimit: 500,
  },
  {
    id: 'cat-utilities',
    type: 'UTILITIES',
    name: 'Suministros (Luz, Agua, Wifi)',
    icon: 'Zap',
    color: '#F59E0B',
    monthlyBudgetLimit: 200,
  },
  {
    id: 'cat-entertainment',
    type: 'ENTERTAINMENT',
    name: 'Ocio y Salidas',
    icon: 'Film',
    color: '#EC4899',
    monthlyBudgetLimit: 250,
  },
  {
    id: 'cat-transport',
    type: 'TRANSPORT',
    name: 'Transporte y Viajes',
    icon: 'Car',
    color: '#8B5CF6',
    monthlyBudgetLimit: 150,
  },
  {
    id: 'cat-other',
    type: 'OTHER',
    name: 'Otros y Varios',
    icon: 'MoreHorizontal',
    color: '#6B7280',
    monthlyBudgetLimit: 100,
  },
];

export const MOCK_CATEGORIES = DEFAULT_CATEGORIES;

// Arrays vacíos garantizados: No existen usuarios, grupos ni transacciones mock
export const MOCK_USERS: User[] = [];
export const MOCK_REQUESTS: GroupInvitation[] = [];
export const MOCK_GROUPS: Group[] = [];
export const MOCK_EXPENSES: Expense[] = [];
export const MOCK_SETTLEMENTS: SettlementTransaction[] = [];
export const MOCK_GROUP = undefined;
