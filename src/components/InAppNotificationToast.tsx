import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Receipt, 
  Sparkles, 
  ShieldCheck, 
  Crown, 
  AlertTriangle, 
  X, 
  ArrowRight 
} from 'lucide-react';
import { AppNotification } from '../types';
import { notificationService } from '../lib/capacitor/notifications';

interface InAppNotificationToastProps {
  onSelectGroup?: (groupId: string) => void;
  onOpenRequestsModal?: () => void;
}

export function InAppNotificationToast({
  onSelectGroup,
  onOpenRequestsModal,
}: InAppNotificationToastProps) {
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribeToast((notification) => {
      setActiveToast(notification);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 5500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  if (!activeToast) return null;

  const handleAction = () => {
    notificationService.markAsRead(activeToast.id);
    if (activeToast.type === 'GROUP_INVITE' && onOpenRequestsModal) {
      onOpenRequestsModal();
    } else if (activeToast.groupId && onSelectGroup) {
      onSelectGroup(activeToast.groupId);
    }
    setActiveToast(null);
  };

  const renderIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'ADMIN_PROMOTED':
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 'GROUP_INVITE':
        return <Mail className="w-4 h-4 text-emerald-500" />;
      case 'EXPENSE_ADDED':
      case 'EXPENSE_UPDATED':
        return <Receipt className="w-4 h-4 text-blue-500" />;
      case 'SETTLEMENT_PAYMENT':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'BUDGET_ALERT':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'SECURITY_ALERT':
      default:
        return <ShieldCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div 
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-slate-900 dark:bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700/80 p-3.5 flex items-start gap-3 backdrop-blur-md">
        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
          {renderIcon(activeToast.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white truncate">
              {activeToast.title}
            </h4>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              Ahora
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-snug mt-1">
            {activeToast.message}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            {(activeToast.groupId || activeToast.type === 'GROUP_INVITE') && (
              <button
                type="button"
                onClick={handleAction}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-slate-950 text-[10px] font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                <span>Ver en la app</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                notificationService.markAsRead(activeToast.id);
                setActiveToast(null);
              }}
              className="px-2 py-1 text-[10px] text-slate-400 hover:text-white transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveToast(null)}
          aria-label="Cerrar notificación"
          className="text-slate-400 hover:text-white transition p-1 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
