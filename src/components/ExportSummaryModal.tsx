/**
 * SplitFlow — ExportSummaryModal Component
 * Módulo para exportar el resumen mensual del hogar en varios formatos:
 * - Copia formateada con balances y transferencias.
 * - Descarga directa en archivo CSV compatible con Excel/Google Sheets.
 * - Descarga en formato JSON para copias de seguridad.
 * Adaptado a Modo Claro y Modo Oscuro con soporte multilingüe y de todas las divisas.
 * Totalmente sin emoticonos.
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileText, 
  Table, 
  Share2
} from 'lucide-react';
import { User, Expense, Category, Group, UserBalance } from '../types';
import { CalculatedSettlement } from '../lib/debt-engine';
import { useI18n } from '../i18n/I18nContext';

interface ExportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  users: User[];
  expenses: Expense[];
  categories: Category[];
  balances: UserBalance[];
  optimalTransfers: CalculatedSettlement[];
}

export function ExportSummaryModal({
  isOpen,
  onClose,
  group,
  users,
  expenses,
  categories,
  balances,
  optimalTransfers,
}: ExportSummaryModalProps) {
  const { t, formatAmount, currentLanguageMeta } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const textSummary = useMemo(() => {
    const today = new Date().toLocaleDateString(currentLanguageMeta.locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let text = `*SPLITFLOW — ${group.name.toUpperCase()}*\n`;
    text += `${t('expenses.colDate')}: ${today}\n`;
    text += `${t('metrics.totalSpent')}: ${formatAmount(totalSpent, group.currency)}\n\n`;

    text += `*${t('settlement.netBalancesTitle').toUpperCase()}:*\n`;
    balances.forEach((b) => {
      const sign = b.netBalance > 0 ? `(+) ${t('settlement.positiveBalance')}` : b.netBalance < 0 ? `(-) ${t('settlement.negativeBalance')}` : `(=) ${t('settlement.neutralBalance')}`;
      text += `• ${b.userName}: ${formatAmount(b.netBalance, group.currency)} [${sign}]\n`;
    });

    text += `\n*${t('settlement.optimalTransfersTitle').toUpperCase()}:*\n`;
    if (optimalTransfers.length === 0) {
      text += `• ${t('settlement.allBalancesEven')}\n`;
    } else {
      optimalTransfers.forEach((tr) => {
        text += `• ${tr.fromUser.name} -> ${formatAmount(tr.amount, group.currency)} -> ${tr.toUser.name}\n`;
      });
    }

    text += `\n${t('landing.footerCopyright')}`;
    return text;
  }, [group, totalSpent, balances, optimalTransfers, currentLanguageMeta.locale, t, formatAmount]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(textSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['ID', 'Date', 'Description', 'Category', 'Amount', 'Currency', 'PaidBy', 'SplitType'];
    const rows = expenses.map((e) => {
      const payer = users.find((u) => u.id === e.paidByUserId)?.name || e.paidByUserId;
      return [
        e.id,
        new Date(e.createdAt).toISOString().split('T')[0],
        `"${e.description.replace(/"/g, '""')}"`,
        e.category,
        e.amount.toFixed(2),
        group.currency,
        `"${payer}"`,
        e.splitType,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SplitFlow_${group.name.replace(/\s+/g, '_')}_expenses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJSON = () => {
    const data = {
      group,
      users,
      expenses,
      categories,
      balances,
      optimalTransfers,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `SplitFlow_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">{t('export.title')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('export.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <X className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* Opciones de Exportación Rápida con Targets >= 44x44px */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleCopyText}
              className="min-h-[44px] p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-left transition flex flex-col justify-between space-y-3 cursor-pointer group shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  {copied ? <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 stroke-[1.75px]" aria-hidden="true" /> : <Copy className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                </div>
                {copied && (
                  <span className="text-[10px] font-mono font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-sm border border-emerald-300 dark:border-emerald-800">
                    {t('common.copied')}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">{t('export.formatText')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('export.copyBtn')}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="min-h-[44px] p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-left transition flex flex-col justify-between space-y-3 cursor-pointer group shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  <Table className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">{t('export.formatCsv')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('export.downloadBtn')}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadJSON}
              className="min-h-[44px] p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-left transition flex flex-col justify-between space-y-3 cursor-pointer group shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  <FileText className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">{t('export.formatJson')}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('export.downloadBtn')}</p>
              </div>
            </button>
          </div>

          {/* Vista previa del informe en texto */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('export.subtitle')}:
              </span>
              <button
                type="button"
                onClick={handleCopyText}
                className="min-h-[44px] inline-flex items-center gap-1.5 text-xs text-slate-900 dark:text-slate-100 hover:underline font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 stroke-[1.75px]" aria-hidden="true" /> : <Copy className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />}
                <span>{copied ? t('common.copied') : t('export.copyBtn')}</span>
              </button>
            </div>

            <pre className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
              {textSummary}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
