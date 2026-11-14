import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { User, AppNotification } from '../../types';

/**
 * SplitFlow — Secure Persistent Storage Service
 * Abstraccion unificada para almacenamiento seguro de sesion y configuraciones
 * en entornos nativos (Android/iOS via Preferences) y Web (localStorage).
 */

const STORAGE_KEYS = {
  SAVED_SESSION: 'splitflow_saved_session',
  BIOMETRICS_ENABLED: 'splitflow_biometrics_enabled',
  APP_NOTIFICATIONS: 'splitflow_app_notifications',
  LAST_ACTIVE_USER: 'splitflow_last_active_user',
} as const;

export const secureStorage = {
  /**
   * Guarda un valor en el almacenamiento seguro
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key, value });
      } else {
        localStorage.setItem(key, value);
      }
    } catch (err) {
      console.warn(`Error setting secure storage item "${key}":`, err);
      // Fallback
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignorar en entornos de navegacion privada
      }
    }
  },

  /**
   * Obtiene un valor del almacenamiento seguro
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key });
        return value;
      }
      return localStorage.getItem(key);
    } catch (err) {
      console.warn(`Error getting secure storage item "${key}":`, err);
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },

  /**
   * Elimina un valor del almacenamiento seguro
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key });
      }
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`Error removing secure storage item "${key}":`, err);
    }
  },

  /**
   * Guarda la sesion del usuario de forma persistente
   */
  async saveUserSession(user: User): Promise<void> {
    await this.setItem(STORAGE_KEYS.SAVED_SESSION, JSON.stringify(user));
    await this.setItem(STORAGE_KEYS.LAST_ACTIVE_USER, user.id);
  },

  /**
   * Recupera la sesion del usuario guardada
   */
  async getSavedUserSession(): Promise<User | null> {
    const raw = await this.getItem(STORAGE_KEYS.SAVED_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  /**
   * Limpia la sesion del usuario
   */
  async clearUserSession(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.SAVED_SESSION);
    await this.removeItem(STORAGE_KEYS.LAST_ACTIVE_USER);
  },

  /**
   * Limpia todos los datos de usuario, sesion y configuraciones persistentes
   */
  async clearAllUserData(): Promise<void> {
    await this.clearUserSession();
    await this.setBiometricsActive(false);
    await this.removeItem(STORAGE_KEYS.APP_NOTIFICATIONS);
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.clear();
      } catch (err) {
        console.warn('Error clearing native preferences:', err);
      }
    }
  },

  /**
   * Consulta si la biometria esta activada por el usuario
   */
  async isBiometricsActive(): Promise<boolean> {
    const val = await this.getItem(STORAGE_KEYS.BIOMETRICS_ENABLED);
    return val === 'true';
  },

  /**
   * Activa o desactiva la preferencia de biometria
   */
  async setBiometricsActive(enabled: boolean): Promise<void> {
    await this.setItem(STORAGE_KEYS.BIOMETRICS_ENABLED, enabled ? 'true' : 'false');
  },

  /**
   * Guarda el historial de notificaciones in-app
   */
  async saveNotifications(notifications: AppNotification[]): Promise<void> {
    await this.setItem(STORAGE_KEYS.APP_NOTIFICATIONS, JSON.stringify(notifications.slice(0, 50)));
  },

  /**
   * Carga el historial de notificaciones in-app
   */
  async getNotifications(): Promise<AppNotification[]> {
    const raw = await this.getItem(STORAGE_KEYS.APP_NOTIFICATIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as AppNotification[];
    } catch {
      return [];
    }
  },
};
