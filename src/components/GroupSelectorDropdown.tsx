/**
 * SplitFlow — GroupSelectorDropdown Component
 * Selector accesible (WCAG AAA) para cambiar de grupo activo y crear nuevos grupos.
 * Targets táctiles >= 44x44px, navegación por teclado, soporte de pantalla táctil y contraste óptimo.
 */

import { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Check, 
  Plus, 
  Users, 
  Layers,
  Home,
  Plane,
  Heart,
  PartyPopper,
  Package,
  LogOut,
  Trash2,
  KeyRound
} from 'lucide-react';
import { Group } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface GroupSelectorDropdownProps {
  groups: Group[];
  activeGroup?: Group;
  onSelectGroup: (group: Group) => void;
  onOpenCreateModal: () => void;
  onOpenJoinModal?: () => void;
  onOpenLeaveModal?: () => void;
  onOpenDeleteModal?: () => void;
}

export function GroupSelectorDropdown({
  groups,
  activeGroup,
  onSelectGroup,
  onOpenCreateModal,
  onOpenJoinModal,
  onOpenLeaveModal,
  onOpenDeleteModal,
}: GroupSelectorDropdownProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const renderGroupIcon = (category?: string, className = "w-4 h-4") => {
    switch (category) {
      case 'HOME': return <Home className={`${className} stroke-[1.75px] text-slate-700 dark:text-slate-300`} aria-hidden="true" />;
      case 'TRIP': return <Plane className={`${className} stroke-[1.75px] text-slate-700 dark:text-slate-300`} aria-hidden="true" />;
      case 'COUPLE': return <Heart className={`${className} stroke-[1.75px] text-slate-700 dark:text-slate-300`} aria-hidden="true" />;
      case 'EVENT': return <PartyPopper className={`${className} stroke-[1.75px] text-slate-700 dark:text-slate-300`} aria-hidden="true" />;
      default: return <Package className={`${className} stroke-[1.75px] text-slate-700 dark:text-slate-300`} aria-hidden="true" />;
    }
  };

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

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const current = activeGroup || groups[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Disparador con Target Táctil >= 44x44px */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Grupo activo: ${current?.name || t('nav.groups')}. Cambiar grupo.`}
        className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
      >
        <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
          {renderGroupIcon(current?.category)}
        </div>
        <div className="min-w-0 max-w-[130px] sm:max-w-[200px]">
          <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 leading-tight hidden sm:block">
            {t('nav.switchGroup')}
          </p>
          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
            {current?.name || t('nav.groups')}
          </p>
        </div>
        <ChevronDown 
          aria-hidden="true"
          className={`w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Menú Desplegable con z-40, max-h-[calc(100vh-5rem)] y scroll interno */}
      {isOpen && (
        <div 
          role="listbox"
          aria-label={t('nav.groups')}
          className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden z-40 max-h-[calc(100vh-5rem)] flex flex-col animate-in fade-in duration-100"
        >
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 shrink-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-800 dark:text-slate-200 stroke-[1.75px]" aria-hidden="true" />
              <span>{t('nav.groups')}</span>
            </p>
          </div>

          <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-14rem)] sm:max-h-72 pb-2">
            {groups.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                {t('dashboard.noExpenses')}
              </div>
            ) : (
              groups.map((group) => {
                const isActive = group.id === current?.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onSelectGroup(group);
                      setIsOpen(false);
                    }}
                    className={`min-h-[44px] w-full flex items-center justify-between p-2.5 rounded-md text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-950 dark:text-white font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                        {renderGroupIcon(group.category)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{group.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 stroke-[1.75px]" aria-hidden="true" />
                            <span>{group.members.length}</span>
                          </span>
                          <span>·</span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{group.currency}</span>
                        </p>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-slate-900 dark:text-slate-100 stroke-[1.75px] shrink-0 ml-2" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Acciones de Grupo: Crear, Unirse y Abandonar / Eliminar */}
          <div className="p-2.5 pb-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 shrink-0 space-y-2">
            <div className={`grid ${onOpenJoinModal ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal();
                }}
                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2px]" aria-hidden="true" />
                <span className="truncate">{t('nav.createGroup')}</span>
              </button>

              {onOpenJoinModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenJoinModal();
                  }}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900"
                >
                  <KeyRound className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                  <span className="truncate">Unirse con código</span>
                </button>
              )}
            </div>

            {/* Si solo queda 1 persona en el grupo -> Eliminar grupo en rojo/danger */}
            {activeGroup && activeGroup.members.length <= 1 && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenDeleteModal) {
                    onOpenDeleteModal();
                  } else if (onOpenLeaveModal) {
                    onOpenLeaveModal();
                  }
                }}
                className="min-h-[40px] w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2px]" aria-hidden="true" />
                <span>Eliminar grupo</span>
              </button>
            )}

            {/* Si el grupo tiene 2 o más miembros -> Salir del grupo */}
            {activeGroup && activeGroup.members.length >= 2 && onOpenLeaveModal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenLeaveModal();
                }}
                className="min-h-[40px] w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[1.75px]" aria-hidden="true" />
                <span>Salir del grupo</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
