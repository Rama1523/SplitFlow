/**
 * SplitFlow — RequestsModal Component
 * Vista modal accesible (WCAG AAA) de gestión de solicitudes de amistad y unión a grupos.
 * Reglas estrictas:
 * 1. Solo se puede invitar buscando por nombre de usuario o correo electrónico.
 * 2. Vistas separadas: "Recibidas" y "Enviadas".
 * 3. Indicador y badge de "Nueva" en solicitudes pendientes sin leer.
 * 4. Acciones: "Aceptar" (agrega al miembro al grupo) o "Rechazar".
 * Targets táctiles >= 44x44px, navegación completa por teclado, contraste óptimo y diseño corporativo limpio.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  Check, 
  Ban, 
  Search, 
  Clock, 
  UserPlus, 
  ShieldAlert,
  Home,
  Plane,
  Heart,
  PartyPopper,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  History,
  UserCheck,
  Users
} from 'lucide-react';
import { Group, GroupInvitation, User, PublicUser } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { sanitizeTextInput } from '../lib/security';

interface RequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  groups: Group[];
  activeGroupId?: string;
  allUsers: User[];
  requests: GroupInvitation[];
  onAcceptRequest: (request: GroupInvitation) => void;
  onRejectRequest: (request: GroupInvitation) => void;
  onCancelRequest: (requestId: string) => void;
  onSendRequest: (data: { groupId: string; recipientQuery: string }) => { success: boolean; error?: string };
  onMarkAllAsRead: () => void;
  onSearchUsers?: (query: string, excludeGroupId?: string) => Promise<PublicUser[]>;
  onGetContactSuggestions?: (excludeGroupId?: string) => Promise<PublicUser[]>;
}

export function RequestsModal({
  isOpen,
  onClose,
  currentUser,
  groups,
  activeGroupId,
  allUsers,
  requests,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
  onSendRequest,
  onMarkAllAsRead,
  onSearchUsers,
  onGetContactSuggestions,
}: RequestsModalProps) {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Formulario para invitar
  const [selectedGroupId, setSelectedGroupId] = useState<string>(activeGroupId || (groups[0]?.id || ''));
  const [searchQuery, setSearchQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Sugerencias de contactos previos (historial de grupos compartidos)
  const [contactSuggestions, setContactSuggestions] = useState<PublicUser[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Búsqueda predictiva (debounced autocomplete)
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Miembros actuales del grupo seleccionado para verificar si ya pertenecen
  const selectedGroupMembers = useMemo(() => {
    const grp = groups.find((g) => g.id === selectedGroupId);
    return new Set(grp ? grp.members.map((m) => m.id) : []);
  }, [groups, selectedGroupId]);

  // Cargar sugerencias automáticas de contactos previos al abrir el formulario o cambiar de grupo
  useEffect(() => {
    let isCurrent = true;
    if (isOpen) {
      setIsLoadingSuggestions(true);
      if (onGetContactSuggestions) {
        onGetContactSuggestions(selectedGroupId)
          .then((suggs) => {
            if (isCurrent) {
              setContactSuggestions(suggs);
              setIsLoadingSuggestions(false);
            }
          })
          .catch(() => {
            if (isCurrent) setIsLoadingSuggestions(false);
          });
      } else {
        // Fallback local: co-miembros en otros grupos
        const countMap = new Map<string, { username: string; count: number }>();
        for (const g of groups) {
          for (const m of g.members) {
            if (m.id !== currentUser.id) {
              const uName = m.username || m.name.toLowerCase().replace(/\s+/g, '_');
              const existing = countMap.get(m.id);
              if (existing) {
                existing.count += 1;
              } else {
                countMap.set(m.id, { username: uName, count: 1 });
              }
            }
          }
        }
        const targetGroup = groups.find((g) => g.id === selectedGroupId);
        const memberIds = new Set(targetGroup ? targetGroup.members.map((m) => m.id) : []);

        const suggs: PublicUser[] = Array.from(countMap.entries())
          .filter(([id]) => !memberIds.has(id))
          .map(([id, info]) => ({
            id,
            username: info.username,
            isPastContact: true,
            sharedGroupsCount: info.count,
          }))
          .sort((a, b) => (b.sharedGroupsCount || 0) - (a.sharedGroupsCount || 0));

        setContactSuggestions(suggs);
        setIsLoadingSuggestions(false);
      }
    }
    return () => {
      isCurrent = false;
    };
  }, [isOpen, selectedGroupId, onGetContactSuggestions, groups, currentUser.id]);

  // Búsqueda predictiva con debounce de 250ms mientras el usuario escribe
  useEffect(() => {
    const clean = searchQuery.trim().replace(/^@/, '');
    if (!clean) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        if (onSearchUsers) {
          const results = await onSearchUsers(clean, selectedGroupId);
          setSearchResults(results);
        } else {
          const matches: PublicUser[] = allUsers
            .filter((u) => {
              if (u.id === currentUser.id) return false;
              const uName = (u.username || '').toLowerCase();
              return uName.includes(clean.toLowerCase());
            })
            .slice(0, 10)
            .map((u) => ({
              id: u.id,
              username: u.username || u.name.toLowerCase().replace(/\s+/g, '_'),
            }));
          setSearchResults(matches);
        }
      } catch (err) {
        console.warn('Predictive search error:', err);
      } finally {
        setIsSearching(false);
        setHasSearched(true);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedGroupId, onSearchUsers, allUsers, currentUser.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filtrar solicitudes recibidas por el usuario actual
  const receivedRequests = requests.filter(
    (r) =>
      r.recipientUserId === currentUser.id ||
      r.recipientEmail.toLowerCase() === currentUser.email.toLowerCase() ||
      (currentUser.username && r.recipientUsername?.toLowerCase().replace('@', '') === currentUser.username.toLowerCase().replace('@', ''))
  );

  // Filtrar solicitudes enviadas por el usuario actual
  const sentRequests = requests.filter((r) => r.senderId === currentUser.id);

  // Conteo de no leídas en recibidas para mostrar badge "Nueva"
  const unreadReceivedCount = receivedRequests.filter((r) => !r.isRead && r.status === 'PENDING').length;

  const renderGroupIcon = (category?: string, className = "w-4 h-4") => {
    const iconClass = `${className} stroke-[1.75px] text-slate-700 dark:text-slate-300`;
    switch (category) {
      case 'HOME': return <Home className={iconClass} aria-hidden="true" />;
      case 'TRIP': return <Plane className={iconClass} aria-hidden="true" />;
      case 'COUPLE': return <Heart className={iconClass} aria-hidden="true" />;
      case 'EVENT': return <PartyPopper className={iconClass} aria-hidden="true" />;
      default: return <Package className={iconClass} aria-hidden="true" />;
    }
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanQuery = sanitizeTextInput(searchQuery, 100).trim();
    if (!cleanQuery) {
      setFormError(t('requests.searchPlaceholder'));
      return;
    }

    if (!selectedGroupId) {
      setFormError(t('requests.selectGroup'));
      return;
    }

    const result = onSendRequest({
      groupId: selectedGroupId,
      recipientQuery: cleanQuery,
    });

    if (result.success) {
      setFormSuccess(t('requests.inviteSuccess'));
      setSearchQuery('');
      setTimeout(() => setFormSuccess(null), 3500);
    } else {
      setFormError(result.error || t('common.error'));
    }
  };

  const handleDirectInvite = (targetUsername: string) => {
    setFormError(null);
    setFormSuccess(null);

    if (!selectedGroupId) {
      setFormError(t('requests.selectGroup'));
      return;
    }

    const cleanUser = targetUsername.replace(/^@/, '').trim();
    const result = onSendRequest({
      groupId: selectedGroupId,
      recipientQuery: `@${cleanUser}`,
    });

    if (result.success) {
      setFormSuccess(`Invitación enviada a @${cleanUser}`);
      setTimeout(() => setFormSuccess(null), 3500);
    } else {
      setFormError(result.error || t('common.error'));
    }
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="requests-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="requests-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t('requests.title')}
                </h2>
                {unreadReceivedCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                    {t('requests.newBadge')} ({unreadReceivedCount})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('requests.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            <X className="w-5 h-5 stroke-[1.75px]" aria-hidden="true" />
          </button>
        </div>

        {/* Banner de Aviso de Regla */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500 stroke-[1.75px] shrink-0" aria-hidden="true" />
            <span>{t('requests.invitationRuleNote')}</span>
          </div>
          {unreadReceivedCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="min-h-[44px] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer shrink-0 inline-flex items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
            >
              {t('requests.markAllRead')}
            </button>
          )}
        </div>

        {/* Barra de Pestañas con Targets Táctiles >= 44x44px */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* Pestaña: Recibidas */}
            <button
              type="button"
              onClick={() => setActiveTab('RECEIVED')}
              className={`min-h-[44px] flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'RECEIVED'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{t('requests.tabReceived')}</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-sm font-mono ${activeTab === 'RECEIVED' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {receivedRequests.length}
              </span>
              {unreadReceivedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-medium bg-amber-500 text-white ml-0.5">
                  {t('requests.newBadge')}
                </span>
              )}
            </button>

            {/* Pestaña: Enviadas */}
            <button
              type="button"
              onClick={() => setActiveTab('SENT')}
              className={`min-h-[44px] flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
                activeTab === 'SENT'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{t('requests.tabSent')}</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-sm font-mono ${activeTab === 'SENT' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {sentRequests.length}
              </span>
            </button>
          </div>

          {/* Botón para desplegar formulario de invitación */}
          <button
            type="button"
            onClick={() => setShowInviteForm(!showInviteForm)}
            className={`min-h-[44px] flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 ${
              showInviteForm
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-xs'
            }`}
          >
            <UserPlus className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
            <span>{t('requests.inviteNew')}</span>
          </button>
        </div>

        {/* Panel Desplegable: Enviar Nueva Solicitud */}
        {showInviteForm && (
          <form 
            onSubmit={handleSendInvite} 
            className="p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-300 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-slate-900 dark:text-slate-100" aria-hidden="true" />
                <span>{t('requests.inviteNew')}</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Búsqueda por usuario o correo
              </span>
            </div>

            {formError && (
              <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Selección de Grupo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {t('requests.selectGroup')}
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="min-h-[44px] w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.members.length} miembros)
                    </option>
                  ))}
                </select>
              </div>

              {/* Búsqueda por Nombre de Usuario o Correo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {t('requests.searchPlaceholder')}
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ej: @usuario_1 o usuario@splitflow.app"
                    className="min-h-[44px] w-full pl-10 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                  />
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400 animate-spin" aria-hidden="true" />
                  ) : searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="min-h-[36px] min-w-[36px] absolute right-1 top-1 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Caso 1: Búsqueda Predictiva activa (cuando el usuario escribe letra a letra) */}
            {searchQuery.trim().length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resultados de búsqueda predictiva</span>
                  </p>
                  {isSearching && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                      Buscando...
                    </span>
                  )}
                </div>

                {isSearching ? (
                  <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-hidden="true" />
                    <span>Buscando usuarios por coincidencia...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
                    {searchResults.map((user) => {
                      const isAlreadyMember = selectedGroupMembers.has(user.id);
                      return (
                        <div
                          key={user.id}
                          className="min-h-[44px] flex items-center justify-between p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left transition"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white font-mono truncate">
                              @{user.username}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="truncate">ID: {user.id.slice(0, 8)}...</span>
                              {user.isPastContact && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                  <History className="w-2.5 h-2.5" aria-hidden="true" />
                                  Contacto previo
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAlreadyMember ? (
                              <span className="min-h-[36px] px-2.5 py-1 rounded text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                Miembro
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDirectInvite(user.username)}
                                className="min-h-[44px] px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                              >
                                <Send className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
                                Invitar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : hasSearched ? (
                  <div className="p-3 rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <p>No se encontraron coincidencias para &quot;{searchQuery.trim()}&quot;.</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Puedes pulsar en &quot;{t('requests.sendInviteBtn')}&quot; abajo para invitar directamente.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Caso 2: Sugerencias Rápidas automáticas por Historial de Contactos previos */
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <History className="w-4 h-4 text-slate-500 stroke-[1.75px]" aria-hidden="true" />
                    <span>Sugerencias rápidas (Contactos previos)</span>
                  </div>
                  {contactSuggestions.length > 0 && (
                    <span className="text-[11px] text-slate-500 font-mono font-medium">
                      {contactSuggestions.length} sugerencia{contactSuggestions.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Usuarios con los que compartes o has compartido grupos previamente en SplitFlow.
                </p>

                {isLoadingSuggestions ? (
                  <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-hidden="true" />
                    <span>Cargando contactos previos compartidos...</span>
                  </div>
                ) : contactSuggestions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
                    {contactSuggestions.map((user) => {
                      const isAlreadyMember = selectedGroupMembers.has(user.id);
                      return (
                        <div
                          key={user.id}
                          className="min-h-[44px] flex items-center justify-between p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left transition"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white font-mono truncate">
                              @{user.username}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="truncate">ID: {user.id.slice(0, 8)}...</span>
                              {user.sharedGroupsCount ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                  {user.sharedGroupsCount} grupo{user.sharedGroupsCount > 1 ? 's' : ''} en común
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAlreadyMember ? (
                              <span className="min-h-[36px] px-2.5 py-1 rounded text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                Miembro
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDirectInvite(user.username)}
                                className="min-h-[44px] px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                              >
                                <Send className="w-3 h-3 stroke-[2px]" aria-hidden="true" />
                                Invitar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500 dark:text-slate-400">
                    No tienes contactos previos en otros grupos. Escribe un @nombre_de_usuario en el campo superior para buscarlo.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="min-h-[44px] px-4 py-2 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <Send className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                <span>{t('requests.sendInviteBtn')}</span>
              </button>
            </div>
          </form>
        )}

        {/* Contenido Principal de las Pestañas */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {activeTab === 'RECEIVED' ? (
            /* ================================================================ */
            /* PESTAÑA: SOLICITUDES RECIBIDAS                                   */
            /* ================================================================ */
            receivedRequests.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 stroke-[1.75px]" aria-hidden="true" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('requests.emptyReceived')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {t('requests.invitationRuleNote')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {receivedRequests.map((req) => {
                  const isUnread = !req.isRead && req.status === 'PENDING';

                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-lg border transition ${
                        isUnread
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Info del Remitente y Grupo */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                            {req.senderName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {req.senderName}
                              </p>
                              {req.senderUsername && (
                                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-semibold">
                                  @{req.senderUsername}
                                </span>
                              )}
                              {isUnread && (
                                <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-amber-800 text-white dark:bg-amber-700">
                                  {t('requests.newBadge')}
                                </span>
                              )}
                            </div>
                            
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>Te ha invitado a:</span>
                              <span className="font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                                {renderGroupIcon(req.groupCategory, 'w-4 h-4')}
                                {req.groupName}
                              </span>
                            </p>

                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                              <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                              <span>·</span>
                              <span>{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                          </div>
                        </div>

                        {/* Botones de Acción con Targets Táctiles >= 44x44px */}
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0 w-full sm:w-auto">
                          {req.status === 'PENDING' ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => onRejectRequest(req)}
                                className="min-h-[44px] flex-1 sm:flex-initial px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-700"
                              >
                                <Ban className="w-4 h-4 text-rose-700 dark:text-rose-400 stroke-[1.75px]" aria-hidden="true" />
                                <span>{t('requests.reject')}</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => onAcceptRequest(req)}
                                className="min-h-[44px] flex-1 sm:flex-initial px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
                              >
                                <Check className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                                <span>{t('requests.accept')}</span>
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-sm text-xs font-semibold font-mono ${
                                req.status === 'ACCEPTED'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {req.status === 'ACCEPTED' ? t('requests.statusAccepted') : t('requests.statusRejected')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ================================================================ */
            /* PESTAÑA: SOLICITUDES ENVIADAS                                    */
            /* ================================================================ */
            sentRequests.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                  <Send className="w-6 h-6 stroke-[1.75px]" aria-hidden="true" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('requests.emptySent')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {t('requests.invitationRuleNote')}
                </p>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(true)}
                  className="min-h-[44px] px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer inline-flex items-center gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                >
                  <UserPlus className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                  <span>{t('requests.inviteNew')}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                          {renderGroupIcon(req.groupCategory, 'w-5 h-5')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            Invitación para: {req.recipientUsername ? `@${req.recipientUsername}` : req.recipientEmail}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            Grupo: <span className="font-semibold text-slate-900 dark:text-white">{req.groupName}</span>
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                            <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                            <span>·</span>
                            <span>{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-sm text-xs font-semibold font-mono ${
                            req.status === 'PENDING'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : req.status === 'ACCEPTED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {req.status === 'PENDING' && t('requests.statusPending')}
                          {req.status === 'ACCEPTED' && t('requests.statusAccepted')}
                          {req.status === 'REJECTED' && t('requests.statusRejected')}
                        </span>

                        {req.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => onCancelRequest(req.id)}
                            className="min-h-[44px] px-3 py-1.5 rounded-md text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-700"
                          >
                            {t('requests.cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Pie del modal con Target Táctil >= 44x44px */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            SplitFlow · Solicitudes verificadas
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
