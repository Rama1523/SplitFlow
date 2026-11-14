import type { CapacitorConfig } from '@capacitor/cli';

/**
 * SplitFlow — Capacitor Configuration
 * Configuracion hibrida para empaquetado nativo en Android y Web.
 * Incluye definicion de plugins para notificaciones locales, push y autenticacion biometrica.
 */
const config: CapacitorConfig = {
  appId: 'app.splitflow.client',
  appName: 'SplitFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_splitflow',
      iconColor: '#0f172a',
      sound: 'notification_sound.wav',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
