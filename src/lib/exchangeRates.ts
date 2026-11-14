/**
 * SplitFlow — Real-Time Daily Currency Conversion Engine & Cache Service
 * 
 * 1. Caché y Periodicidad Diaria:
 *    - Solo 1 llamada a la API externa cada 24 horas (o 1 vez al día).
 *    - Persistencia en localStorage con clave versionada y validación de expiración de 24h.
 *    - Resiliencia determinista con tasas de referencia (benchmark) para modo sin conexión o fallos de red.
 * 
 * 2. Aplicación en Cálculos:
 *    - Recalcula de forma transparente los gastos, saldos y conversiones en la divisa personal del miembro.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getCurrencyInfo } from './currencies';

// Tasas de cambio de referencia consolidadas (Base: 1 EUR = X divisa)
export const BENCHMARK_RATES_TO_EUR: Record<string, number> = {
  EUR: 1.0,
  USD: 1.085,
  GBP: 0.855,
  ARS: 1115.0,
  CLP: 1025.0,
  COP: 4320.0,
  CUP: 26.0,
  DOP: 64.5,
  MXN: 21.6,
  PHP: 62.4,
  UYU: 45.2,
  CAD: 1.49,
  AUD: 1.66,
  NZD: 1.82,
  SGD: 1.46,
  HKD: 8.48,
  GIP: 0.855,
  FKP: 0.855,
  SHP: 0.855,
  JPY: 162.5,
  CHF: 0.95,
  BRL: 5.95,
  PEN: 4.05,
  INR: 91.2,
  CNY: 7.82,
  KRW: 1495.0,
  SEK: 11.45,
  NOK: 11.75,
  DKK: 7.46,
  PLN: 4.32,
  TRY: 37.1,
  ZAR: 19.8,
};

export const CACHE_KEY = 'splitflow_daily_exchange_rates_v2';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Exactamente 24 horas (1 llamada diaria)
export const RATES_UPDATED_EVENT = 'splitflow:exchange-rates-updated';

export interface DailyRatesPayload {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
  dateKey: string;   // YYYY-MM-DD
  expiresAt: number; // timestamp + 24h
  source: 'api' | 'cache' | 'benchmark';
}

export interface DailyRatesMetadata {
  lastUpdated: Date;
  nextUpdateDue: Date;
  formattedLastUpdated: string;
  isCacheValid: boolean;
  source: 'api' | 'cache' | 'benchmark';
  ratesCount: number;
}

// Memoria compartida en runtime
let activeRates: Record<string, number> = { ...BENCHMARK_RATES_TO_EUR };
let lastFetchedTime: number = Date.now();
let activeSource: 'api' | 'cache' | 'benchmark' = 'benchmark';
let fetchPromise: Promise<DailyRatesPayload> | null = null;

function getTodayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Lee la caché persistente en localStorage y valida si tiene menos de 24 horas
 */
function readLocalCache(): DailyRatesPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: DailyRatesPayload = JSON.parse(raw);
    
    // Comprobar estructura y vigencia de 24 horas
    if (
      parsed &&
      typeof parsed.timestamp === 'number' &&
      parsed.rates &&
      typeof parsed.rates === 'object'
    ) {
      const age = Date.now() - parsed.timestamp;
      if (age >= 0 && age < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[SplitFlow Currency] Error al leer caché diaria de divisas:', err);
  }
  return null;
}

/**
 * Guarda el payload diario en localStorage
 */
function writeLocalCache(payload: DailyRatesPayload): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[SplitFlow Currency] Error al guardar caché diaria de divisas:', err);
  }
}

/**
 * Emite un evento en el DOM para sincronizar hooks reactivos
 */
function notifyRatesUpdated(payload: DailyRatesPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RATES_UPDATED_EVENT, { detail: payload }));
  }
}

/**
 * Obtiene las tasas de conversión garantizando una sola llamada diaria.
 * Si la caché local tiene menos de 24 horas, la reutiliza sin acceder a la red.
 */
export async function initializeExchangeRates(force = false): Promise<DailyRatesPayload> {
  // 1. Si no es forzado, verificar si ya tenemos caché válida de las últimas 24 horas
  if (!force) {
    const cached = readLocalCache();
    if (cached) {
      activeRates = { ...BENCHMARK_RATES_TO_EUR, ...cached.rates };
      lastFetchedTime = cached.timestamp;
      activeSource = 'cache';
      return {
        ...cached,
        source: 'cache',
      };
    }
  }

  // 2. Si ya hay una solicitud en curso, compartir la misma promesa para evitar duplicados simultáneos
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async (): Promise<DailyRatesPayload> => {
    const now = Date.now();
    const dateKey = getTodayDateKey();
    const defaultPayload: DailyRatesPayload = {
      base: 'EUR',
      rates: { ...BENCHMARK_RATES_TO_EUR },
      timestamp: now,
      dateKey,
      expiresAt: now + CACHE_TTL_MS,
      source: 'benchmark',
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && typeof data.rates === 'object') {
          const mergedRates = { ...BENCHMARK_RATES_TO_EUR, ...data.rates };
          activeRates = mergedRates;
          lastFetchedTime = now;
          activeSource = 'api';

          const payload: DailyRatesPayload = {
            base: 'EUR',
            rates: mergedRates,
            timestamp: now,
            dateKey,
            expiresAt: now + CACHE_TTL_MS,
            source: 'api',
          };

          writeLocalCache(payload);
          notifyRatesUpdated(payload);
          return payload;
        }
      }
    } catch {
      // Fallback resiliente: si hay una caché previa (incluso superior a 24h), usarla antes que benchmark
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const fallback: DailyRatesPayload = JSON.parse(raw);
            if (fallback && fallback.rates) {
              activeRates = { ...BENCHMARK_RATES_TO_EUR, ...fallback.rates };
              lastFetchedTime = fallback.timestamp;
              activeSource = 'cache';
              return fallback;
            }
          }
        } catch {}
      }
    } finally {
      fetchPromise = null;
    }

    // Si todo falla o está offline sin caché previa
    activeRates = { ...BENCHMARK_RATES_TO_EUR };
    lastFetchedTime = now;
    activeSource = 'benchmark';
    return defaultPayload;
  })();

  return fetchPromise;
}

// Cargar caché inmediatamente al montar en cliente
if (typeof window !== 'undefined') {
  const existing = readLocalCache();
  if (existing) {
    activeRates = { ...BENCHMARK_RATES_TO_EUR, ...existing.rates };
    lastFetchedTime = existing.timestamp;
    activeSource = 'cache';
  } else {
    initializeExchangeRates();
  }
}

/**
 * Devuelve la metadata y el estado de la caché diaria actual
 */
export function getDailyRatesMetadata(): DailyRatesMetadata {
  const lastUpdated = new Date(lastFetchedTime);
  const nextUpdateDue = new Date(lastFetchedTime + CACHE_TTL_MS);
  const isCacheValid = Date.now() - lastFetchedTime < CACHE_TTL_MS;

  return {
    lastUpdated,
    nextUpdateDue,
    formattedLastUpdated: lastUpdated.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    isCacheValid,
    source: activeSource,
    ratesCount: Object.keys(activeRates).length,
  };
}

/**
 * Obtiene la tasa de conversión directa diaria entre dos divisas
 */
export function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  const from = (fromCurrency || 'EUR').toUpperCase();
  const to = (toCurrency || 'EUR').toUpperCase();

  if (from === to) return 1.0;

  const fromRateToEur = activeRates[from] ?? BENCHMARK_RATES_TO_EUR[from] ?? 1.0;
  const toRateToEur = activeRates[to] ?? BENCHMARK_RATES_TO_EUR[to] ?? 1.0;

  if (fromRateToEur <= 0) return 1.0;

  // Fórmula cruzada exacta: (EUR / fromRate) * toRate = tasa directa from -> to
  return toRateToEur / fromRateToEur;
}

/**
 * Convierte un monto de una divisa a otra utilizando la tasa diaria
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (!amount || fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return amount;
  }
  const rate = getExchangeRate(fromCurrency, toCurrency);
  return amount * rate;
}

/**
 * Formatea un monto convertido a la divisa de destino con el símbolo y decimales exactos
 */
export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  locale = 'es-ES'
): string {
  const info = getCurrencyInfo(currencyCode);
  const decimals = info.decimals;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: info.code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Retorna la cadena de equivalencia "≈ 120,50 USD" si las divisas difieren, o null si son iguales
 */
export function formatConvertedEquivalent(
  amount: number,
  fromCurrency: string,
  toCurrency?: string,
  locale = 'es-ES'
): string | null {
  if (!toCurrency || fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return null;
  }
  const converted = convertAmount(amount, fromCurrency, toCurrency);
  return `≈ ${formatCurrencyAmount(converted, toCurrency, locale)}`;
}

/**
 * Hook reactivo para conversión automática y cálculo diario de divisas
 */
export function useCurrencyConversion(groupCurrency: string, userCurrency?: string) {
  const [lastUpdated, setLastUpdated] = useState<number>(lastFetchedTime);
  const [metadata, setMetadata] = useState<DailyRatesMetadata>(getDailyRatesMetadata);

  useEffect(() => {
    // Sincronizar al montar
    initializeExchangeRates().then((payload) => {
      setLastUpdated(payload.timestamp);
      setMetadata(getDailyRatesMetadata());
    });

    // Escuchar actualizaciones del servicio de divisas
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<DailyRatesPayload>;
      if (customEvent.detail) {
        setLastUpdated(customEvent.detail.timestamp);
        setMetadata(getDailyRatesMetadata());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(RATES_UPDATED_EVENT, handleUpdate);
      return () => window.removeEventListener(RATES_UPDATED_EVENT, handleUpdate);
    }
  }, []);

  const isDifferent = useMemo(() => {
    if (!userCurrency) return false;
    return userCurrency.toUpperCase() !== groupCurrency.toUpperCase();
  }, [groupCurrency, userCurrency]);

  const exchangeRate = useMemo(() => {
    if (!userCurrency || !isDifferent) return 1.0;
    return getExchangeRate(groupCurrency, userCurrency);
  }, [groupCurrency, userCurrency, isDifferent, lastUpdated]);

  const convert = useCallback(
    (amount: number): number => {
      if (!userCurrency || !isDifferent) return amount;
      return convertAmount(amount, groupCurrency, userCurrency);
    },
    [groupCurrency, userCurrency, isDifferent, exchangeRate]
  );

  const formatConverted = useCallback(
    (amount: number): string | null => {
      if (!userCurrency || !isDifferent) return null;
      return formatConvertedEquivalent(amount, groupCurrency, userCurrency);
    },
    [groupCurrency, userCurrency, isDifferent, exchangeRate]
  );

  const refreshRates = useCallback(async () => {
    const payload = await initializeExchangeRates(true);
    setLastUpdated(payload.timestamp);
    setMetadata(getDailyRatesMetadata());
  }, []);

  return {
    isDifferentCurrency: isDifferent,
    userCurrency: userCurrency || groupCurrency,
    groupCurrency,
    exchangeRate,
    convert,
    formatConverted,
    dailyRatesInfo: metadata,
    refreshRates,
    lastUpdated,
  };
}
