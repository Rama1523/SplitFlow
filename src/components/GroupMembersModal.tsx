/**
 * SplitFlow — GroupMembersModal Component
 * Gestión completa de integrantes y roles del grupo (WCAG AA).
 * Totalmente internacionalizado con soporte para los 30 idiomas.
 */

import React, { useState } from 'react';
import { 
  Users, 
  Crown, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldPlus, 
  UserMinus, 
  X, 
  UserPlus, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Info
} from 'lucide-react';
import { Group, User } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface GroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  currentUser: User | null;
  onPromoteAdmin: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  onRevokeAdmin: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  onTransferSupremeAdmin: (groupId: string, newSupremeAdminId: string) => Promise<{ success: boolean; error?: string }>;
  onRequestRemoveMember: (member: User) => void;
  onOpenInvite: () => void;
}

export function GroupMembersModal({
  isOpen,
  onClose,
  group,
  currentUser,
  onPromoteAdmin,
  onRevokeAdmin,
  onTransferSupremeAdmin,
  onRequestRemoveMember,
  onOpenInvite,
}: GroupMembersModalProps) {
  const { t } = useI18n();
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const supremeAdminId = group.adminId || group.created_by;
  const isCallerSupremeAdmin = currentUser?.id === supremeAdminId;
  const isCallerAdmin = isCallerSupremeAdmin || group.members.some((m) => m.id === currentUser?.id && m.role === 'admin');

  // Administradores actuales (máximo 4)
  const currentAdmins = group.members.filter((m) => m.id === supremeAdminId || m.role === 'admin');
  const adminCount = currentAdmins.length;
  const isAtAdminLimit = adminCount >= 4;

  const handlePromote = async (member: User) => {
    if (isAtAdminLimit) {
      setErrorMsg(t('groupMembers.limitError'));
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingMemberId(member.id);

    try {
      const res = await onPromoteAdmin(group.id, member.id);
      if (!res.success) {
        setErrorMsg(res.error || t('common.error'));
      } else {
        setSuccessMsg(t('groupMembers.promoteSuccess', { name: member.name }));
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoadingMemberId(null);
    }
  };

  const handleRevoke = async (member: User) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingMemberId(member.id);

    try {
      const res = await onRevokeAdmin(group.id, member.id);
      if (!res.success) {
        setErrorMsg(res.error || t('common.error'));
      } else {
        setSuccessMsg(t('groupMembers.revokeSuccess', { name: member.name }));
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoadingMemberId(null);
    }
  };

  const handleTransferSupreme = async (member: User) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingMemberId(member.id);

    try {
      const res = await onTransferSupremeAdmin(group.id, member.id);
      if (!res.success) {
        setErrorMsg(res.error || t('common.error'));
      } else {
        setSuccessMsg(t('groupMembers.transferSuccess', { name: member.name }));
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoadingMemberId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-members-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200">
              <Users className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 
                  id="group-members-modal-title" 
                  className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight"
                >
                  {t('groupMembers.title')}
                </h3>
                {/* Contador de Administradores (hasta 4) */}
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  isAtAdminLimit 
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}>
                  {t('roles.adminCount', { count: adminCount })}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <span>{group.name}</span>
                <span className="mx-1.5">·</span>
                <span>{group.members.length} {t('common.members').toLowerCase()}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
          </button>
        </div>

        {/* Notificaciones de error o éxito */}
        <div className="px-5 pt-3">
          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2 mb-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 mb-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Banner Informativo de Roles */}
        <div className="px-5 pb-2">
          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('groupMembers.subtitle')}</span>
              </span>
              {isCallerAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInvite();
                  }}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>{t('groupSettings.invite')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Miembros con scroll */}
        <div className="p-5 pt-1 overflow-y-auto space-y-2.5 flex-1">
          {group.members.map((member) => {
            const isMemberSupreme = member.id === supremeAdminId;
            const isMemberAdmin = isMemberSupreme || member.role === 'admin';
            const isSelf = member.id === currentUser?.id;
            const isRowLoading = loadingMemberId === member.id;

            return (
              <div
                key={member.id}
                className={`p-3.5 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isMemberSupreme
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                    : isMemberAdmin
                    ? 'bg-sky-50/30 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Perfil del miembro */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                    isMemberSupreme
                      ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                      : isMemberAdmin
                      ? 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    {(member.username || member.name).slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {member.name}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          ({t('groupMembers.youBadge')})
                        </span>
                      )}

                      {/* Badges de rol */}
                      {isMemberSupreme ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                          <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>{t('roles.supremeAdmin')}</span>
                        </span>
                      ) : isMemberAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-900/80 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800">
                          <ShieldCheck className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>{t('roles.admin')}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {t('roles.member')}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                      {member.username ? `@${member.username}` : member.email}
                    </p>
                  </div>
                </div>

                {/* Acciones de gestión de administradores y expulsión */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                  {/* ACCIONES EXCLUSIVAS DEL ADMIN SUPREMO */}
                  {isCallerSupremeAdmin && !isSelf && (
                    <>
                      {/* Si el integrante es miembro regular: Opción de promover a Admin (máx 4) */}
                      {!isMemberAdmin && (
                        <button
                          type="button"
                          onClick={() => handlePromote(member)}
                          disabled={isRowLoading || isAtAdminLimit}
                          className="px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed min-h-[34px]"
                          title={isAtAdminLimit ? t('groupMembers.maxAdminsReached') : t('groupMembers.promoteAdmin')}
                        >
                          {isRowLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ShieldPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>{t('groupMembers.promoteAdmin')}</span>
                        </button>
                      )}

                      {/* Si el integrante es Administrador secundario: Opción de Revocar Admin */}
                      {isMemberAdmin && !isMemberSupreme && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRevoke(member)}
                            disabled={isRowLoading}
                            className="px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50 min-h-[34px]"
                            title={t('groupMembers.revokeAdmin')}
                          >
                            {isRowLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            )}
                            <span>{t('groupMembers.revokeAdmin')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTransferSupreme(member)}
                            disabled={isRowLoading}
                            className="px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50 min-h-[34px]"
                            title={t('groupMembers.transferSupreme')}
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                            <span>{t('groupMembers.transferSupreme')}</span>
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* Opción de eliminar integrantes (solo administradores, con modal de advertencia) */}
                  {isCallerAdmin && !isSelf && !isMemberSupreme && (
                    (isCallerSupremeAdmin || !isMemberAdmin) && (
                      <button
                        type="button"
                        onClick={() => onRequestRemoveMember(member)}
                        className="px-2.5 py-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs min-h-[34px]"
                        title={t('groupMembers.removeMember')}
                        aria-label={t('groupMembers.removeMember')}
                      >
                        <UserMinus className="w-3.5 h-3.5 stroke-[2px]" />
                        <span>{t('common.delete')}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pie de modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {isCallerSupremeAdmin 
              ? t('roles.supremeAdmin') 
              : isCallerAdmin 
              ? t('roles.admin') 
              : t('roles.member')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer shadow-xs min-h-[38px]"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
