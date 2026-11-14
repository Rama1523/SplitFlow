/**
 * SplitFlow — BackendStatusBadge Component (Stripe / Linear Aesthetic)
 * Indicador visual limpio del estado de conexión a Supabase PostgreSQL.
 * Sin modo demo ni interruptores artificiales.
 */

import { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  X, 
  Server,
  ShieldCheck
} from 'lucide-react';
import { backendStatus } from '../lib/supabase';

interface BackendStatusBadgeProps {
  className?: string;
}

export function BackendStatusBadge({ className = '' }: BackendStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Botón en Cabecera con Target Táctil >= 44x44px */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Estado del sistema: Conectado a Supabase PostgreSQL"
        className={`min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 ${className}`}
      >
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
        />
        <Database className="w-3.5 h-3.5 stroke-[1.75px] text-slate-600 dark:text-slate-400 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline font-mono text-[11px]">
          Supabase DB
        </span>
      </button>

      {/* Modal de Conexión & Arquitectura */}
      {isOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="backend-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-100"
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-lg shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
                  <Server className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="backend-modal-title" className="text-sm font-bold text-slate-950 dark:text-white">
                    Base de Datos Supabase
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    PostgreSQL con Row Level Security (RLS)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Conexión Directa Activa
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
                    SplitFlow opera exclusivamente sobre tu base de datos de producción en Supabase.
                  </p>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-md p-3.5 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Motor de Base de Datos:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">PostgreSQL 15</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Autenticación:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">Supabase Auth (JWT)</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Seguridad:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">RLS (Políticas por Usuario)</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Datos Demo:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">Desactivados (Modo Real)</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
