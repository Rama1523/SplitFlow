/**
 * SplitFlow — Currency System
 * Definición completa y tipada de divisas: Euros, Pesos, Libras, Dólares y Divisas Globales,
 * con símbolos, metadatos y función de formateo internacional.
 */

export type CurrencyCategory = 'EUR' | 'PESO' | 'POUND' | 'DOLLAR' | 'GLOBAL';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: {
    es: string;
    en: string;
    fr: string;
    de: string;
    it: string;
    pt: string;
    [key: string]: string;
  };
  category: CurrencyCategory;
  country: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  // --- EUROS ---
  {
    code: 'EUR',
    symbol: '€',
    name: {
      es: 'Euro (Zona Euro)',
      en: 'Euro (Eurozone)',
      fr: 'Euro (Zone euro)',
      de: 'Euro (Eurozone)',
      it: 'Euro (Zona euro)',
      pt: 'Euro (Zona Euro)',
    },
    category: 'EUR',
    country: 'EU',
    decimals: 2,
  },

  // --- PESOS ---
  {
    code: 'ARS',
    symbol: '$',
    name: {
      es: 'Peso Argentino',
      en: 'Argentine Peso',
      fr: 'Peso argentin',
      de: 'Argentinischer Peso',
      it: 'Peso argentino',
      pt: 'Peso Argentino',
    },
    category: 'PESO',
    country: 'Argentina',
    decimals: 2,
  },
  {
    code: 'CLP',
    symbol: '$',
    name: {
      es: 'Peso Chileno',
      en: 'Chilean Peso',
      fr: 'Peso chilien',
      de: 'Chilenischer Peso',
      it: 'Peso cileno',
      pt: 'Peso Chileno',
    },
    category: 'PESO',
    country: 'Chile',
    decimals: 0,
  },
  {
    code: 'COP',
    symbol: '$',
    name: {
      es: 'Peso Colombiano',
      en: 'Colombian Peso',
      fr: 'Peso colombien',
      de: 'Kolumbianischer Peso',
      it: 'Peso colombiano',
      pt: 'Peso Colombiano',
    },
    category: 'PESO',
    country: 'Colombia',
    decimals: 2,
  },
  {
    code: 'CUP',
    symbol: '$',
    name: {
      es: 'Peso Cubano',
      en: 'Cuban Peso',
      fr: 'Peso cubain',
      de: 'Kubanischer Peso',
      it: 'Peso cubano',
      pt: 'Peso Cubano',
    },
    category: 'PESO',
    country: 'Cuba',
    decimals: 2,
  },
  {
    code: 'DOP',
    symbol: 'RD$',
    name: {
      es: 'Peso Dominicano',
      en: 'Dominican Peso',
      fr: 'Peso dominicain',
      de: 'Dominikanischer Peso',
      it: 'Peso dominicano',
      pt: 'Peso Dominicano',
    },
    category: 'PESO',
    country: 'República Dominicana',
    decimals: 2,
  },
  {
    code: 'MXN',
    symbol: '$',
    name: {
      es: 'Peso Mexicano',
      en: 'Mexican Peso',
      fr: 'Peso mexicain',
      de: 'Mexikanischer Peso',
      it: 'Peso messicano',
      pt: 'Peso Mexicano',
    },
    category: 'PESO',
    country: 'México',
    decimals: 2,
  },
  {
    code: 'PHP',
    symbol: '₱',
    name: {
      es: 'Peso Filipino',
      en: 'Philippine Peso',
      fr: 'Peso philippin',
      de: 'Philippinischer Peso',
      it: 'Peso filippino',
      pt: 'Peso Filipino',
    },
    category: 'PESO',
    country: 'Filipinas',
    decimals: 2,
  },
  {
    code: 'UYU',
    symbol: '$U',
    name: {
      es: 'Peso Uruguayo',
      en: 'Uruguayan Peso',
      fr: 'Peso uruguayen',
      de: 'Uruguayischer Peso',
      it: 'Peso uruguaiano',
      pt: 'Peso Uruguaio',
    },
    category: 'PESO',
    country: 'Uruguay',
    decimals: 2,
  },

  // --- LIBRAS ---
  {
    code: 'GBP',
    symbol: '£',
    name: {
      es: 'Libra Esterlina (Reino Unido)',
      en: 'British Pound Sterling',
      fr: 'Livre sterling (Royaume-Uni)',
      de: 'Britisches Pfund (Vereinigtes Königreich)',
      it: 'Sterlina britannica (Regno Unito)',
      pt: 'Libra Esterlina (Reino Unido)',
    },
    category: 'POUND',
    country: 'Reino Unido',
    decimals: 2,
  },
  {
    code: 'GIP',
    symbol: '£',
    name: {
      es: 'Libra de Gibraltar',
      en: 'Gibraltar Pound',
      fr: 'Livre de Gibraltar',
      de: 'Gibraltar-Pfund',
      it: 'Sterlina di Gibilterra',
      pt: 'Libra de Gibraltar',
    },
    category: 'POUND',
    country: 'Gibraltar',
    decimals: 2,
  },
  {
    code: 'FKP',
    symbol: '£',
    name: {
      es: 'Libra Malvinense',
      en: 'Falkland Islands Pound',
      fr: 'Livre des îles Malouines',
      de: 'Falkland-Pfund',
      it: 'Sterlina delle Falkland',
      pt: 'Libra das Malvinas',
    },
    category: 'POUND',
    country: 'Islas Malvinas',
    decimals: 2,
  },
  {
    code: 'SHP',
    symbol: '£',
    name: {
      es: 'Libra de Santa Elena',
      en: 'Saint Helena Pound',
      fr: 'Livre de Sainte-Hélène',
      de: 'St.-Helena-Pfund',
      it: 'Sterlina di Sant Elena',
      pt: 'Libra de Santa Helena',
    },
    category: 'POUND',
    country: 'Santa Elena',
    decimals: 2,
  },

  // --- DÓLARES ---
  {
    code: 'USD',
    symbol: '$',
    name: {
      es: 'Dólar Estadounidense',
      en: 'US Dollar',
      fr: 'Dollar américain',
      de: 'US-Dollar',
      it: 'Dollaro statunitense',
      pt: 'Dólar Americano',
    },
    category: 'DOLLAR',
    country: 'Estados Unidos',
    decimals: 2,
  },
  {
    code: 'CAD',
    symbol: 'CA$',
    name: {
      es: 'Dólar Canadiense',
      en: 'Canadian Dollar',
      fr: 'Dollar canadien',
      de: 'Kanadischer Dollar',
      it: 'Dollaro canadese',
      pt: 'Dólar Canadense',
    },
    category: 'DOLLAR',
    country: 'Canadá',
    decimals: 2,
  },
  {
    code: 'AUD',
    symbol: 'A$',
    name: {
      es: 'Dólar Australiano',
      en: 'Australian Dollar',
      fr: 'Dollar australien',
      de: 'Australischer Dollar',
      it: 'Dollaro australiano',
      pt: 'Dólar Australiano',
    },
    category: 'DOLLAR',
    country: 'Australia',
    decimals: 2,
  },
  {
    code: 'NZD',
    symbol: 'NZ$',
    name: {
      es: 'Dólar Neozelandés',
      en: 'New Zealand Dollar',
      fr: 'Dollar néo-zélandais',
      de: 'Neuseeland-Dollar',
      it: 'Dollaro neozelandese',
      pt: 'Dólar Neozelandês',
    },
    category: 'DOLLAR',
    country: 'Nueva Zelanda',
    decimals: 2,
  },
  {
    code: 'SGD',
    symbol: 'S$',
    name: {
      es: 'Dólar de Singapur',
      en: 'Singapore Dollar',
      fr: 'Dollar de Singapour',
      de: 'Singapur-Dollar',
      it: 'Dollaro di Singapore',
      pt: 'Dólar de Cingapura',
    },
    category: 'DOLLAR',
    country: 'Singapur',
    decimals: 2,
  },
  {
    code: 'HKD',
    symbol: 'HK$',
    name: {
      es: 'Dólar de Hong Kong',
      en: 'Hong Kong Dollar',
      fr: 'Dollar de Hong Kong',
      de: 'Hongkong-Dollar',
      it: 'Dollaro di Hong Kong',
      pt: 'Dólar de Hong Kong',
    },
    category: 'DOLLAR',
    country: 'Hong Kong',
    decimals: 2,
  },

  // --- GLOBALES Y REGIONALES ---
  {
    code: 'JPY',
    symbol: '¥',
    name: {
      es: 'Yen Japonés',
      en: 'Japanese Yen',
      fr: 'Yen japonais',
      de: 'Japanischer Yen',
      it: 'Yen giapponese',
      pt: 'Iene Japonês',
    },
    category: 'GLOBAL',
    country: 'Japón',
    decimals: 0,
  },
  {
    code: 'CHF',
    symbol: 'CHF',
    name: {
      es: 'Franco Suizo',
      en: 'Swiss Franc',
      fr: 'Franc suisse',
      de: 'Schweizer Franken',
      it: 'Franco svizzero',
      pt: 'Franco Suíço',
    },
    category: 'GLOBAL',
    country: 'Suiza',
    decimals: 2,
  },
  {
    code: 'BRL',
    symbol: 'R$',
    name: {
      es: 'Real Brasileño',
      en: 'Brazilian Real',
      fr: 'Réal brésilien',
      de: 'Brasilianischer Real',
      it: 'Real brasiliano',
      pt: 'Real Brasileiro',
    },
    category: 'GLOBAL',
    country: 'Brasil',
    decimals: 2,
  },
  {
    code: 'PEN',
    symbol: 'S/',
    name: {
      es: 'Sol Peruano',
      en: 'Peruvian Sol',
      fr: 'Sol péruvien',
      de: 'Peruanischer Sol',
      it: 'Sol peruviano',
      pt: 'Sol Peruano',
    },
    category: 'GLOBAL',
    country: 'Perú',
    decimals: 2,
  },
  {
    code: 'INR',
    symbol: '₹',
    name: {
      es: 'Rupia India',
      en: 'Indian Rupee',
      fr: 'Roupie indienne',
      de: 'Indische Rupie',
      it: 'Rupia indiana',
      pt: 'Rúpia Indiana',
    },
    category: 'GLOBAL',
    country: 'India',
    decimals: 2,
  },
  {
    code: 'CNY',
    symbol: '¥',
    name: {
      es: 'Yuan Chino',
      en: 'Chinese Yuan',
      fr: 'Yuan chinois',
      de: 'Chinesischer Yuan',
      it: 'Yuan cinese',
      pt: 'Yuan Chinês',
    },
    category: 'GLOBAL',
    country: 'China',
    decimals: 2,
  },
  {
    code: 'KRW',
    symbol: '₩',
    name: {
      es: 'Won Surcoreano',
      en: 'South Korean Won',
      fr: 'Won sud-coréen',
      de: 'Südkoreanischer Won',
      it: 'Won sudcoreano',
      pt: 'Won Sul-coreano',
    },
    category: 'GLOBAL',
    country: 'Corea del Sur',
    decimals: 0,
  },
  {
    code: 'SEK',
    symbol: 'kr',
    name: {
      es: 'Corona Sueca',
      en: 'Swedish Krona',
      fr: 'Couronne suédoise',
      de: 'Schwedische Krone',
      it: 'Corona svedese',
      pt: 'Coroa Sueca',
    },
    category: 'GLOBAL',
    country: 'Suecia',
    decimals: 2,
  },
  {
    code: 'NOK',
    symbol: 'kr',
    name: {
      es: 'Corona Noruega',
      en: 'Norwegian Krone',
      fr: 'Couronne norvégienne',
      de: 'Norwegische Krone',
      it: 'Corona norvegese',
      pt: 'Coroa Norueguesa',
    },
    category: 'GLOBAL',
    country: 'Noruega',
    decimals: 2,
  },
  {
    code: 'DKK',
    symbol: 'kr',
    name: {
      es: 'Corona Danesa',
      en: 'Danish Krone',
      fr: 'Couronne danoise',
      de: 'Dänische Krone',
      it: 'Corona danese',
      pt: 'Coroa Dinamarquesa',
    },
    category: 'GLOBAL',
    country: 'Dinamarca',
    decimals: 2,
  },
  {
    code: 'PLN',
    symbol: 'zł',
    name: {
      es: 'Złoty Polaco',
      en: 'Polish Zloty',
      fr: 'Zloty polonais',
      de: 'Polnischer Zloty',
      it: 'Zloty polacco',
      pt: 'Złoty Polonês',
    },
    category: 'GLOBAL',
    country: 'Polonia',
    decimals: 2,
  },
  {
    code: 'TRY',
    symbol: '₺',
    name: {
      es: 'Lira Turca',
      en: 'Turkish Lira',
      fr: 'Livre turque',
      de: 'Türkische Lira',
      it: 'Lira turca',
      pt: 'Lira Turca',
    },
    category: 'GLOBAL',
    country: 'Turquía',
    decimals: 2,
  },
  {
    code: 'ZAR',
    symbol: 'R',
    name: {
      es: 'Rand Sudafricano',
      en: 'South African Rand',
      fr: 'Rand sud-africain',
      de: 'Südafrikanischer Rand',
      it: 'Rand sudafricano',
      pt: 'Rand Sul-africano',
    },
    category: 'GLOBAL',
    country: 'Sudáfrica',
    decimals: 2,
  },
];

export const CURRENCY_MAP: Record<string, CurrencyInfo> = SUPPORTED_CURRENCIES.reduce(
  (acc, curr) => {
    acc[curr.code] = curr;
    return acc;
  },
  {} as Record<string, CurrencyInfo>
);

export function getCurrencyInfo(code?: string): CurrencyInfo {
  if (!code) return CURRENCY_MAP['EUR'];
  return CURRENCY_MAP[code.toUpperCase()] || {
    code: code.toUpperCase(),
    symbol: code.toUpperCase(),
    name: {
      es: code.toUpperCase(),
      en: code.toUpperCase(),
      fr: code.toUpperCase(),
      de: code.toUpperCase(),
      it: code.toUpperCase(),
      pt: code.toUpperCase(),
    },
    category: 'EUR',
    country: '',
    decimals: 2,
  };
}

/**
 * Formatea una cantidad económica según la divisa seleccionada y el idioma activo.
 */
export function formatCurrency(
  amount: number,
  currencyCode = 'EUR',
  locale = 'es-ES'
): string {
  const info = getCurrencyInfo(currencyCode);
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(amount);
  } catch {
    // Fallback seguro si la combinación locale/currency no es soportada por el entorno
    const fixed = amount.toFixed(info.decimals);
    return `${info.symbol} ${fixed} ${info.code}`;
  }
}
