/**
 * SplitFlow — Supabase Client & Backend Data Layer
 * Inicialización segura de cliente Supabase con detección automática de variables de entorno,
 * soporte para Supabase Auth y modo Fallback/Demo continuo sin caídas de entorno.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// URL oficial y clave pública anon JWT del proyecto Supabase SplitFlow: fyhvotkgeopjwqxcbiry
const DEFAULT_SUPABASE_URL = 'https://fyhvotkgeopjwqxcbiry.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aHZvdGtnZW9wandxeGNiaXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzOTUwNjMsImV4cCI6MjEwNzk3MTA2M30.uAfebpOsFLPFo-vFMjylT490v6BOzOIAmetsPAoTua8';

// Leer variables de entorno compatibles tanto con Vite (VITE_) como con Next.js (NEXT_PUBLIC_)
const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  DEFAULT_SUPABASE_ANON_KEY;

/**
 * Comprueba si las credenciales de Supabase están correctamente configuradas y no son placeholders
 */
export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

/**
 * Instancia del cliente de Supabase (o cliente mock para evitar excepciones en modo demo)
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Estado y metadatos de la conexión backend
 */
export const backendStatus = {
  isLive: isSupabaseConfigured,
  provider: isSupabaseConfigured ? ('Supabase (PostgreSQL)' as const) : ('Modo Demo / LocalStore' as const),
  url: isSupabaseConfigured ? supabaseUrl : 'Memoria Local (Simulado)',
};
