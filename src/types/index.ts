/**
 * SplitFlow — TypeScript Core Domain Types & Interfaces
 * Modelo de datos completo y estrictamente tipado para la gestión de gastos,
 * presupuestos, participantes y algoritmos de simplificación de deudas.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string; // Nombre de usuario único (ej: @usuario_1)
  avatar?: string;
  monthlyIncome?: number; // Para repartos proporcionales según ingresos (opcional)
  role?: 'admin' | 'member';
  isEmailVerified?: boolean; // Para doble verificación obligatoria
  preferredCurrency?: string; // Divisa personal del usuario (ej: 'EUR', 'USD', 'MXN', 'ARS')
  emailNotifications?: boolean; // Notificaciones por correo de gastos y liquidaciones
}

export interface PublicUser {
  id: string;
  username: string;
  isPastContact?: boolean;
  sharedGroupsCount?: number;
}

export type GroupCategory = 'HOME' | 'TRIP' | 'COUPLE' | 'EVENT' | 'OTHER';

export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type RequestType = 'GROUP_INVITE' | 'FRIEND_REQUEST';

export interface GroupInvitation {
  id: string;
  type: RequestType;
  groupId?: string;
  groupName?: string;
  groupCategory?: GroupCategory;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderUsername?: string;
  recipientEmail: string;
  recipientUsername?: string;
  recipientUserId?: string;
  recipientName?: string;
  status: RequestStatus;
  isRead: boolean; // Para notificación de solicitudes sin leer ("Nueva")
  createdAt: string;
  respondedAt?: string;
}

export type CategoryType =
  | 'HOUSING'
  | 'FOOD'
  | 'ENTERTAINMENT'
  | 'UTILITIES'
  | 'TRANSPORT'
  | 'OTHER';

export interface Category {
  id: string;
  type: CategoryType;
  name: string;
  icon: string; // Nombre del icono de Lucide (ej: Home, Utensils, Zap, etc.)
  color: string; // Color Tailwind o HEX
  monthlyBudgetLimit: number;
}

export type SplitType =
  | 'EQUAL'
  | 'PERCENTAGE'
  | 'EXACT'
  | 'INCOME_PROPORTIONAL';

export interface SplitDetail {
  userId: string;
  amount: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidByUserId: string;
  splitType: SplitType;
  splits: SplitDetail[];
  category: CategoryType;
  createdAt: string; // ISO 8601 String
  notes?: string;
  receiptUrl?: string;
}

export interface GroupBudgetBlock {
  category: CategoryType;
  isActive: boolean;
  limit: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  category?: GroupCategory;
  members: User[];
  currency: string; // Ej: 'EUR', 'USD', 'GBP'
  createdAt: string;
  avatar?: string;
  inviteCode?: string; // Código de invitación único (ej: 'SF-7K8M9P')
  codigoGrupo?: string;
  adminId?: string; // ID del usuario administrador actual del grupo (admin_id)
  created_by?: string;
  budgetBlocks?: GroupBudgetBlock[]; // Bloques de gastos y presupuestos personalizables
  incomeModuleEnabled?: boolean; // Controla si el grupo activa el módulo de ingresos y reparto proporcional
}

export interface UserPreferences {
  currency: string;
  emailNotifications: boolean;
  settlementAlerts: boolean;
}

export type SettlementPaymentMethod = 'BIZUM' | 'TRANSFER' | 'CASH' | 'OTHER';

export interface SettlementTransaction {
  id?: string;
  groupId?: string; // ID del grupo al que pertenece la liquidación para aislamiento estricto
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  isSettled: boolean;
  settledAt?: string;
  paymentMethod?: SettlementPaymentMethod;
}

/**
 * Tipos auxiliares para cálculo de balances y analítica en tiempo real
 */
export interface UserBalance {
  userId: string;
  userName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // Positivo: le deben dinero, Negativo: debe dinero
}

export interface CategoryBudgetStatus {
  category: Category;
  spent: number;
  budgetLimit: number;
  remaining: number;
  percentageUsed: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED'; // SAFE (<80%), WARNING (80-100%), EXCEEDED (>100%)
}

export interface ActivityFeedItem {
  id: string;
  type: 'EXPENSE_ADDED' | 'EXPENSE_UPDATED' | 'SETTLEMENT_COMPLETED' | 'MEMBER_JOINED';
  title: string;
  description: string;
  timestamp: string;
  userId: string;
  amount?: number;
  currency?: string;
}

export type NotificationType =
  | 'GROUP_INVITE'
  | 'EXPENSE_ADDED'
  | 'EXPENSE_UPDATED'
  | 'SETTLEMENT_PAYMENT'
  | 'SECURITY_ALERT'
  | 'ADMIN_PROMOTED'
  | 'BUDGET_ALERT';

export interface AppNotification {
  id: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  groupId?: string;
  groupName?: string;
  targetId?: string;
  actionUrl?: string;
  metadata?: Record<string, string | number | boolean>;
}


