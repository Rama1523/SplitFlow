import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { AppNotification, NotificationType } from '../../types';
import { secureStorage } from './secureStorage';
import { supabase, isSupabaseConfigured } from '../supabase';

/**
 * SplitFlow — Hybrid Notification Service (Web + Android Capacitor)
 * Gestiona alertas críticas in-app sincronizadas con Supabase PostgreSQL,
 * toasts flotantes interactivos y notificaciones directas al sistema operativo
 * en segundo plano mediante @capacitor/local-notifications y Web Notifications.
 */

type NotificationListener = (notifications: AppNotification[]) => void;
type ToastListener = (notification: AppNotification) => void;

class HybridNotificationService {
  private notifications: AppNotification[] = [];
  private listeners: Set<NotificationListener> = new Set();
  private toastListeners: Set<ToastListener> = new Set();
  private isInitialized = false;
  private currentUserId: string | null = null;
  private realtimeChannel: any = null;

  constructor() {
    this.init();
  }

  private getStorageKey(userId: string | null): string {
    return userId ? `splitflow_usr_${userId}_notifications` : 'splitflow_app_notifications';
  }

  /**
   * Vincula el usuario activo para sincronizar su bandeja de notificaciones interna
   */
  async setUserId(userId: string | null): Promise<void> {
    if (this.currentUserId === userId) return;
    this.currentUserId = userId;

    // Desconectar canal en tiempo real previo
    if (this.realtimeChannel && supabase) {
      try {
        supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      } catch {
        // ignore
      }
    }

    if (!userId) {
      this.notifications = [];
      this.notifyListeners();
      return;
    }

    // 1. Cargar caché local del usuario
    if (typeof window !== 'undefined') {
      try {
        const localKey = this.getStorageKey(userId);
        const cached = localStorage.getItem(localKey);
        if (cached) {
          this.notifications = JSON.parse(cached);
          this.notifyListeners();
        }
      } catch {
        // ignore
      }
    }

    // 2. Consultar notificaciones remotas en Supabase PostgreSQL
    await this.fetchRemoteNotifications(userId);

    // 3. Suscribirse a cambios en tiempo real en Supabase para este usuario
    if (isSupabaseConfigured && supabase) {
      try {
        this.realtimeChannel = supabase
          .channel(`user_notifications_${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const newRow = payload.new as any;
              if (newRow) {
                const incoming: AppNotification = {
                  id: newRow.id,
                  userId: newRow.user_id,
                  type: newRow.type as NotificationType,
                  title: newRow.title,
                  message: newRow.message,
                  createdAt: newRow.created_at || new Date().toISOString(),
                  isRead: Boolean(newRow.is_read),
                  groupId: newRow.group_id,
                  groupName: newRow.group_name,
                  targetId: newRow.target_id,
                };

                this.handleIncomingNotification(incoming);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime notifications notice:', err);
      }
    }
  }

  /**
   * Consulta las notificaciones guardadas en la base de datos de Supabase
   */
  private async fetchRemoteNotifications(userId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // 1. Intentar mediante RPC get_user_notifications
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_user_notifications', {
        p_user_id: userId,
        p_limit: 50,
      });

      if (!rpcErr && Array.isArray(rpcData)) {
        const mapped: AppNotification[] = rpcData.map((n: any) => ({
          id: n.id,
          userId: userId,
          type: n.type as NotificationType,
          title: n.title,
          message: n.message,
          createdAt: n.createdAt || n.created_at || new Date().toISOString(),
          isRead: Boolean(n.isRead ?? n.is_read),
          groupId: n.groupId || n.group_id,
          groupName: n.groupName || n.group_name,
          targetId: n.targetId || n.target_id,
        }));

        this.notifications = mapped;
        this.persistLocally();
        this.notifyListeners();
        return;
      }

      // 2. Fallback a consulta directa sobre la tabla notifications
      const { data: rows, error: selectErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!selectErr && rows && rows.length > 0) {
        const mapped: AppNotification[] = rows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          type: r.type as NotificationType,
          title: r.title,
          message: r.message,
          createdAt: r.created_at,
          isRead: Boolean(r.is_read),
          groupId: r.group_id,
          groupName: r.group_name,
          targetId: r.target_id,
        }));

        this.notifications = mapped;
        this.persistLocally();
        this.notifyListeners();
      }
    } catch (e) {
      console.warn('Supabase fetchRemoteNotifications notice:', e);
    }
  }

  private handleIncomingNotification(incoming: AppNotification): void {
    // Evitar duplicados
    if (this.notifications.some((n) => n.id === incoming.id)) return;

    this.notifications = [incoming, ...this.notifications].slice(0, 50);
    this.persistLocally();
    this.notifyListeners();

    // Disparar toast in-app visual
    this.notifyToastListeners(incoming);

    // Si es nativo, programar alerta del sistema
    this.scheduleSystemNotification(incoming.title, incoming.message, incoming);
  }

  private persistLocally(): void {
    if (typeof window === 'undefined') return;
    try {
      const key = this.getStorageKey(this.currentUserId);
      localStorage.setItem(key, JSON.stringify(this.notifications.slice(0, 50)));
      // Mantener copia en secureStorage para compatibilidad
      secureStorage.saveNotifications(this.notifications);
    } catch {
      // ignore
    }
  }

  /**
   * Inicializa canales de notificaciones y permisos en Android nativo y Web
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Cargar historial previo de notificaciones
    this.notifications = await secureStorage.getNotifications();
    this.notifyListeners();

    if (Capacitor.isNativePlatform()) {
      try {
        // 1. Crear canal de alta prioridad para Android (barra de notificaciones)
        await LocalNotifications.createChannel({
          id: 'splitflow_critical_alerts',
          name: 'Alertas Críticas SplitFlow',
          description: 'Notificaciones sobre invitaciones a grupos, nuevos gastos y liquidaciones',
          importance: 5, // High / Heads-up notification
          visibility: 1, // Public
          vibration: true,
        });

        // 2. Solicitar permisos de notificaciones locales si no se han concedido
        const localStatus = await LocalNotifications.checkPermissions();
        if (localStatus.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        // 3. Configurar notificaciones push si están disponibles
        const pushStatus = await PushNotifications.checkPermissions();
        if (pushStatus.receive === 'granted') {
          await PushNotifications.register();
        }

        // Escuchar acciones de usuario en las notificaciones nativas
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          console.info('Notificación nativa pulsada:', action.notification.title);
        });
      } catch (err) {
        console.warn('Capacitor native notification initialization notice:', err);
      }
    }
  }

  /**
   * Solicita permisos explícitos al usuario (para invocar desde ajustes o botón)
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const local = await LocalNotifications.requestPermissions();
        const push = await PushNotifications.requestPermissions();
        return local.display === 'granted' || push.receive === 'granted';
      }
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Emite una notificación interna en la app:
   * 1. La persiste en Supabase PostgreSQL (`public.notifications`) para el destinatario.
   * 2. La almacena en el centro de notificaciones in-app local.
   * 3. Dispara un toast flotante en la interfaz activa.
   * 4. Envia notificación al sistema operativo (Android/Web).
   */
  async dispatchNotification(params: {
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    groupId?: string;
    groupName?: string;
    targetId?: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<AppNotification> {
    const targetUserId = params.userId || this.currentUserId;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newNotification: AppNotification = {
      id: notificationId,
      userId: targetUserId || undefined,
      type: params.type,
      title: params.title,
      message: params.message,
      createdAt: new Date().toISOString(),
      isRead: false,
      groupId: params.groupId,
      groupName: params.groupName,
      targetId: params.targetId,
      metadata: params.metadata,
    };

    // 1. Si Supabase está disponible y se conoce el destinatario, persistir en base de datos
    if (isSupabaseConfigured && supabase && targetUserId) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_in_app_notification', {
          p_user_id: targetUserId,
          p_type: params.type,
          p_title: params.title,
          p_message: params.message,
          p_group_id: params.groupId || null,
          p_group_name: params.groupName || null,
          p_target_id: params.targetId || null,
        });

        if (!rpcErr && rpcRes?.id) {
          newNotification.id = rpcRes.id;
        } else {
          // Fallback a inserción directa
          await supabase.from('notifications').insert({
            user_id: targetUserId,
            type: params.type,
            title: params.title,
            message: params.message,
            group_id: params.groupId,
            group_name: params.groupName,
            target_id: params.targetId,
            is_read: false,
          });
        }
      } catch (e) {
        console.warn('Supabase dispatchNotification error:', e);
      }
    }

    // 2. Si la notificación va dirigida al usuario actualmente logueado o es global:
    const isForCurrentUser = !targetUserId || targetUserId === this.currentUserId;

    if (isForCurrentUser) {
      this.notifications = [newNotification, ...this.notifications.filter((n) => n.id !== newNotification.id)].slice(0, 50);
      this.persistLocally();
      this.notifyListeners();

      // Disparar toast flotante in-app
      this.notifyToastListeners(newNotification);

      // Programar alerta del sistema operativo si corresponde
      this.scheduleSystemNotification(params.title, params.message, newNotification);
    } else if (typeof window !== 'undefined' && targetUserId) {
      // Guardar también en la caché del usuario destino por si comparte navegador
      try {
        const targetKey = this.getStorageKey(targetUserId);
        const saved = localStorage.getItem(targetKey);
        const list: AppNotification[] = saved ? JSON.parse(saved) : [];
        const updated = [newNotification, ...list.filter((n) => n.id !== newNotification.id)].slice(0, 50);
        localStorage.setItem(targetKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    return newNotification;
  }

  private scheduleSystemNotification(title: string, message: string, notif: AppNotification): void {
    if (Capacitor.isNativePlatform()) {
      try {
        const notificationId = Math.floor(Math.random() * 2147483647);
        LocalNotifications.schedule({
          notifications: [
            {
              id: notificationId,
              title: title,
              body: message,
              channelId: 'splitflow_critical_alerts',
              schedule: { at: new Date(Date.now() + 100) },
              extra: {
                groupId: notif.groupId,
                type: notif.type,
                targetId: notif.targetId,
              },
            },
          ],
        });
      } catch (err) {
        console.warn('Error scheduling native notification:', err);
      }
    } else {
      // En Web: si la pestaña está oculta y hay permisos, lanzar notificación del navegador
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden' &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(title, {
            body: message,
            tag: notif.id,
          });
        } catch {
          // Ignorar restricciones de Web Notification en entornos restringidos
        }
      }
    }
  }

  /**
   * Obtiene la lista actual de notificaciones in-app
   */
  getNotifications(): AppNotification[] {
    return this.notifications;
  }

  /**
   * Conteo de no leídas
   */
  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(id: string): Promise<void> {
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    this.persistLocally();
    this.notifyListeners();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Marca todas como leídas
   */
  async markAllAsRead(): Promise<void> {
    this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
    this.persistLocally();
    this.notifyListeners();

    if (isSupabaseConfigured && supabase && this.currentUserId) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', this.currentUserId);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Elimina una notificación
   */
  async removeNotification(id: string): Promise<void> {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.persistLocally();
    this.notifyListeners();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('notifications').delete().eq('id', id);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Limpia todo el historial de notificaciones
   */
  async clearAll(): Promise<void> {
    this.notifications = [];
    this.persistLocally();
    this.notifyListeners();

    if (isSupabaseConfigured && supabase && this.currentUserId) {
      try {
        await supabase.from('notifications').delete().eq('user_id', this.currentUserId);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Suscribe a cambios en las notificaciones
   */
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    listener(this.notifications);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Suscribe a eventos de nuevo toast flotante in-app
   */
  subscribeToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    return () => {
      this.toastListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.notifications);
      } catch (e) {
        console.warn('Notification listener error:', e);
      }
    });
  }

  private notifyToastListeners(notification: AppNotification): void {
    this.toastListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (e) {
        console.warn('Notification toast listener error:', e);
      }
    });
  }
}

export const notificationService = new HybridNotificationService();
