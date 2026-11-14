/**
 * SplitFlow — Internationalization (i18n) Types
 * Soporte internacional extendido con 30 idiomas globales y regionales.
 */

export type Language =
  | 'es' | 'en' | 'fr' | 'de' | 'it' | 'pt'
  | 'ca' | 'gl' | 'eu' | 'nl' | 'pl' | 'sv'
  | 'no' | 'da' | 'fi' | 'el' | 'cs' | 'ro'
  | 'hu' | 'ru' | 'uk' | 'tr' | 'ja' | 'zh'
  | 'ko' | 'hi' | 'id' | 'vi' | 'th' | 'ar';

export type LanguageRegion = 'ALL' | 'EUROPE' | 'AMERICAS' | 'ASIA_GLOBAL';

export interface LanguageMeta {
  code: Language;
  label: string;
  nativeName: string;
  englishName: string;
  locale: string;
  region: 'EUROPE' | 'AMERICAS' | 'ASIA_GLOBAL';
}

export const AVAILABLE_LANGUAGES: LanguageMeta[] = [
  // --- Idiomas Principales / Oficiales ---
  { code: 'es', label: 'ES', nativeName: 'Español', englishName: 'Spanish', locale: 'es-ES', region: 'EUROPE' },
  { code: 'en', label: 'EN', nativeName: 'English', englishName: 'English', locale: 'en-US', region: 'AMERICAS' },
  { code: 'fr', label: 'FR', nativeName: 'Français', englishName: 'French', locale: 'fr-FR', region: 'EUROPE' },
  { code: 'de', label: 'DE', nativeName: 'Deutsch', englishName: 'German', locale: 'de-DE', region: 'EUROPE' },
  { code: 'it', label: 'IT', nativeName: 'Italiano', englishName: 'Italian', locale: 'it-IT', region: 'EUROPE' },
  { code: 'pt', label: 'PT', nativeName: 'Português', englishName: 'Portuguese', locale: 'pt-BR', region: 'AMERICAS' },

  // --- Lenguas Cooficiales y Regionales de España ---
  { code: 'ca', label: 'CA', nativeName: 'Català', englishName: 'Catalan', locale: 'ca-ES', region: 'EUROPE' },
  { code: 'gl', label: 'GL', nativeName: 'Galego', englishName: 'Galician', locale: 'gl-ES', region: 'EUROPE' },
  { code: 'eu', label: 'EU', nativeName: 'Euskara', englishName: 'Basque', locale: 'eu-ES', region: 'EUROPE' },

  // --- Europa Occidental, Nórdica y Central ---
  { code: 'nl', label: 'NL', nativeName: 'Nederlands', englishName: 'Dutch', locale: 'nl-NL', region: 'EUROPE' },
  { code: 'sv', label: 'SV', nativeName: 'Svenska', englishName: 'Swedish', locale: 'sv-SE', region: 'EUROPE' },
  { code: 'no', label: 'NO', nativeName: 'Norsk', englishName: 'Norwegian', locale: 'no-NO', region: 'EUROPE' },
  { code: 'da', label: 'DA', nativeName: 'Dansk', englishName: 'Danish', locale: 'da-DK', region: 'EUROPE' },
  { code: 'fi', label: 'FI', nativeName: 'Suomi', englishName: 'Finnish', locale: 'fi-FI', region: 'EUROPE' },

  // --- Europa Oriental y Balcanes ---
  { code: 'pl', label: 'PL', nativeName: 'Polski', englishName: 'Polish', locale: 'pl-PL', region: 'EUROPE' },
  { code: 'cs', label: 'CS', nativeName: 'Čeština', englishName: 'Czech', locale: 'cs-CZ', region: 'EUROPE' },
  { code: 'hu', label: 'HU', nativeName: 'Magyar', englishName: 'Hungarian', locale: 'hu-HU', region: 'EUROPE' },
  { code: 'ro', label: 'RO', nativeName: 'Română', englishName: 'Romanian', locale: 'ro-RO', region: 'EUROPE' },
  { code: 'el', label: 'EL', nativeName: 'Ελληνικά', englishName: 'Greek', locale: 'el-GR', region: 'EUROPE' },
  { code: 'uk', label: 'UK', nativeName: 'Українська', englishName: 'Ukrainian', locale: 'uk-UA', region: 'EUROPE' },
  { code: 'ru', label: 'RU', nativeName: 'Русский', englishName: 'Russian', locale: 'ru-RU', region: 'EUROPE' },
  { code: 'tr', label: 'TR', nativeName: 'Türkçe', englishName: 'Turkish', locale: 'tr-TR', region: 'EUROPE' },

  // --- Asia, Pacífico y Oriente Medio ---
  { code: 'ja', label: 'JA', nativeName: '日本語', englishName: 'Japanese', locale: 'ja-JP', region: 'ASIA_GLOBAL' },
  { code: 'zh', label: 'ZH', nativeName: '简体中文', englishName: 'Chinese (Simplified)', locale: 'zh-CN', region: 'ASIA_GLOBAL' },
  { code: 'ko', label: 'KO', nativeName: '한국어', englishName: 'Korean', locale: 'ko-KR', region: 'ASIA_GLOBAL' },
  { code: 'hi', label: 'HI', nativeName: 'हिन्दी', englishName: 'Hindi', locale: 'hi-IN', region: 'ASIA_GLOBAL' },
  { code: 'id', label: 'ID', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', locale: 'id-ID', region: 'ASIA_GLOBAL' },
  { code: 'vi', label: 'VI', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', locale: 'vi-VN', region: 'ASIA_GLOBAL' },
  { code: 'th', label: 'TH', nativeName: 'ไทย', englishName: 'Thai', locale: 'th-TH', region: 'ASIA_GLOBAL' },
  { code: 'ar', label: 'AR', nativeName: 'العربية', englishName: 'Arabic', locale: 'ar-SA', region: 'ASIA_GLOBAL' },
];
