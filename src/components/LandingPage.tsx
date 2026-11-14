/**
 * SplitFlow — LandingPage Component (Stripe / Linear Aesthetic)
 * Portada corporativa sobria, nítida y accesible con alto contraste (WCAG AAA).
 * Sin datos ficticios, sin modo demo ni adornos neo-futuristas.
 */

import { 
  ArrowRight, 
  ShieldCheck, 
  Sliders, 
  Globe2, 
  Smartphone,
  Info,
  Sun,
  Moon,
  Database
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSelector } from './LanguageSelector';

interface LandingPageProps {
  onEnterApp?: () => void;
  onOpenAuth?: () => void;
  onOpenRegister?: () => void;
  onOpenLogin?: () => void;
  onOpenDownloadApk?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  confirmationMessage?: string | null;
}

export function LandingPage({ 
  onEnterApp, 
  onOpenAuth,
  onOpenRegister,
  onOpenLogin,
  onOpenDownloadApk,
  theme = 'dark',
  onToggleTheme,
  confirmationMessage,
}: LandingPageProps) {
  const { t } = useI18n();

  const handleRegister = onOpenRegister || onEnterApp || (() => {});
  const handleLogin = onOpenLogin || onOpenAuth || (() => {});

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      
      {/* Banner de confirmacion global */}
      {confirmationMessage && (
        <div className="bg-emerald-600 text-white text-xs font-semibold py-2.5 px-4 text-center sticky top-0 z-40 flex items-center justify-center gap-2 animate-in fade-in">
          <span>{confirmationMessage}</span>
        </div>
      )}

      {/* 1. NAVBAR SUPERIOR ESTILO LINEAR */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Brand */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="h-8 w-8 rounded-md bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-xs shrink-0 overflow-hidden">
              <img 
                src="/assets/aistudio/logoSplitflow_5c96e8d4.png" 
                alt="Logo SplitFlow" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight text-slate-950 dark:text-white">SplitFlow</span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                SaaS Edition
              </span>
            </div>
          </div>

          {/* Enlaces de Navegación */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
            <button 
              type="button"
              onClick={() => scrollToSection('features')}
              className="min-h-[44px] flex items-center hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
            >
              Funcionalidades
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('disclaimer')}
              className="min-h-[44px] flex items-center hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
            >
              Transparencia
            </button>
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <LanguageSelector variant="compact" />

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Cambiar tema"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500 stroke-[1.75px]" aria-hidden="true" /> : <Moon className="w-4 h-4 text-slate-700 stroke-[1.75px]" aria-hidden="true" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleLogin}
              className="min-h-[40px] px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {t('auth.loginTab')}
            </button>

            <button
              type="button"
              onClick={handleRegister}
              className="min-h-[40px] px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>{t('landing.ctaStart')}</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2px]" aria-hidden="true" />
            </button>
          </div>

        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="pt-16 pb-16 md:pt-24 md:pb-24 px-4 sm:px-8 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          
          {/* Titular Principal */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 dark:text-white leading-[1.12]">
            Gestión inteligente de gastos compartidos y presupuesto del hogar
          </h1>

          {/* Subtítulo */}
          <p className="max-w-2xl mx-auto text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            Elimina el caos de las transferencias cruzadas. SplitFlow calcula el menor número posible de pagos directos entre personas, administra presupuestos y garantiza cuentas claras en tiempo real.
          </p>

          {/* Botones de Acción */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRegister}
              className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <span>Comenzar ahora</span>
              <ArrowRight className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleLogin}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Iniciar sesión
            </button>
            {onOpenDownloadApk && (
              <button
                type="button"
                onClick={onOpenDownloadApk}
                className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 stroke-[1.75px]" aria-hidden="true" />
                <span>Descargar APK Android</span>
              </button>
            )}
          </div>
        </div>
      </section>


      {/* 4. CARACTERÍSTICAS TÉCNICAS (ESTILO STRIPE / LINEAR) */}
      <section id="features" className="py-16 px-4 sm:px-8 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Diseñado para precisión contable y simplicidad
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Capacidades avanzadas sin complicaciones visuales ni interfaces saturadas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-100">
                <ShieldCheck className="w-4 h-4 stroke-[1.75px]" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Minimización de Deudas (Debt Settlement)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Algoritmo codicioso sobre grafos de flujo neto que simplifica las deudas de 10 participantes a un puñado de transferencias directas.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-100">
                <Sliders className="w-4 h-4 stroke-[1.75px]" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Presupuestos por Bloques Modulares</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Activa y desactiva módulos de gasto por grupo (Alquiler, Comida, Transporte, etc.) y calcula el presupuesto total automáticamente.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-100">
                <Database className="w-4 h-4 stroke-[1.75px]" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Base de Datos PostgreSQL (Supabase)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Persistencia real de grupos, gastos y liquidaciones conectada al backend de Supabase con autenticación por token seguro.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-100">
                <Globe2 className="w-4 h-4 stroke-[1.75px]" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Soporte Multidivisa y 5 Idiomas</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Compatibilidad total con Euros, Pesos, Libras y Dólares, junto a localización completa en español, inglés, francés, alemán e italiano.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. LLAMADA A LA ACCIÓN FINAL */}
      <section className="py-14 px-4 sm:px-8 bg-slate-900 text-white dark:bg-slate-900 border-b border-slate-800 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Comienza a gestionar tus gastos compartidos hoy
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto">
            Crea tu cuenta gratis en pocos segundos con tu correo y nombre de usuario, o inicia sesión si ya tienes una cuenta registrada.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRegister}
              className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-md bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <span>Comenzar ahora</span>
              <ArrowRight className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleLogin}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </section>

      {/* 6. AVISO DE TRANSPARENCIA */}
      <section id="disclaimer" className="py-12 px-4 sm:px-8 bg-slate-100/50 dark:bg-slate-950">
        <div className="max-w-4xl mx-auto p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Transparencia y Privacidad Financiera
            </p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              SplitFlow no realiza transacciones bancarias directas ni almacena números de tarjeta. Los saldos y liquidaciones calculados son herramientas de registro orientativo para que los usuarios liquiden entre sí mediante Bizum, transferencia SEPA o efectivo.
            </p>
          </div>
        </div>
      </section>

      {/* 6. PIE DE PÁGINA */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center p-0.5 shadow-2xs shrink-0 overflow-hidden">
              <img 
                src="/assets/aistudio/logoSplitflow_5c96e8d4.png" 
                alt="Logo SplitFlow" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">SplitFlow</span>
            <span>·</span>
            <span>Gestor Inteligente de Gastos</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 text-[11px]">
            <span>Supabase PostgreSQL Edition</span>
            <span>·</span>
            <span>© 2026 SplitFlow</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
