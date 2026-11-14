/**
 * SplitFlow — Security, Validation & Sanitization Engine
 * Políticas de contraseñas seguras, sanitización contra XSS e inyecciones,
 * y validación estricta de transacciones financieras.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  score: number; // 0 a 4
  feedback: string[];
}

/**
 * Validador estricto de contraseñas:
 * - Mínimo 8 caracteres
 * - Al menos una letra mayúscula
 * - Al menos un número
 * - Al menos un carácter especial
 */
export function validatePasswordSecurity(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const feedback: string[] = [];
  if (!hasMinLength) feedback.push('Mínimo 8 caracteres');
  if (!hasUppercase) feedback.push('Al menos una letra mayúscula');
  if (!hasNumber) feedback.push('Al menos un número');
  if (!hasSpecialChar) feedback.push('Al menos un carácter especial (!@#$%...)');

  let score = 0;
  if (hasMinLength) score++;
  if (hasUppercase) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;

  return {
    isValid: hasMinLength && hasUppercase && hasNumber && hasSpecialChar,
    hasMinLength,
    hasUppercase,
    hasNumber,
    hasSpecialChar,
    score,
    feedback,
  };
}

/**
 * Sanitiza cadenas de texto para prevenir ataques de Cross-Site Scripting (XSS)
 * e inyecciones de código malicioso en campos de usuario o descripciones de gastos.
 */
export function sanitizeTextInput(input: string, maxLength = 250): string {
  if (!input) return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Elimina etiquetas HTML básicas
    .replace(/javascript:/gi, '') // Elimina pseudo-protocolos maliciosos
    .replace(/on\w+=/gi, '') // Elimina manejadores de eventos inline (onclick, etc.)
    .slice(0, maxLength);
}

/**
 * Validador estricto de importes monetarios:
 * - No permite importes negativos ni cero
 * - Verifica que sea un número finito válido
 * - Limita a un máximo razonable por transacción (1.000.000 €)
 * - Redondea a 2 decimales para precisión contable
 */
export function validateMonetaryAmount(amount: number | string): {
  isValid: boolean;
  value: number;
  error?: string;
} {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numeric) || !isFinite(numeric)) {
    return { isValid: false, value: 0, error: 'El monto ingresado no es un número válido.' };
  }

  if (numeric <= 0) {
    return { isValid: false, value: 0, error: 'El importe debe ser estrictamente mayor a 0,00 €.' };
  }

  if (numeric > 1000000) {
    return { isValid: false, value: 0, error: 'El importe supera el límite máximo permitido (1.000.000 €).' };
  }

  // Redondeo exacto a 2 decimales
  const rounded = Math.round(numeric * 100) / 100;
  return { isValid: true, value: rounded };
}

/**
 * Validador de formato de correo electrónico
 */
export function validateEmailFormat(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Sanitiza y normaliza un nombre de usuario:
 * - Elimina el símbolo '@' inicial si el usuario lo escribe.
 * - Bloquea y elimina comillas simples ('), dobles (") y acentos graves (`).
 * - Bloquea caracteres de control, saltos de línea y símbolos peligrosos para inyecciones (SQL/XSS/Command).
 * - Convierte a minúsculas y limita la longitud a 24 caracteres.
 */
export function sanitizeUsername(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/^@+/, '') // Quitar @ iniciales
    .replace(/['"`]/g, '') // Eliminar comillas simples, dobles y backticks
    .replace(/[<>\\\/;:\(\)=\${}\[\]|&^%*!?+~]/g, '') // Eliminar vectores de inyección
    .replace(/\s+/g, '') // Sin espacios
    .toLowerCase()
    .slice(0, 24);
}

/**
 * Detecta si el texto introducido contiene caracteres peligrosos de inyección
 * (comillas, delimitadores SQL, etiquetas HTML o caracteres de escape).
 */
export function detectDangerousUsernameChars(input: string): {
  hasDangerousChars: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (/['"`]/.test(input)) {
    reasons.push("Contiene comillas simples ('), dobles (\") o acentos graves (`).");
  }
  if (/[<>]/.test(input)) {
    reasons.push('Contiene caracteres de etiquetas HTML (< >).');
  }
  if (/[\\\/;:\(\)=\${}\[\]|&^%*!?+~]/.test(input)) {
    reasons.push('Contiene caracteres especiales o delimitadores de inyección no permitidos.');
  }
  if (/\s/.test(input)) {
    reasons.push('No se permiten espacios en blanco en el nombre de usuario.');
  }

  return {
    hasDangerousChars: reasons.length > 0,
    reasons,
  };
}

/**
 * Validador estricto de nombre de usuario:
 * - Longitud entre 3 y 24 caracteres.
 * - Solo caracteres alfanuméricos en minúscula, guiones y puntos (a-z, 0-9, _, -, .).
 * - Debe comenzar y terminar con un carácter alfanumérico.
 * - Sin puntos o guiones consecutivos.
 * - Rechaza de inmediato cualquier comilla o carácter malicioso.
 */
export function validateUsername(username: string): {
  isValid: boolean;
  error?: string;
  cleanUsername: string;
} {
  const raw = (username || '').trim();
  const clean = sanitizeUsername(raw);

  if (!raw || !clean) {
    return {
      isValid: false,
      error: 'El nombre de usuario es obligatorio.',
      cleanUsername: '',
    };
  }

  // Verificación de caracteres peligrosos en el texto crudo
  const dangerous = detectDangerousUsernameChars(raw.replace(/^@/, ''));
  if (dangerous.hasDangerousChars) {
    return {
      isValid: false,
      error: `Caracteres no permitidos: ${dangerous.reasons.join(' ')}`,
      cleanUsername: clean,
    };
  }

  if (clean.length < 3) {
    return {
      isValid: false,
      error: 'El nombre de usuario debe tener al menos 3 caracteres.',
      cleanUsername: clean,
    };
  }

  if (clean.length > 24) {
    return {
      isValid: false,
      error: 'El nombre de usuario no puede superar los 24 caracteres.',
      cleanUsername: clean,
    };
  }

  // Formato: empieza y termina con alfanumérico, admite _, - y . en medio
  const validPattern = /^[a-z0-9][a-z0-9_.-]*[a-z0-9]$/;
  if (!validPattern.test(clean)) {
    return {
      isValid: false,
      error: 'Debe comenzar y terminar con una letra o número, y solo puede contener letras, números, guiones o puntos.',
      cleanUsername: clean,
    };
  }

  // Sin puntos o guiones repetidos
  if (/\.{2,}|_{2,}|-{2,}/.test(clean)) {
    return {
      isValid: false,
      error: 'No se permiten puntos, guiones o barras bajas consecutivas.',
      cleanUsername: clean,
    };
  }

  return {
    isValid: true,
    cleanUsername: clean,
  };
}

/**
 * Comprueba la disponibilidad y unicidad de un nombre de usuario frente a una lista de usuarios.
 * Omite el usuario actual si se facilita su ID (para edición de perfil).
 */
export function isUsernameAvailableInList(
  username: string,
  existingUsers: Array<{ id: string; username?: string; email: string }>,
  excludeUserId?: string
): boolean {
  const clean = sanitizeUsername(username);
  if (!clean) return false;

  return !existingUsers.some((u) => {
    if (excludeUserId && u.id === excludeUserId) return false;
    const existingName = sanitizeUsername(u.username || '');
    if (existingName && existingName === clean) return true;
    return false;
  });
}
