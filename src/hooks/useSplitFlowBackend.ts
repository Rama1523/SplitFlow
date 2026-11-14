/**
 * SplitFlow — Unified Backend & Realtime Synchronization Hook
 * Capa de servicio con aislamiento estricto entre Modo Demo y Modo Producción (Supabase).
 * Soporte para verificación por correo electrónico obligatoria, captura de callback y cambio de entorno.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured, backendStatus } from '../lib/supabase';
import { User, Group, Expense, SettlementTransaction, GroupInvitation, PublicUser } from '../types';
import { createDataProvider, IDataProvider } from '../lib/dataProvider';
import { validateUsername, isUsernameAvailableInList, sanitizeUsername } from '../lib/security';
import { secureStorage } from '../lib/capacitor/secureStorage';
import { notificationService } from '../lib/capacitor/notifications';
import { 
  notifyExpenseAdded, 
  notifySettlementRecorded, 
  notifyGroupInvitation, 
  notifyAdminPromoted,
} from '../lib/emailNotifications';

export function useSplitFlowBackend() {
  // Instancia activa y única del proveedor de datos de producción (Supabase)
  const dataProvider: IDataProvider = useMemo(() => {
    return createDataProvider();
  }, []);

  // Estados de datos
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<SettlementTransaction[]>([]);

  // Solicitudes de amistad / unión a grupos (inicia vacío sin cuentas demo)
  const [requests, setRequests] = useState<GroupInvitation[]>(() => {
    if (typeof window === 'undefined') return [];
    if (!localStorage.getItem('splitflow_clean_slate_marker_v2')) return [];
    try {
      const saved = localStorage.getItem('splitflow_real_requests');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return [];
  });

  // Directorio de usuarios registrados para búsquedas estrictas
  const [allRegisteredUsers, setAllRegisteredUsers] = useState<User[]>(() => {
    if (typeof window === 'undefined') return [];
    if (!localStorage.getItem('splitflow_clean_slate_marker_v2')) return [];
    try {
      const saved = localStorage.getItem('splitflow_registered_users');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return [];
  });

  // Estados de carga y errores
  const [isLoading, setIsLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  // Sincronizar solicitudes y usuarios en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('splitflow_real_requests', JSON.stringify(requests));
    } catch (e) {
      console.warn(e);
    }
  }, [requests]);

  useEffect(() => {
    try {
      localStorage.setItem('splitflow_registered_users', JSON.stringify(allRegisteredUsers));
    } catch (e) {
      console.warn(e);
    }
  }, [allRegisteredUsers]);

  // ============================================================================
  // CARGA INICIAL DE DATOS SEGÚN EL MODO ACTIVO
  // ============================================================================
  const loadDataForUser = useCallback(async (user: User | null, provider: IDataProvider) => {
    setIsLoading(true);
    try {
      if (!user) {
        setGroups([]);
        setExpenses([]);
        setSettlements([]);
        setActiveGroupId('');
        return;
      }

      // 1. Obtener grupos
      const loadedGroups = await provider.getGroups(user.id);
      setGroups(loadedGroups);

      const targetGroupId = loadedGroups.length > 0 ? loadedGroups[0].id : '';
      setActiveGroupId(targetGroupId);

      // 2. Obtener gastos y liquidaciones si hay grupo
      if (targetGroupId) {
        const [loadedExpenses, loadedSettlements] = await Promise.all([
          provider.getExpenses(targetGroupId),
          provider.getSettlements(targetGroupId),
        ]);
        setExpenses(loadedExpenses);
        setSettlements(loadedSettlements);
      } else {
        setExpenses([]);
        setSettlements([]);
      }
    } catch (err: any) {
      console.warn('Error loading data in SplitFlow backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Inicializar proveedor al arrancar o al cambiar el modo demo
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setIsLoading(true);
      setBackendError(null);

      try {
        let user = await dataProvider.initialize();

        // Si no hay sesion activa en dataProvider, restaurar sesion persistente de secureStorage
        if (!user) {
          const savedSession = await secureStorage.getSavedUserSession();
          if (savedSession) {
            user = savedSession;
          }
        }

        if (!isMounted) return;

        setCurrentUser(user);
        if (user) {
          await secureStorage.saveUserSession(user);
          await loadDataForUser(user, dataProvider);
        } else {
          await loadDataForUser(null, dataProvider);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error inicializando datos';
        if (isMounted) setBackendError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [dataProvider, loadDataForUser]);

  // ============================================================================
  // GESTIÓN DE CALLBACK DE VERIFICACIÓN DE CORREO POR SUPABASE
  // ============================================================================
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Escuchar cambios de autenticación (ej: cuando el usuario hace clic en el enlace del email)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignorar evento PASSWORD_RECOVERY o URLs de restablecimiento para no forzar inicio de sesión en el dashboard
      if (event === 'PASSWORD_RECOVERY') {
        return;
      }

      const isSpecialAuthPath = typeof window !== 'undefined' && (
        window.location.pathname.includes('/reset-password') ||
        window.location.pathname.includes('/verify-email') ||
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery') ||
        window.location.search.includes('verify_email=')
      );
      if (isSpecialAuthPath) {
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) {
          const authUser = await dataProvider.initialize();
          if (authUser && authUser.isEmailVerified !== false) {
            setCurrentUser(authUser);
            await loadDataForUser(authUser, dataProvider);

            if (window.location.hash && window.location.hash.includes('access_token')) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [dataProvider, loadDataForUser]);

  // Sincronizar usuario activo con el servicio de notificaciones internas
  useEffect(() => {
    notificationService.setUserId(currentUser?.id || null);
  }, [currentUser?.id]);

  // Sincronizar gastos al cambiar activeGroupId con prevención estricta de state leaks
  useEffect(() => {
    // Aislar estado: vaciar inmediatamente los datos del grupo previo
    setExpenses([]);
    setSettlements([]);

    if (!activeGroupId) return;

    let isMounted = true;
    dataProvider.getExpenses(activeGroupId).then((exps) => {
      if (isMounted) setExpenses(exps);
    });
    dataProvider.getSettlements(activeGroupId).then((stls) => {
      if (isMounted) setSettlements(stls);
    });

    return () => {
      isMounted = false;
    };
  }, [activeGroupId, dataProvider]);

  // ============================================================================
  // MÉTODOS DE AUTENTICACIÓN
  // ============================================================================
  const login = useCallback(
    async (
      email: string,
      password?: string
    ): Promise<{ success: boolean; emailNotConfirmed?: boolean; email?: string; error?: string }> => {
      setIsLoading(true);
      setBackendError(null);
      setUnverifiedEmail(null);

      try {
        const res = await dataProvider.signIn(email, password);

        if (res.error) {
          setBackendError(res.error);
          if (res.emailNotConfirmed && res.email) {
            setUnverifiedEmail(res.email);
          }
          setIsLoading(false);
          return {
            success: false,
            emailNotConfirmed: res.emailNotConfirmed,
            email: res.email,
            error: res.error,
          };
        }

        if (res.user) {
          setUnverifiedEmail(null);
          setCurrentUser(res.user);
          await secureStorage.saveUserSession(res.user);
          await loadDataForUser(res.user, dataProvider);
          return { success: true };
        }
        return { success: false };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al iniciar sesion';
        setBackendError(msg);
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [dataProvider, loadDataForUser]
  );

  const checkUsernameAvailability = useCallback(
    async (
      username: string,
      excludeUserId?: string
    ): Promise<{ available: boolean; error?: string; cleanUsername: string }> => {
      const val = validateUsername(username);
      if (!val.isValid) {
        return { available: false, error: val.error, cleanUsername: val.cleanUsername };
      }

      const isAvailableInLocal = isUsernameAvailableInList(val.cleanUsername, allRegisteredUsers, excludeUserId);
      if (!isAvailableInLocal) {
        return {
          available: false,
          error: `El nombre de usuario @${val.cleanUsername} ya está ocupado.`,
          cleanUsername: val.cleanUsername,
        };
      }

      const isAvailableInProvider = await dataProvider.checkUsernameAvailable(val.cleanUsername, excludeUserId);
      if (!isAvailableInProvider) {
        return {
          available: false,
          error: `El nombre de usuario @${val.cleanUsername} ya se encuentra registrado.`,
          cleanUsername: val.cleanUsername,
        };
      }

      return { available: true, cleanUsername: val.cleanUsername };
    },
    [allRegisteredUsers, dataProvider]
  );

  const checkEmailAvailability = useCallback(
    async (
      email: string,
      excludeUserId?: string
    ): Promise<{ available: boolean; error?: string }> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { available: false, error: 'Introduce un correo electrónico válido.' };
      }

      const isTakenLocally = allRegisteredUsers.some(
        (u) => u.email.trim().toLowerCase() === cleanEmail && (!excludeUserId || u.id !== excludeUserId)
      );
      if (isTakenLocally) {
        return {
          available: false,
          error: 'Ya existe una cuenta registrada con este correo electrónico. Solo se permite 1 usuario por correo.',
        };
      }

      const isAvailableInProvider = await dataProvider.checkEmailAvailable(cleanEmail, excludeUserId);
      if (!isAvailableInProvider) {
        return {
          available: false,
          error: 'Ya existe una cuenta registrada con este correo electrónico. Solo se permite 1 usuario por correo.',
        };
      }

      return { available: true };
    },
    [allRegisteredUsers, dataProvider]
  );

  const register = useCallback(
    async (
      newUser: User, 
      password?: string
    ): Promise<{ success: boolean; requiresEmailConfirmation?: boolean; email?: string; username?: string; error?: string }> => {
      setIsLoading(true);
      setBackendError(null);
      setUnverifiedEmail(null);

      const cleanEmail = (newUser.email || '').trim().toLowerCase();
      if (!cleanEmail) {
        setBackendError('El correo electrónico es obligatorio.');
        setIsLoading(false);
        return { success: false, error: 'El correo electrónico es obligatorio.' };
      }

      // Verificación estricta: Solo 1 usuario por correo
      const emailCheck = await checkEmailAvailability(cleanEmail);
      if (!emailCheck.available) {
        const err = emailCheck.error || 'Ya existe una cuenta registrada con este correo electrónico.';
        setBackendError(err);
        setIsLoading(false);
        return { success: false, error: err };
      }

      // Validación estricta y saneamiento del nombre de usuario elegido
      const usernameVal = validateUsername(newUser.username || '');
      if (!usernameVal.isValid) {
        const err = usernameVal.error || 'Nombre de usuario no válido.';
        setBackendError(err);
        setIsLoading(false);
        return { success: false, error: err };
      }

      // Comprobar unicidad en directorio de usuarios y backend
      const availableCheck = await checkUsernameAvailability(usernameVal.cleanUsername);
      if (!availableCheck.available) {
        const err = availableCheck.error || 'El nombre de usuario ya está ocupado.';
        setBackendError(err);
        setIsLoading(false);
        return { success: false, error: err };
      }

      const userWithUsername: User = {
        ...newUser,
        username: usernameVal.cleanUsername,
      };

      try {
        const res = await dataProvider.signUp(
          {
            name: userWithUsername.name,
            username: usernameVal.cleanUsername,
            email: userWithUsername.email,
            monthlyIncome: userWithUsername.monthlyIncome,
          },
          password
        );

        if (res.error) {
          setBackendError(res.error);
          setIsLoading(false);
          return { success: false, error: res.error };
        }

        // Registrar en directorio local como pendiente de verificación (NO iniciar sesión automáticamente)
        const pendingUser: User = {
          ...(res.user || userWithUsername),
          id: res.userId || userWithUsername.id,
          username: usernameVal.cleanUsername,
          email: cleanEmail,
          isEmailVerified: false,
        };

        setAllRegisteredUsers((prev) => {
          const exists = prev.some((u) => u.id === pendingUser.id || u.email.toLowerCase() === cleanEmail);
          return exists ? prev.map((u) => (u.email.toLowerCase() === cleanEmail ? pendingUser : u)) : [pendingUser, ...prev];
        });

        setUnverifiedEmail(cleanEmail);

        return {
          success: true,
          requiresEmailConfirmation: true,
          email: cleanEmail,
          username: usernameVal.cleanUsername,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error durante el registro';
        setBackendError(msg);
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [dataProvider, checkUsernameAvailability, checkEmailAvailability]
  );

  const logout = useCallback(async () => {
    await dataProvider.signOut();
    await secureStorage.clearUserSession();
    setCurrentUser(null);
    setGroups([]);
    setExpenses([]);
    setSettlements([]);
    setActiveGroupId('');
  }, [dataProvider]);

  const deleteAccount = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'No hay usuario autenticado.' };
    setIsLoading(true);
    setBackendError(null);
    try {
      const targetUserId = currentUser.id;
      const targetEmail = currentUser.email.toLowerCase();

      // 1. Invocar borrado completo en Supabase (RPC delete_user_account)
      const result = await dataProvider.deleteAccount(targetUserId);
      if (!result.success) {
        setIsLoading(false);
        const errMsg = result.error || 'Error al eliminar la cuenta en Supabase.';
        setBackendError(errMsg);
        return { success: false, error: errMsg };
      }

      // 2. Limpiar almacenamiento seguro (tokens, sesión, biometría nativa)
      await secureStorage.clearAllUserData();

      // 3. Limpiar estado en memoria de React y directorio de usuarios
      setCurrentUser(null);
      setGroups([]);
      setExpenses([]);
      setSettlements([]);
      setRequests([]);
      setActiveGroupId('');
      setAllRegisteredUsers((prev) =>
        prev.filter((u) => u.id !== targetUserId && u.email.toLowerCase() !== targetEmail)
      );

      setIsLoading(false);
      return { success: true };
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Error al eliminar la cuenta.';
      setBackendError(msg);
      return { success: false, error: msg };
    }
  }, [currentUser, dataProvider]);

  const updateUser = useCallback(
    async (updatedUser: User) => {
      setBackendError(null);
      let cleanUser = { ...updatedUser };

      // Si ha modificado su nombre de usuario, validar formato y unicidad estricta
      if (updatedUser.username) {
        const val = validateUsername(updatedUser.username);
        if (!val.isValid) {
          setBackendError(val.error || 'Nombre de usuario inválido.');
          throw new Error(val.error || 'Nombre de usuario inválido.');
        }

        const isAvailable = await checkUsernameAvailability(val.cleanUsername, updatedUser.id);
        if (!isAvailable.available) {
          setBackendError(isAvailable.error || 'El nombre de usuario ya está ocupado.');
          throw new Error(isAvailable.error || 'El nombre de usuario ya está ocupado.');
        }

        cleanUser.username = val.cleanUsername;
      }

      setCurrentUser(cleanUser);
      setAllRegisteredUsers((prev) =>
        prev.map((u) => (u.id === cleanUser.id ? { ...u, ...cleanUser } : u))
      );
      setGroups((prevGroups) =>
        prevGroups.map((g) => ({
          ...g,
          members: g.members.map((m) => (m.id === cleanUser.id ? { ...m, ...cleanUser } : m)),
        }))
      );
      const saved = await dataProvider.updateProfile(cleanUser);
      setCurrentUser(saved);
    },
    [dataProvider, checkUsernameAvailability]
  );

  const resendVerification = useCallback(
    async (emailOrUsername: string): Promise<{ success: boolean; email?: string; error?: string }> => {
      return await dataProvider.resendVerification(emailOrUsername);
    },
    [dataProvider]
  );

  const verifyEmailToken = useCallback(
    async (email: string, token: string) => {
      const res = await dataProvider.verifyEmailToken(email, token);
      if (res.success && res.email) {
        const verifiedEmail = res.email.toLowerCase();
        setAllRegisteredUsers((prev) =>
          prev.map((u) =>
            u.email && u.email.toLowerCase() === verifiedEmail
              ? { ...u, isEmailVerified: true }
              : u
          )
        );
        setUnverifiedEmail(null);
        setBackendError(null);
      }
      return res;
    },
    [dataProvider]
  );

  // ============================================================================
  // ACCIONES DE GASTOS Y GRUPOS
  // ============================================================================
  const addExpense = useCallback(
    async (newExpense: Expense) => {
      const created = await dataProvider.createExpense(newExpense);
      setExpenses((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);

      const targetGroup = groups.find((g) => g.id === newExpense.groupId);
      
      // Notificación in-app para el usuario que registró el gasto
      notificationService.dispatchNotification({
        userId: currentUser?.id,
        type: 'EXPENSE_ADDED',
        title: 'Nuevo gasto registrado',
        message: `${newExpense.description} por ${newExpense.amount} ${targetGroup?.currency || 'EUR'}`,
        groupId: newExpense.groupId,
        groupName: targetGroup?.name,
        targetId: created.id,
      });

      // Notificación in-app para todos los demás miembros del grupo
      if (targetGroup && targetGroup.members) {
        targetGroup.members.forEach((m) => {
          if (m.id !== currentUser?.id) {
            notificationService.dispatchNotification({
              userId: m.id,
              type: 'EXPENSE_ADDED',
              title: `Nuevo gasto en ${targetGroup.name}`,
              message: `${currentUser?.name || 'Un miembro'} ha registrado "${newExpense.description}" (${newExpense.amount} ${targetGroup.currency || 'EUR'})`,
              groupId: newExpense.groupId,
              groupName: targetGroup.name,
              targetId: created.id,
            });
          }
        });
      }

      // Despachar notificación por correo electrónico a los miembros participantes (Resend / Edge Function)
      if (currentUser) {
        const groupMembers = targetGroup?.members || allRegisteredUsers;
        notifyExpenseAdded({
          expense: created,
          payer: currentUser,
          group: targetGroup,
          allMembers: groupMembers,
        }).catch((err) => console.warn('Error al notificar nuevo gasto por email:', err));
      }
    },
    [dataProvider, groups, currentUser, allRegisteredUsers]
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      await dataProvider.deleteExpense(expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    },
    [dataProvider]
  );

  // Conteo de solicitudes recibidas pendientes y sin leer para el usuario actual ("Nueva")
  const unreadRequestsCount = useMemo(() => {
    if (!currentUser) return 0;
    return requests.filter(
      (r) =>
        r.status === 'PENDING' &&
        !r.isRead &&
        (r.recipientUserId === currentUser.id ||
          r.recipientEmail.toLowerCase() === currentUser.email.toLowerCase() ||
          (currentUser.username && r.recipientUsername?.toLowerCase() === currentUser.username.toLowerCase()))
    ).length;
  }, [currentUser, requests]);

  // Enviar solicitud de invitación buscando estrictamente por @usuario o correo
  const sendGroupInvitation = useCallback(
    (data: { groupId: string; recipientQuery: string; preResolvedGroup?: Group }) => {
      if (!currentUser) return { success: false, error: 'No user logged in' };

      const targetGroup = data.preResolvedGroup || groups.find((g) => g.id === data.groupId);
      if (!targetGroup) return { success: false, error: 'Grupo no encontrado' };

      const cleanQuery = data.recipientQuery.trim().toLowerCase().replace('@', '');

      // Buscar usuario coincidente en el directorio registrado
      const foundUser = allRegisteredUsers.find(
        (u) =>
          u.email.toLowerCase() === cleanQuery ||
          (u.username && u.username.toLowerCase().replace('@', '') === cleanQuery) ||
          u.name.toLowerCase() === cleanQuery
      );

      const recipientEmail = foundUser
        ? foundUser.email
        : data.recipientQuery.includes('@')
        ? data.recipientQuery.trim()
        : `${cleanQuery}@splitflow.app`;
      const recipientUsername = foundUser?.username || (cleanQuery.includes('@') ? cleanQuery.split('@')[0] : cleanQuery);
      const recipientUserId = foundUser?.id;
      const recipientName = foundUser?.name || recipientUsername;

      // Regla: No invitarse a uno mismo
      if (
        recipientUserId === currentUser.id ||
        recipientEmail.toLowerCase() === currentUser.email.toLowerCase() ||
        (currentUser.username && recipientUsername.toLowerCase().replace('@', '') === currentUser.username.toLowerCase().replace('@', ''))
      ) {
        return { success: false, error: 'No puedes enviarte una solicitud a ti mismo.' };
      }

      // Regla estricta: Verificar si ya es miembro
      const isAlreadyMember = targetGroup.members.some(
        (m) =>
          (recipientUserId && m.id === recipientUserId) ||
          m.email.toLowerCase() === recipientEmail.toLowerCase() ||
          (m.username && recipientUsername && m.username.toLowerCase().replace('@', '') === recipientUsername.toLowerCase().replace('@', ''))
      );
      if (isAlreadyMember) {
        return { success: false, error: 'Este usuario ya es miembro de este grupo.' };
      }

      // Regla: Verificar si ya existe solicitud pendiente
      const existingPending = requests.find(
        (r) =>
          r.groupId === data.groupId &&
          r.status === 'PENDING' &&
          (r.recipientEmail.toLowerCase() === recipientEmail.toLowerCase() ||
            (recipientUsername && r.recipientUsername?.toLowerCase().replace('@', '') === recipientUsername.toLowerCase().replace('@', '')))
      );
      if (existingPending) {
        return { success: false, error: 'Ya existe una solicitud pendiente para este usuario en este grupo.' };
      }

      const newInvitation: GroupInvitation = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'GROUP_INVITE',
        groupId: targetGroup.id,
        groupName: targetGroup.name,
        groupCategory: targetGroup.category,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderEmail: currentUser.email,
        senderUsername: currentUser.username || currentUser.name.toLowerCase().replace(/\s+/g, ''),
        recipientEmail,
        recipientUsername,
        recipientUserId,
        recipientName,
        status: 'PENDING',
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      setRequests((prev) => [newInvitation, ...prev]);

      notificationService.dispatchNotification({
        userId: currentUser.id,
        type: 'GROUP_INVITE',
        title: 'Invitacion enviada',
        message: `Has invitado a @${recipientUsername} a unirse a "${targetGroup.name}"`,
        groupId: targetGroup.id,
        groupName: targetGroup.name,
        targetId: newInvitation.id,
      });

      // Notificación in-app para el usuario destinatario si está registrado en el sistema
      if (recipientUserId) {
        notificationService.dispatchNotification({
          userId: recipientUserId,
          type: 'GROUP_INVITE',
          title: `Invitación al grupo "${targetGroup.name}"`,
          message: `${currentUser.name} te ha invitado a unirte al grupo "${targetGroup.name}".`,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          targetId: newInvitation.id,
        });
      }

      // Despachar notificación por correo si el destinatario tiene un correo válido
      if (recipientEmail && recipientEmail.includes('@') && !recipientEmail.endsWith('@splitflow.app')) {
        notifyGroupInvitation({
          sender: currentUser,
          recipientEmail,
          recipientName,
          groupName: targetGroup.name,
          inviteCode: targetGroup.inviteCode,
        }).catch((err) => console.warn('Error al despachar email de invitación:', err));
      }

      return { success: true };
    },
    [currentUser, groups, allRegisteredUsers, requests]
  );

  // Aceptar solicitud: Agrega inmediatamente al usuario al grupo
  const acceptGroupInvitation = useCallback(
    async (request: GroupInvitation) => {
      if (!currentUser) return false;

      // 1. Marcar solicitud como aceptada
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? { ...r, status: 'ACCEPTED', isRead: true, respondedAt: new Date().toISOString() }
            : r
        )
      );

      // 2. Si corresponde a un grupo, incorporar al usuario a dicho grupo
      if (request.groupId) {
        let groupExisted = false;
        setGroups((prevGroups) => {
          const updated = prevGroups.map((group) => {
            if (group.id === request.groupId) {
              groupExisted = true;
              const alreadyIn = group.members.some((m) => m.id === currentUser.id);
              if (!alreadyIn) {
                return {
                  ...group,
                  members: [...group.members, currentUser],
                };
              }
            }
            return group;
          });

          if (!groupExisted) {
            // Reconstruir e incorporar el grupo invitado al estado del usuario
            const newMemberGroup: Group = {
              id: request.groupId!,
              name: request.groupName || 'Grupo Compartido',
              description: 'Grupo aceptado mediante solicitud',
              category: request.groupCategory || 'HOME',
              avatar: request.groupCategory || 'HOME',
              currency: 'EUR',
              members: [
                {
                  id: request.senderId,
                  name: request.senderName,
                  email: request.senderEmail,
                  username: request.senderUsername,
                  role: 'admin',
                },
                currentUser,
              ],
              createdAt: request.createdAt,
            };
            return [newMemberGroup, ...updated];
          }

          return updated;
        });

        // Persistir la membresía en la capa de datos
        await dataProvider.addMemberToGroup(request.groupId, currentUser);

        // Notificación interna para el remitente informándole de la aceptación
        if (request.senderId) {
          notificationService.dispatchNotification({
            userId: request.senderId,
            type: 'GROUP_INVITE',
            title: 'Invitación Aceptada',
            message: `${currentUser.name} ha aceptado tu invitación y se ha unido a "${request.groupName || 'tu grupo'}".`,
            groupId: request.groupId,
            groupName: request.groupName,
          });
        }

        // Activar el grupo para el usuario
        setActiveGroupId(request.groupId);
      }

      return true;
    },
    [currentUser, dataProvider]
  );

  // Rechazar solicitud
  const rejectGroupInvitation = useCallback(async (request: GroupInvitation) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === request.id
          ? { ...r, status: 'REJECTED', isRead: true, respondedAt: new Date().toISOString() }
          : r
      )
    );
    return true;
  }, []);

  // Cancelar solicitud enviada
  const cancelGroupInvitation = useCallback((requestId: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'CANCELLED' }
          : r
      )
    );
  }, []);

  // Marcar todas como leídas
  const markAllRequestsAsRead = useCallback(() => {
    setRequests((prev) =>
      prev.map((r) => {
        if (
          currentUser &&
          (r.recipientUserId === currentUser.id ||
            r.recipientEmail.toLowerCase() === currentUser.email.toLowerCase() ||
            (currentUser.username && r.recipientUsername?.toLowerCase().replace('@', '') === currentUser.username.toLowerCase().replace('@', '')))
        ) {
          return { ...r, isRead: true };
        }
        return r;
      })
    );
  }, [currentUser]);

  // Búsqueda predictiva pública por @username respetando estricta privacidad
  const searchPublicUsers = useCallback(
    async (query: string, excludeGroupId?: string): Promise<PublicUser[]> => {
      if (!currentUser) return [];
      return dataProvider.searchPublicUsers(query, currentUser.id, excludeGroupId);
    },
    [currentUser, dataProvider]
  );

  // Sugerencias rápidas automáticas basadas en historial de grupos compartidos
  const getContactSuggestions = useCallback(
    async (excludeGroupId?: string): Promise<PublicUser[]> => {
      if (!currentUser) return [];
      return dataProvider.getContactSuggestions(currentUser.id, excludeGroupId);
    },
    [currentUser, dataProvider]
  );

  const createGroup = useCallback(
    async (newGroup: Group, invitedQueries?: string[]) => {
      if (!currentUser) return;
      const inviteCode = newGroup.inviteCode || `SF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const groupWithCode = { ...newGroup, inviteCode };
      const created = await dataProvider.createGroup(groupWithCode, currentUser.id);
      setGroups((prev) => [created, ...prev]);
      setActiveGroupId(created.id);

      // Si se especificaron invitaciones al crear, enviar solicitudes pendientes usando preResolvedGroup
      if (invitedQueries && invitedQueries.length > 0) {
        invitedQueries.forEach((q) => {
          sendGroupInvitation({ groupId: created.id, recipientQuery: q, preResolvedGroup: created });
        });
      }
    },
    [dataProvider, currentUser, sendGroupInvitation]
  );

  const settleDebt = useCallback(
    async (newSettlement: SettlementTransaction) => {
      const settlementWithGroup: SettlementTransaction = {
        ...newSettlement,
        groupId: newSettlement.groupId || activeGroupId,
      };
      const saved = await dataProvider.settleDebt(settlementWithGroup);
      setSettlements((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);

      const targetGroup = groups.find((g) => g.id === settlementWithGroup.groupId);
      
      // Notificación in-app para quien liquida
      notificationService.dispatchNotification({
        userId: currentUser?.id,
        type: 'SETTLEMENT_PAYMENT',
        title: 'Liquidación registrada',
        message: `Has registrado un pago de ${settlementWithGroup.amount} ${settlementWithGroup.currency}`,
        groupId: settlementWithGroup.groupId,
        groupName: targetGroup?.name,
        targetId: saved.id,
      });

      // Notificación in-app directa para el receptor del dinero
      if (saved.toUserId && saved.toUserId !== currentUser?.id) {
        notificationService.dispatchNotification({
          userId: saved.toUserId,
          type: 'SETTLEMENT_PAYMENT',
          title: '¡Te han pagado una deuda!',
          message: `${currentUser?.name || 'Un compañero'} ha registrado un pago de ${settlementWithGroup.amount} ${settlementWithGroup.currency} a tu favor en "${targetGroup?.name || 'tu grupo'}".`,
          groupId: settlementWithGroup.groupId,
          groupName: targetGroup?.name,
          targetId: saved.id,
        });
      }

      // Despachar notificación por correo al receptor de la liquidación (Resend / Edge Function)
      const membersPool = targetGroup?.members || allRegisteredUsers;
      const payerUser = membersPool.find((m) => m.id === saved.fromUserId) || currentUser;
      const receiverUser = membersPool.find((m) => m.id === saved.toUserId);
      if (payerUser && receiverUser) {
        notifySettlementRecorded({
          settlement: saved,
          payer: payerUser,
          receiver: receiverUser,
          groupName: targetGroup?.name,
        }).catch((err) => console.warn('Error al notificar liquidación por email:', err));
      }
    },
    [dataProvider, activeGroupId, groups, currentUser, allRegisteredUsers]
  );

  const resetSettlements = useCallback(
    async (memberIds: string[]) => {
      if (!activeGroupId) return;
      await dataProvider.resetSettlements(activeGroupId, memberIds);
      setSettlements((prev) =>
        prev.filter((s) => (s.groupId ? s.groupId !== activeGroupId : !memberIds.includes(s.fromUserId)))
      );
    },
    [dataProvider, activeGroupId]
  );

  const joinGroupByCode = useCallback(
    async (code: string): Promise<{ success: boolean; group?: Group; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para unirte a un grupo.' };
      const clean = code.trim();
      if (!clean) return { success: false, error: 'Ingresa un código o identificador de grupo.' };

      setIsLoading(true);
      try {
        const joined = await dataProvider.joinGroupByCode(clean, currentUser);
        if (!joined) {
          setIsLoading(false);
          return { success: false, error: 'No se encontró ningún grupo con ese código o identificador.' };
        }

        // Incorporar el grupo a la lista si no existía ya
        setGroups((prev) => {
          const exists = prev.some((g) => g.id === joined.id);
          if (exists) {
            return prev.map((g) => (g.id === joined.id ? joined : g));
          }
          return [joined, ...prev];
        });
        setActiveGroupId(joined.id);

        const [loadedExpenses, loadedSettlements] = await Promise.all([
          dataProvider.getExpenses(joined.id),
          dataProvider.getSettlements(joined.id),
        ]);
        setExpenses(loadedExpenses);
        setSettlements(loadedSettlements);

        setIsLoading(false);
        return { success: true, group: joined };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al unirse al grupo.' };
      }
    },
    [currentUser, dataProvider]
  );

  const transferGroupAdmin = useCallback(
    async (groupId: string, newAdminId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };

      const targetGroup = groups.find((g) => g.id === groupId);
      if (!targetGroup) return { success: false, error: 'Grupo no encontrado.' };

      const candidate = targetGroup.members.find((m) => m.id === newAdminId);
      if (!candidate) return { success: false, error: 'El usuario seleccionado no forma parte del grupo.' };

      setIsLoading(true);
      try {
        const res = await dataProvider.transferGroupAdmin(groupId, newAdminId);
        if (!res.success) {
          setIsLoading(false);
          return { success: false, error: res.error || 'No se pudo transferir el rol de administrador.' };
        }

        // Actualizar el estado local de grupos (el código ahora es exclusivo del nuevo admin)
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              adminId: newAdminId,
              inviteCode: undefined, // Ocultar código al renunciar como admin
              codigoGrupo: undefined,
              members: g.members.map((m) => ({
                ...m,
                role: m.id === newAdminId ? 'admin' : 'member',
              })),
            };
          })
        );

        // Notificación interna in-app para el nuevo administrador
        notificationService.dispatchNotification({
          userId: newAdminId,
          type: 'ADMIN_PROMOTED',
          title: '¡Has sido nombrado Administrador!',
          message: `¡Has sido designado como el nuevo administrador del grupo "${targetGroup.name}"!`,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          targetId: newAdminId,
        });

        // Notificación interna in-app para el administrador que transfiere el cargo
        notificationService.dispatchNotification({
          userId: currentUser.id,
          type: 'ADMIN_PROMOTED',
          title: 'Administración Transferida',
          message: `Has transferido la administración del grupo "${targetGroup.name}" a ${candidate.name}.`,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
        });

        // Notificar por correo mediante Edge Function (SplitflowNoReplay@gmail.com)
        await notifyAdminPromoted({
          newAdmin: candidate,
          groupName: targetGroup.name,
          previousAdminName: currentUser.name || (currentUser.username ? `@${currentUser.username}` : undefined),
          isAutomaticReassignment: false,
        });

        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error inesperado al transferir el rol.' };
      }
    },
    [currentUser, dataProvider, groups]
  );

  const promoteGroupAdmin = useCallback(
    async (groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };

      const targetGroup = groups.find((g) => g.id === groupId);
      if (!targetGroup) return { success: false, error: 'Grupo no encontrado.' };

      const candidate = targetGroup.members.find((m) => m.id === targetUserId);
      if (!candidate) return { success: false, error: 'El usuario no forma parte de este grupo.' };

      // Contar administradores actuales
      const currentAdmins = targetGroup.members.filter((m) => m.id === targetGroup.adminId || m.role === 'admin');
      if (currentAdmins.length >= 4) {
        return { success: false, error: 'Límite alcanzado: Un grupo puede tener un máximo de 4 administradores simultáneos.' };
      }

      setIsLoading(true);
      try {
        const res = await dataProvider.promoteGroupAdmin(groupId, targetUserId);
        if (!res.success) {
          setIsLoading(false);
          return { success: false, error: res.error || 'No se pudo promover a administrador.' };
        }

        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              members: g.members.map((m) => ({
                ...m,
                role: m.id === targetUserId ? 'admin' : m.role,
              })),
            };
          })
        );

        // Notificación in-app al usuario promovido
        notificationService.dispatchNotification({
          userId: targetUserId,
          type: 'ADMIN_PROMOTED',
          title: '¡Has sido nombrado Administrador!',
          message: `¡Has sido nombrado como administrador del grupo "${targetGroup.name}"! Ahora tienes permisos de gestión.`,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          targetId: targetUserId,
        });

        // Correo oficial desde SplitflowNoReplay@gmail.com
        await notifyAdminPromoted({
          newAdmin: candidate,
          groupName: targetGroup.name,
          previousAdminName: currentUser.name || (currentUser.username ? `@${currentUser.username}` : undefined),
          isAutomaticReassignment: false,
        });

        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al promover administrador.' };
      }
    },
    [currentUser, dataProvider, groups]
  );

  const revokeGroupAdmin = useCallback(
    async (groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };

      const targetGroup = groups.find((g) => g.id === groupId);
      if (!targetGroup) return { success: false, error: 'Grupo no encontrado.' };

      const targetMember = targetGroup.members.find((m) => m.id === targetUserId);
      if (!targetMember) return { success: false, error: 'El usuario no forma parte de este grupo.' };

      if (targetUserId === targetGroup.adminId) {
        return { success: false, error: 'No se puede revocar el rol al Administrador Supremo del grupo.' };
      }

      setIsLoading(true);
      try {
        const res = await dataProvider.revokeGroupAdmin(groupId, targetUserId);
        if (!res.success) {
          setIsLoading(false);
          return { success: false, error: res.error || 'No se pudo revocar el rol de administrador.' };
        }

        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              members: g.members.map((m) => ({
                ...m,
                role: m.id === targetUserId ? 'member' : m.role,
              })),
            };
          })
        );

        notificationService.dispatchNotification({
          userId: targetUserId,
          type: 'ADMIN_PROMOTED',
          title: 'Rol de administrador revocado',
          message: `Tu rol de administrador en el grupo "${targetGroup.name}" ha sido revocado.`,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          targetId: targetUserId,
        });

        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al revocar administrador.' };
      }
    },
    [currentUser, dataProvider, groups]
  );

  const transferSupremeAdmin = useCallback(
    async (groupId: string, newSupremeAdminId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };

      const targetGroup = groups.find((g) => g.id === groupId);
      if (!targetGroup) return { success: false, error: 'Grupo no encontrado.' };

      const candidate = targetGroup.members.find((m) => m.id === newSupremeAdminId);
      if (!candidate) return { success: false, error: 'El usuario no forma parte de este grupo.' };

      setIsLoading(true);
      try {
        const res = await dataProvider.transferSupremeAdmin(groupId, newSupremeAdminId);
        if (!res.success) {
          setIsLoading(false);
          return { success: false, error: res.error || 'No se pudo transferir el cargo supremo.' };
        }

        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              adminId: newSupremeAdminId,
              members: g.members.map((m) => ({
                ...m,
                role: m.id === newSupremeAdminId ? 'admin' : m.role,
              })),
            };
          })
        );

        notificationService.dispatchNotification({
          userId: newSupremeAdminId,
          type: 'ADMIN_PROMOTED',
          title: '¡Nuevo Administrador Supremo!',
          message: `¡Has sido nombrado Administrador Supremo del grupo "${targetGroup.name}"! Tienes potestad total para gestionar administradores.`,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          targetId: newSupremeAdminId,
        });

        await notifyAdminPromoted({
          newAdmin: candidate,
          groupName: targetGroup.name,
          previousAdminName: currentUser.name || (currentUser.username ? `@${currentUser.username}` : undefined),
          isAutomaticReassignment: false,
        });

        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al transferir administración suprema.' };
      }
    },
    [currentUser, dataProvider, groups]
  );

  const removeGroupMember = useCallback(
    async (groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };

      const targetGroup = groups.find((g) => g.id === groupId);
      if (!targetGroup) return { success: false, error: 'Grupo no encontrado.' };

      const targetMember = targetGroup.members.find((m) => m.id === targetUserId);
      if (!targetMember) return { success: false, error: 'El usuario no forma parte de este grupo.' };

      if (targetUserId === currentUser.id) {
        return { success: false, error: 'No puedes eliminarte a ti mismo con esta opción. Utiliza "Salir del grupo".' };
      }

      if (targetUserId === targetGroup.adminId) {
        return { success: false, error: 'No se puede eliminar al Administrador Supremo del grupo.' };
      }

      setIsLoading(true);
      try {
        const res = await dataProvider.removeGroupMember(groupId, targetUserId);
        if (!res.success) {
          setIsLoading(false);
          return { success: false, error: res.error || 'No se pudo eliminar al usuario del grupo.' };
        }

        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              members: g.members.filter((m) => m.id !== targetUserId),
            };
          })
        );

        notificationService.dispatchNotification({
          userId: targetUserId,
          type: 'BUDGET_ALERT',
          title: 'Eliminado del grupo',
          message: `Has sido eliminado del grupo "${targetGroup.name}" por un administrador.`,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          targetId: targetUserId,
        });

        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al eliminar miembro.' };
      }
    },
    [currentUser, dataProvider, groups]
  );

  const leaveGroup = useCallback(
    async (groupId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };
      
      const targetGroup = groups.find((g) => g.id === groupId);
      const wasAdmin = targetGroup && (targetGroup.adminId === currentUser.id || targetGroup.created_by === currentUser.id);
      const remainingCandidates = targetGroup ? targetGroup.members.filter((m) => m.id !== currentUser.id) : [];

      setIsLoading(true);
      try {
        const res = await dataProvider.leaveGroup(groupId, currentUser.id);
        if (!res.success) {
          setIsLoading(false);
          return { success: false, error: res.error || 'Error al salir del grupo.' };
        }

        // Si el usuario era el administrador y quedan miembros en el grupo:
        if (wasAdmin && targetGroup && remainingCandidates.length > 0) {
          // El trigger en Supabase reasigna automáticamente a un miembro aleatorio
          let newAdmin = res.reassignedAdminId 
            ? remainingCandidates.find((m) => m.id === res.reassignedAdminId)
            : undefined;

          if (!newAdmin && remainingCandidates.length > 0) {
            newAdmin = remainingCandidates[0];
          }

          if (newAdmin) {
            // Notificación interna in-app para el nuevo administrador reasignado
            notificationService.dispatchNotification({
              userId: newAdmin.id,
              type: 'ADMIN_PROMOTED',
              title: '¡Has sido nombrado Administrador!',
              message: `¡Has sido designado como el nuevo administrador del grupo "${targetGroup.name}" tras la salida del administrador previo!`,
              groupId: targetGroup.id,
              groupName: targetGroup.name,
              targetId: newAdmin.id,
            });

            // Disparar llamada a la Edge Function "send-notification-email" por reasignación automática
            await notifyAdminPromoted({
              newAdmin,
              groupName: targetGroup.name,
              isAutomaticReassignment: true,
            });
          }
        }

        const remaining = groups.filter((g) => g.id !== groupId);
        setGroups(remaining);

        if (activeGroupId === groupId) {
          if (remaining.length > 0) {
            const nextGroupId = remaining[0].id;
            setActiveGroupId(nextGroupId);
            const [loadedExpenses, loadedSettlements] = await Promise.all([
              dataProvider.getExpenses(nextGroupId),
              dataProvider.getSettlements(nextGroupId),
            ]);
            setExpenses(loadedExpenses);
            setSettlements(loadedSettlements);
          } else {
            setActiveGroupId('');
            setExpenses([]);
            setSettlements([]);
          }
        }

        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al salir del grupo.' };
      }
    },
    [currentUser, dataProvider, groups, activeGroupId]
  );

  const deleteGroup = useCallback(
    async (groupId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };
      setIsLoading(true);
      try {
        await dataProvider.deleteGroup(groupId);

        const remaining = groups.filter((g) => g.id !== groupId);
        setGroups(remaining);

        if (activeGroupId === groupId) {
          if (remaining.length > 0) {
            const nextGroupId = remaining[0].id;
            setActiveGroupId(nextGroupId);
            const [loadedExpenses, loadedSettlements] = await Promise.all([
              dataProvider.getExpenses(nextGroupId),
              dataProvider.getSettlements(nextGroupId),
            ]);
            setExpenses(loadedExpenses);
            setSettlements(loadedSettlements);
          } else {
            setActiveGroupId('');
            setExpenses([]);
            setSettlements([]);
          }
        }

        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al eliminar el grupo.' };
      }
    },
    [currentUser, dataProvider, groups, activeGroupId]
  );

  const updateGroup = useCallback(
    async (updatedGroup: Group): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Debes iniciar sesión para realizar esta acción.' };
      setIsLoading(true);
      try {
        const saved = await dataProvider.updateGroup(updatedGroup);
        setGroups((prev) => prev.map((g) => (g.id === saved.id ? saved : g)));
        setIsLoading(false);
        return { success: true };
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Error al actualizar el grupo.' };
      }
    },
    [currentUser, dataProvider]
  );

  const requestPasswordReset = useCallback(
    async (email: string, redirectTo?: string) => {
      return dataProvider.requestPasswordReset(email, redirectTo);
    },
    [dataProvider]
  );

  const verifyPasswordResetOtp = useCallback(
    async (email: string, token: string) => {
      const res = await dataProvider.verifyPasswordResetOtp(email, token);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        await secureStorage.saveUserSession(res.user);
        await loadDataForUser(res.user, dataProvider);
      }
      return res;
    },
    [dataProvider, loadDataForUser]
  );

  const updateUserPassword = useCallback(
    async (newPassword: string) => {
      return dataProvider.updateUserPassword(newPassword);
    },
    [dataProvider]
  );

  const confirmPasswordReset = useCallback(
    async (email: string, token: string, newPassword: string) => {
      const res = await dataProvider.confirmPasswordReset(email, token, newPassword);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        await secureStorage.saveUserSession(res.user);
        await loadDataForUser(res.user, dataProvider);
      }
      return res;
    },
    [dataProvider, loadDataForUser]
  );

  const clearAllData = useCallback(async () => {
    setIsLoading(true);
    await dataProvider.clearAllSystemData();
    setCurrentUser(null);
    setGroups([]);
    setActiveGroupId('');
    setExpenses([]);
    setSettlements([]);
    setRequests([]);
    setAllRegisteredUsers([]);
    setIsLoading(false);
  }, [dataProvider]);

  return {
    users: groups.find((g) => g.id === activeGroupId)?.members || (currentUser ? [currentUser] : []),
    allUsers: allRegisteredUsers,
    currentUser,
    groups,
    activeGroupId,
    setActiveGroupId,
    expenses,
    settlements,
    requests,
    unreadRequestsCount,
    isLoading,
    backendError,
    setBackendError,
    unverifiedEmail,
    setUnverifiedEmail,
    backendStatus: {
      isLive: isSupabaseConfigured,
      provider: 'Supabase PostgreSQL' as const,
      url: backendStatus.url,
    },
    // Métodos
    login,
    register,
    resendVerification,
    verifyEmailToken,
    logout,
    deleteAccount,
    updateUser,
    checkUsernameAvailability,
    addExpense,
    deleteExpense,
    createGroup,
    joinGroupByCode,
    transferGroupAdmin,
    promoteGroupAdmin,
    revokeGroupAdmin,
    transferSupremeAdmin,
    removeGroupMember,
    leaveGroup,
    deleteGroup,
    updateGroup,
    settleDebt,
    resetSettlements,
    // Métodos de Solicitudes y Búsqueda Inteligente
    sendGroupInvitation,
    acceptGroupInvitation,
    rejectGroupInvitation,
    cancelGroupInvitation,
    markAllRequestsAsRead,
    searchPublicUsers,
    getContactSuggestions,
    // Recuperacion de contrasena mediante codigo OTP
    requestPasswordReset,
    verifyPasswordResetOtp,
    updateUserPassword,
    confirmPasswordReset,
    // Validacion de unicidad y limpieza de datos
    checkEmailAvailability,
    clearAllData,
  };
}
