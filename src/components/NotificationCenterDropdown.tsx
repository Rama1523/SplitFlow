import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Mail, 
  Receipt, 
  Sparkles, 
  ShieldCheck, 
  Crown,
  AlertTriangle,
  X,
  ExternalLink,
  Clock
} from 'lucide-react';
import { AppNotification } from '../types';
import { notificationService } from '../lib/capacitor/notifications';
import { useI18n } from '../i18n/I18nContext';

interface NotificationCenterDropdownProps {
  onOpenRequestsModal: () => void;
  onSelectGroup?: (groupId: string) => void;
  theme?: 'light' | 'dark';
}

export function NotificationCenterDropdown({
  onOpenRequestsModal,
  onSelectGroup,
}: NotificationCenterDropdownProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((updated) => {
      setNotifications(updated);
    });
    return () => unsubscribe();
  }, []);

  // Cerrar al pulsar Escape o al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (notification: AppNotification) => {
    notificationService.markAsRead(notification.id);
    if (notification.type === 'GROUP_INVITE') {
      setIsOpen(false);
      onOpenRequestsModal();
    } else if (notification.groupId && onSelectGroup) {
      setIsOpen(false);
      onSelectGroup(notification.groupId);
    }
  };

  const formatTimestamp = (isoDate: string): string => {
    try {
      const d = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 2) return t('notifications.justNow');
      if (diffMins < 60) return t('notifications.minsAgo', { mins: diffMins });
      if (diffHours < 24) return t('notifications.hoursAgo', { hours: diffHours });
      if (diffDays === 1) return t('notifications.yesterday');
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const renderIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'ADMIN_PROMOTED':
        return <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2px]" aria-hidden="true" />;
      case 'GROUP_INVITE':
        return <Mail className="w-4 h-4 text-emerald-700 dark:text-emerald-400 stroke-[1.75px]" aria-hidden="true" />;
      case 'EXPENSE_ADDED':
      case 'EXPENSE_UPDATED':
        return <Receipt className="w-4 h-4 text-slate-800 dark:text-slate-200 stroke-[1.75px]" aria-hidden="true" />;
      case 'SETTLEMENT_PAYMENT':
        return <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-400 stroke-[1.75px]" aria-hidden="true" />;
      case 'BUDGET_ALERT':
        return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[1.75px]" aria-hidden="true" />;
      case 'SECURITY_ALERT':
      default:
        return <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.75px]" aria-hidden="true" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Boton de Campana de Notificaciones (Target tactil >= 44x44px) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${t('notifications.title')}. ${unreadCount}`}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
      >
        <Bell className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel Desplegable In-App (Linear/Stripe style) */}
      {isOpen && (
        <div
          role="region"
          aria-label={t('notifications.title')}
          className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[80vh] bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Cabecera del Panel */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {t('notifications.title')}
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => notificationService.markAllAsRead()}
                  title={t('notifications.markAllRead')}
                  aria-label={t('notifications.markAllRead')}
                  className="min-h-[36px] px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('notifications.markAllRead')}</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => notificationService.clearAll()}
                  title={t('notifications.clearAll')}
                  aria-label={t('notifications.clearAll')}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t('common.close')}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Lista de Notificaciones */}
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(notification);
                    }
                  }}
                  className={`min-h-[56px] p-3 transition flex items-start gap-3 cursor-pointer text-left focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 ${
                    notification.isRead
                      ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 opacity-80'
                      : 'bg-slate-50/70 dark:bg-slate-855 hover:bg-slate-100/70 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  <div className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    {renderIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {notification.title}
                      </p>
                      <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono text-slate-400">
                        <Clock className="w-2.5 h-2.5" aria-hidden="true" />
                        <span>{formatTimestamp(notification.createdAt)}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                      {notification.message}
                    </p>

                    {notification.type === 'ADMIN_PROMOTED' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                          <Crown className="w-2.5 h-2.5" />
                          <span>{t('roles.admin')}</span>
                        </span>
                        {notification.groupName && (
                          <span className="text-[10px] text-slate-500 font-medium truncate">
                            {notification.groupName}
                          </span>
                        )}
                      </div>
                    )}

                    {notification.type === 'BUDGET_ALERT' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>{t('nav.budget')}</span>
                        </span>
                      </div>
                    )}

                    {notification.type === 'GROUP_INVITE' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 underline flex items-center gap-0.5">
                          {t('emptyState.viewInvitesBtn', { count: 1 })}
                          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                        </span>
                      </div>
                    )}
                  </div>

                  {!notification.isRead && (
                    <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-slate-100 shrink-0 mt-2" aria-hidden="true" />
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                  <Bell className="w-5 h-5 stroke-[1.5px]" aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('notifications.empty')}
                </p>
              </div>
            )}
          </div>

          {/* Pie del Panel */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                Notificaciones sincronizadas con dispositivo
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
