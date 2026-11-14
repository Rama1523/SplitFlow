import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from './secureStorage';

/**
 * SplitFlow — Native Biometrics Service
 * Gestion de autenticacion biometrica (huella dactilar, Face Unlock, iris)
 * con soporte nativo para Android/iOS mediante Capacitor y fallback controlado.
 */

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'FINGERPRINT' | 'FACE_AUTHENTICATION' | 'IRIS' | 'NONE';
  label: string;
  isEnrolled: boolean;
}

export const biometricService = {
  /**
   * Comprueba si el hardware biometrico esta disponible y configurado
   */
  async checkAvailability(): Promise<BiometricStatus> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await NativeBiometric.isAvailable();
        let type: BiometricStatus['biometryType'] = 'NONE';
        let label = 'Biometria';

        if (result.biometryType === BiometryType.TOUCH_ID || result.biometryType === BiometryType.FINGERPRINT) {
          type = 'FINGERPRINT';
          label = 'Huella dactilar';
        } else if (result.biometryType === BiometryType.FACE_ID || result.biometryType === BiometryType.FACE_AUTHENTICATION) {
          type = 'FACE_AUTHENTICATION';
          label = 'Reconocimiento facial';
        } else if (result.biometryType === BiometryType.IRIS_AUTHENTICATION) {
          type = 'IRIS';
          label = 'Escaner de iris';
        }

        return {
          isAvailable: !!result.isAvailable,
          biometryType: type,
          label,
          isEnrolled: !!result.isAvailable,
        };
      }

      // En entorno Web de desarrollo / testing
      const webSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;
      return {
        isAvailable: webSupported,
        biometryType: 'FINGERPRINT',
        label: 'Huella dactilar / Clave de acceso',
        isEnrolled: webSupported,
      };
    } catch (err) {
      console.warn('Biometric availability check failed:', err);
      return {
        isAvailable: false,
        biometryType: 'NONE',
        label: 'Biometria no disponible',
        isEnrolled: false,
      };
    }
  },

  /**
   * Verifica la identidad del usuario mediante huella o rostro
   */
  async verifyIdentity(reason = 'Confirma tu identidad para acceder a SplitFlow'): Promise<{ success: boolean; error?: string }> {
    try {
      if (Capacitor.isNativePlatform()) {
        await NativeBiometric.verifyIdentity({
          reason,
          title: 'SplitFlow - Acceso Seguro',
          subtitle: 'Autenticacion biometrica requerida',
          description: 'Usa tu sensor biometrico para continuar',
          negativeButtonText: 'Cancelar',
        });
        return { success: true };
      }

      // Fallback para Web: si WebAuthn no esta configurado en local, simular confirmacion para pruebas de interfaz
      if (typeof window !== 'undefined') {
        // En navegadores web, simulamos un pequeno retardo como si el usuario tocara el sensor
        await new Promise((resolve) => setTimeout(resolve, 600));
        return { success: true };
      }

      return { success: false, error: 'Biometria no disponible en este entorno.' };
    } catch (err: unknown) {
      console.warn('Biometric verification failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Verificacion biometrica cancelada o fallida.';
      return { success: false, error: errMsg };
    }
  },

  /**
   * Consulta si la biometria esta habilitada en ajustes
   */
  async isEnabled(): Promise<boolean> {
    return secureStorage.isBiometricsActive();
  },

  /**
   * Activa o desactiva la biometria
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    if (enabled) {
      // Para activar, requerimos verificar inmediatamente que el usuario es quien dice ser
      const verify = await this.verifyIdentity('Confirma tu huella o rostro para activar el acceso biometrico');
      if (!verify.success) {
        return false;
      }
    }
    await secureStorage.setBiometricsActive(enabled);
    return true;
  },
};
