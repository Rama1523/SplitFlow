/**
 * SplitFlow — Multilingual Translations Dictionary
 * Soporte internacional completo y nativo para los 30 idiomas disponibles:
 * 
 * 1. Principales Globales: Español (es), English (en), Français (fr), Deutsch (de), Italiano (it), Português (pt).
 * 2. Regionales de España: Català (ca), Galego (gl), Euskara (eu).
 * 3. Europa Nórdica y Central: Nederlands (nl), Svenska (sv), Norsk (no), Dansk (da), Suomi (fi).
 * 4. Europa Oriental y Balcanes: Polski (pl), Čeština (cs), Magyar (hu), Română (ro), Ελληνικά (el), Українська (uk), Русский (ru), Türkçe (tr).
 * 5. Asia, Pacífico y Oriente Medio: 日本語 (ja), 简体中文 (zh), 한국어 (ko), हिन्दी (hi), Bahasa Indonesia (id), Tiếng Việt (vi), ไทย (th), العربية (ar).
 */

import { Language } from './types';
import { CORE_LANGUAGES } from './locales/coreLanguages';
import { SPANISH_REGIONAL } from './locales/spanishRegional';
import { NORDIC_DUTCH } from './locales/nordicDutch';
import { EASTERN_EUROPE } from './locales/easternEurope';
import { ASIA_GLOBAL } from './locales/asiaGlobal';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  ...CORE_LANGUAGES,
  ...SPANISH_REGIONAL,
  ...NORDIC_DUTCH,
  ...EASTERN_EUROPE,
  ...ASIA_GLOBAL,
} as Record<Language, Record<string, string>>;
