/**
 * SplitFlow — BalancesAndSettlement Component
 * Vista integral de balances netos individuales y motor de liquidación óptima
 * (Debt Minimization Algorithm) para registrar pagos manuales con el mínimo número de transferencias.
 * Adaptado a Modo Claro y Modo Oscuro con soporte multilingüe y de todas las divisas (Euros, Pesos, Libras, Dólares).
 * SIN emoticonos en toda la interfaz.
 */

import { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  CheckCircle, 
  Sparkles, 
  Wallet, 
  CheckCheck, 
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Info,
  X,
  CreditCard,
  Banknote,
  Smartphone
} from 'lucide-react';
import { User, Expense, SettlementTransaction, UserBalance, SettlementPaymentMethod } from '../types';
import { calculateUserBalances, calculateOptimalSettlements, CalculatedSettlement } from '../lib/debt-engine';
import { useI18n } from '../i18n/I18nContext';
import { convertAmount, formatCurrencyAmount } from '../lib/exchangeRates';
import { 
  calculateMonthlyUserBalances, 
  getCurrentMonthKey, 
  formatMonthLabel,
  MonthlyUserBalanceBreakdown 
} from '../lib/monthly-analytics';

interface BalancesAndSettlementProps {
  users: User[];
  expenses: Expense[];
  settlements: SettlementTransaction[];
  currency?: string;
  userPreferredCurrency?: string;
  selectedMonth?: string;
  groupId?: string;
  onSettleDebt: (settlement: SettlementTransaction) => void;
  onResetSettlements?: () => void;
}

export function BalancesAndSettlement({
  users,
  expenses,
  settlements,
  currency = 'EUR',
  userPreferredCurrency,
  selectedMonth,
  groupId,
  onSettleDebt,
  onResetSettlements,
}: BalancesAndSettlementProps) {
  const { t, formatAmount } = useI18n();
  const [selectedSettlement, setSelectedSettlement] = useState<CalculatedSettlement | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<SettlementPaymentMethod>('BIZUM');
  const [justSettledId, setJustSettledId] = useState<string | null>(null);

  const activeMonth = selectedMonth || getCurrentMonthKey();
  const monthlyBreakdowns = calculateMonthlyUserBalances(users, expenses, settlements, activeMonth);
  const monthlyMap = new Map<string, MonthlyUserBalanceBreakdown>(
    monthlyBreakdowns.map((mb) => [mb.userId, mb])
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedSettlement) {
        setSelectedSettlement(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedSettlement]);

  // Balances netos calculados
  const balances: UserBalance[] = calculateUserBalances(users, expenses, settlements);

  // Transferencias óptimas sugeridas
  const optimalTransfers: CalculatedSettlement[] = calculateOptimalSettlements(users, balances, currency);

  // Confirmar y marcar liquidación externa manual
  const handleConfirmSettlement = () => {
    if (!selectedSettlement) return;

    const newSettlement: SettlementTransaction = {
      id: `settle-${Date.now()}`,
      groupId,
      fromUserId: selectedSettlement.fromUser.id,
      toUserId: selectedSettlement.toUser.id,
      amount: selectedSettlement.amount,
      currency,
      isSettled: true,
      settledAt: new Date().toISOString(),
      paymentMethod: selectedMethod,
    };

    onSettleDebt(newSettlement);
    const settledId = selectedSettlement.id;
    setSelectedSettlement(null);
    setJustSettledId(settledId);
    setTimeout(() => setJustSettledId(null), 2500);
  };

  const totalOwedInGroup = balances
    .filter((b) => b.netBalance < 0)
    .reduce((sum, b) => sum + Math.abs(b.netBalance), 0);

  return (
    <div className="space-y-8 font-sans">
      {/* 1. SECCIÓN DE BALANCES INDIVIDUALES */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 stroke-[1.75px] text-slate-600 dark:text-slate-400" />
              {t('settlement.netBalancesTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('metrics.totalToEven')} ({currency})
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 shadow-xs">
            <span>{t('metrics.pendingSettlement')}:</span>
            <span className="font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
              {formatAmount(totalOwedInGroup, currency)}
            </span>
          </div>
        </div>

        {/* Grid de Balances Individuales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {balances.map((balance) => {
            const isCreditor = balance.netBalance > 0.01;
            const isDebtor = balance.netBalance < -0.01;

            return (
              <div
                key={balance.userId}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all flex flex-col justify-between shadow-xs"
              >
                {/* Cabecera del usuario */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {balance.userName.replace('@', '').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 truncate">{balance.userName}</h4>
                    <span
                      className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-sm inline-block mt-0.5 border ${
                        isCreditor
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
                          : isDebtor
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isCreditor
                        ? t('settlement.positiveBalance')
                        : isDebtor
                        ? t('settlement.negativeBalance')
                        : t('settlement.neutralBalance')}
                    </span>
                  </div>
                </div>

                {/* Importe Neto */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Neto:</span>
                    <div className="text-right">
                      <span
                        className={`text-base font-mono font-bold tabular-nums ${
                          isCreditor
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isDebtor
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isCreditor ? '+' : ''}
                        {formatAmount(balance.netBalance, currency)}
                      </span>
                      {userPreferredCurrency && userPreferredCurrency.toUpperCase() !== currency.toUpperCase() && (
                        <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          ≈ {isCreditor ? '+' : ''}{formatCurrencyAmount(convertAmount(balance.netBalance, currency, userPreferredCurrency), userPreferredCurrency)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                    <span>{t('budget.spent')}: {formatAmount(balance.totalPaid, currency)}</span>
                    <span>Consumo: {formatAmount(balance.totalOwed, currency)}</span>
                  </div>

                  {/* Desglose de ciclo mensual y arrastre histórico */}
                  {(() => {
                    const mb = monthlyMap.get(balance.userId);
                    if (!mb) return null;
                    return (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono space-y-0.5">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Periodo {formatMonthLabel(activeMonth).split(' ')[0]}:</span>
                          <span className={mb.currentPeriodNet > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : mb.currentPeriodNet < 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500'}>
                            {mb.currentPeriodNet > 0 ? '+' : ''}{formatAmount(mb.currentPeriodNet, currency)}
                          </span>
                        </div>
                        {mb.carriedOverBalance !== 0 && (
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>Arrastre previo:</span>
                            <span className={mb.carriedOverBalance > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                              {mb.carriedOverBalance > 0 ? '+' : ''}{formatAmount(mb.carriedOverBalance, currency)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MOTOR DE LIQUIDACIÓN ÓPTIMA */}
      <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Sparkles className="w-4 h-4 stroke-[1.75px]" />
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('settlement.optimalTransfersTitle')}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('settlement.optimalTransfersDesc')}
            </p>
          </div>

          {onResetSettlements && settlements.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(t('settlement.resetConfirm'))) {
                  onResetSettlements();
                }
              }}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[1.75px]" />
              <span>{t('settlement.resetAll')}</span>
            </button>
          )}
        </div>

        {/* NOTA ACLARATORIA */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
          <Info className="w-4 h-4 stroke-[1.75px] text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              {t('landing.disclaimerTitle')}:
            </span>
            {t('settlement.disclaimer')}
          </div>
        </div>

        {/* Lista de Transferencias Sugeridas */}
        <div>
          {optimalTransfers.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 border border-emerald-200 dark:border-emerald-900">
                <CheckCircle className="w-5 h-5 stroke-[1.75px]" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('settlement.allBalancesEven')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('metrics.allSettled')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {optimalTransfers.map((transfer) => {
                const isExecuting = justSettledId === transfer.id;

                return (
                  <div
                    key={transfer.id}
                    className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 shadow-xs"
                  >
                    {/* Visualización de la Transferencia de A a B */}
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      {/* Deudor */}
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-semibold flex items-center justify-center text-xs shrink-0">
                          {(transfer.fromUser.username || transfer.fromUser.name).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold font-mono text-slate-900 dark:text-slate-100 truncate">@{transfer.fromUser.username || transfer.fromUser.name}</p>
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate block">
                            {t('settlement.negativeBalance')}
                          </span>
                        </div>
                      </div>

                      {/* Flecha y Monto */}
                      <div className="flex flex-col items-center px-1 sm:px-2 shrink-0">
                        <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-0.5 rounded-md whitespace-nowrap tabular-nums">
                          {transfer.formattedAmount}
                        </span>
                        {userPreferredCurrency && userPreferredCurrency.toUpperCase() !== currency.toUpperCase() && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 tabular-nums">
                            ≈ {formatCurrencyAmount(convertAmount(transfer.amount, currency, userPreferredCurrency), userPreferredCurrency)}
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-slate-400 mt-1">
                          <div className="w-2.5 sm:w-4 h-px bg-slate-300 dark:bg-slate-700" />
                          <ArrowRight className="w-3.5 h-3.5 stroke-[1.75px] text-slate-600 dark:text-slate-400 shrink-0" />
                          <div className="w-2.5 sm:w-4 h-px bg-slate-300 dark:bg-slate-700" />
                        </div>
                      </div>

                      {/* Receptor */}
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 justify-end text-right">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold font-mono text-slate-900 dark:text-slate-100 truncate">@{transfer.toUser.username || transfer.toUser.name}</p>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate block">
                            {t('settlement.positiveBalance')}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-semibold flex items-center justify-center text-xs shrink-0">
                          {(transfer.toUser.username || transfer.toUser.name).slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Botón de Acción */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t('metrics.manualTransfersRoute')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSettlement(transfer);
                          setSelectedMethod('BIZUM');
                        }}
                        disabled={isExecuting}
                        aria-label={`${t('settlement.markAsSettled')}: ${transfer.fromUser.name} -> ${transfer.toUser.name}`}
                        className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                          isExecuting
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-xs active:scale-[0.99]'
                        }`}
                      >
                        {isExecuting ? (
                          <>
                            <CheckCheck className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
                            <span>{t('settlement.modalConfirmBtn')}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                            <span>{t('settlement.markAsSettled')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historial de Liquidaciones Registradas */}
        {settlements.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[1.75px]" aria-hidden="true" />
              <span>{t('settlement.historyTitle')}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {settlements.map((s) => {
                const fromU = users.find((u) => u.id === s.fromUserId);
                const toU = users.find((u) => u.id === s.toUserId);
                if (!fromU || !toU) return null;

                const methodLabel = 
                  s.paymentMethod === 'BIZUM' ? t('settlement.methodBizum') :
                  s.paymentMethod === 'TRANSFER' ? t('settlement.methodTransfer') :
                  s.paymentMethod === 'CASH' ? t('settlement.methodCash') : t('settlement.methodOther');

                return (
                  <div
                    key={s.id || `${s.fromUserId}-${s.toUserId}-${s.amount}`}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-semibold inline-flex items-center justify-center">
                        {(fromU.username || fromU.name).slice(0, 2).toUpperCase()}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 stroke-[1.75px]" aria-hidden="true" />
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-semibold inline-flex items-center justify-center">
                        {(toU.username || toU.name).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="truncate max-w-[150px]">
                        <p className="text-slate-900 dark:text-slate-100 font-mono font-semibold truncate text-[11px]">
                          @{fromU.username || fromU.name} → @{toU.username || toU.name}
                        </p>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {methodLabel}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatAmount(s.amount, s.currency || currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      {selectedSettlement && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="settlement-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-5 relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium">
                  {t('settlement.title')}
                </span>
                <h3 id="settlement-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {t('settlement.modalTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSettlement(null)}
                aria-label={t('common.close')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <X className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
              </button>
            </div>

            {/* Resumen del movimiento */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('expenses.amountLabel')}:</span>
                <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {selectedSettlement.formattedAmount}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t('settlement.negativeBalance')}</span>
                  <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">@{selectedSettlement.fromUser.username || selectedSettlement.fromUser.name}</span>
                </div>
                <ArrowRight className="w-4 h-4 stroke-[1.75px] text-slate-400" aria-hidden="true" />
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t('settlement.positiveBalance')}</span>
                  <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">@{selectedSettlement.toUser.username || selectedSettlement.toUser.name}</span>
                </div>
              </div>
            </div>

            {/* Selector de Método de Pago con Targets >= 44x44px */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                {t('settlement.modalPaymentMethod')}:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('BIZUM')}
                  className={`min-h-[44px] p-2.5 rounded-md border text-left text-xs font-medium flex items-center gap-2.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                    selectedMethod === 'BIZUM'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Smartphone className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                  <span>{t('settlement.methodBizum')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('TRANSFER')}
                  className={`min-h-[44px] p-2.5 rounded-md border text-left text-xs font-medium flex items-center gap-2.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                    selectedMethod === 'TRANSFER'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <CreditCard className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                  <span>{t('settlement.methodTransfer')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('CASH')}
                  className={`min-h-[44px] p-2.5 rounded-md border text-left text-xs font-medium flex items-center gap-2.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                    selectedMethod === 'CASH'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Banknote className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                  <span>{t('settlement.methodCash')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('OTHER')}
                  className={`min-h-[44px] p-2.5 rounded-md border text-left text-xs font-medium flex items-center gap-2.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                    selectedMethod === 'OTHER'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Wallet className="w-4 h-4 stroke-[1.75px] shrink-0" aria-hidden="true" />
                  <span>{t('settlement.methodOther')}</span>
                </button>
              </div>
            </div>

            {/* Mensaje Informativo */}
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="text-slate-700 dark:text-slate-300 font-medium block mb-0.5">
                {t('landing.disclaimerTitle')}:
              </span>
              {t('landing.disclaimerText')}
            </div>

            {/* Botones de Acción con Targets >= 44x44px */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSettlement(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmSettlement}
                className="min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 active:scale-[0.99] transition shadow-xs flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <CheckCircle className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                <span>{t('settlement.modalConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
