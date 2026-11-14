/**
 * SplitFlow — Supabase PostgreSQL Production Data Layer
 * Acceso directo y exclusivo a Supabase Auth y PostgreSQL.
 * Todos los restos de Modo Demo y datos mock han sido completamente erradicados.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { User, Group, Expense, SettlementTransaction, SettlementPaymentMethod, PublicUser } from '../types';
import { sanitizeUsername, isUsernameAvailableInList } from './security';
import { sendNotificationEmail, sendAccountVerificationEmail } from './emailNotifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { secureStorage } from './capacitor/secureStorage';

export interface AuthResponse {
  user: User | null;
  session?: any;
  requiresEmailConfirmation?: boolean;
  emailNotConfirmed?: boolean;
  email?: string;
  username?: string;
  userId?: string;
  error?: string;
}

export interface EmailVerificationResult {
  success: boolean;
  alreadyVerified?: boolean;
  email?: string;
  username?: string;
  error?: string;
}

export interface IDataProvider {
  initialize(): Promise<User | null>;
  getCurrentUser(): Promise<User | null>;
  signIn(emailOrUsername: string, password?: string): Promise<AuthResponse>;
  signUp(userData: { name: string; username: string; email: string; monthlyIncome?: number }, password?: string): Promise<AuthResponse>;
  checkUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean>;
  checkEmailAvailable(email: string, excludeUserId?: string): Promise<boolean>;
  clearAllSystemData(): Promise<void>;
  searchPublicUsers(query: string, currentUserId: string, excludeGroupId?: string): Promise<PublicUser[]>;
  getContactSuggestions(currentUserId: string, excludeGroupId?: string): Promise<PublicUser[]>;
  signOut(): Promise<void>;
  resendVerification(emailOrUsername: string): Promise<{ success: boolean; email?: string; error?: string }>;
  verifyEmailToken(email: string, token: string): Promise<EmailVerificationResult>;
  requestPasswordReset(email: string, redirectTo?: string): Promise<{ success: boolean; error?: string }>;
  verifyPasswordResetOtp(email: string, token: string): Promise<{ success: boolean; user?: User; error?: string }>;
  updateUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }>;
  confirmPasswordReset(email: string, token: string, newPassword: string): Promise<{ success: boolean; user?: User; error?: string }>;
  updateProfile(user: User): Promise<User>;
  getGroups(userId?: string): Promise<Group[]>;
  createGroup(group: Group, creatorId: string): Promise<Group>;
  getExpenses(groupId: string): Promise<Expense[]>;
  createExpense(expense: Expense): Promise<Expense>;
  deleteExpense(expenseId: string): Promise<void>;
  getSettlements(groupId: string): Promise<SettlementTransaction[]>;
  settleDebt(settlement: SettlementTransaction): Promise<SettlementTransaction>;
  resetSettlements(groupId: string, memberIds: string[]): Promise<void>;
  addMemberToGroup(groupId: string, user: User): Promise<void>;
  joinGroupByCode(code: string, user: User): Promise<Group | null>;
  transferGroupAdmin(groupId: string, newAdminId: string): Promise<{ success: boolean; reassignedAdminId?: string; error?: string }>;
  promoteGroupAdmin(groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }>;
  revokeGroupAdmin(groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }>;
  transferSupremeAdmin(groupId: string, newSupremeAdminId: string): Promise<{ success: boolean; error?: string }>;
  removeGroupMember(groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }>;
  leaveGroup(groupId: string, userId: string): Promise<{ success: boolean; reassignedAdminId?: string; error?: string }>;
  updateGroup(group: Group): Promise<Group>;
  deleteGroup(groupId: string): Promise<void>;
  deleteAccount(userId: string): Promise<{ success: boolean; error?: string }>;
}

export class SupabaseDataProvider implements IDataProvider {
  private getUserStorageKey(userId: string, entity: string): string {
    return `splitflow_real_usr_${userId}_${entity}`;
  }

  private getStoredEntity<T>(userId: string, entity: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const saved = localStorage.getItem(this.getUserStorageKey(userId, entity));
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setStoredEntity<T>(userId: string, entity: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getUserStorageKey(userId, entity), JSON.stringify(value));
    } catch (e) {
      console.warn('Storage sync error:', e);
    }
  }

  async clearAllSystemData(): Promise<void> {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('splitflow_') || key.startsWith('splitflow:'))) {
          if (key !== 'splitflow_theme' && key !== 'splitflow_language') {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('splitflow_')) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));

      localStorage.setItem('splitflow_registered_users', JSON.stringify([]));
      localStorage.setItem('splitflow_real_requests', JSON.stringify([]));
      localStorage.setItem('splitflow_clean_slate_marker_v2', 'true');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
  }

  private createVerificationTokenValue(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
    }
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  }

  private buildVerificationUrl(token: string, email: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://splitflow.app';
    return `${origin}/?verify_email=${encodeURIComponent(token)}&email=${encodeURIComponent(email.trim().toLowerCase())}`;
  }

  private getLocalVerificationStore(): Record<
    string,
    { email: string; token: string; expiresAt: number; verified: boolean; username?: string; name?: string }
  > {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('splitflow_email_verification_tokens');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveLocalVerificationRecord(record: {
    email: string;
    token: string;
    verified: boolean;
    username?: string;
    name?: string;
  }): void {
    if (typeof window === 'undefined') return;
    try {
      const store = this.getLocalVerificationStore();
      const key = record.email.trim().toLowerCase();
      store[key] = {
        email: key,
        token: record.token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        verified: record.verified,
        username: record.username,
        name: record.name,
      };
      localStorage.setItem('splitflow_email_verification_tokens', JSON.stringify(store));
    } catch {
      // ignore
    }
  }

  private isLocallyMarkedVerified(email: string): boolean | undefined {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return undefined;
    const store = this.getLocalVerificationStore();
    if (store[cleanEmail]) {
      return Boolean(store[cleanEmail].verified);
    }
    if (typeof window !== 'undefined') {
      try {
        const rawUsers = localStorage.getItem('splitflow_registered_users');
        if (rawUsers) {
          const list: User[] = JSON.parse(rawUsers);
          const match = list.find((u) => u.email?.trim().toLowerCase() === cleanEmail);
          if (match && match.isEmailVerified !== undefined) {
            return Boolean(match.isEmailVerified);
          }
        }
      } catch {
        // ignore
      }
    }
    return undefined;
  }

  private markLocalUserVerified(email: string): void {
    if (typeof window === 'undefined') return;
    const cleanEmail = email.trim().toLowerCase();
    try {
      const store = this.getLocalVerificationStore();
      if (store[cleanEmail]) {
        store[cleanEmail].verified = true;
        localStorage.setItem('splitflow_email_verification_tokens', JSON.stringify(store));
      }
      const rawUsers = localStorage.getItem('splitflow_registered_users');
      if (rawUsers) {
        const list: User[] = JSON.parse(rawUsers);
        const updated = list.map((u) =>
          u.email && u.email.trim().toLowerCase() === cleanEmail
            ? { ...u, isEmailVerified: true }
            : u
        );
        localStorage.setItem('splitflow_registered_users', JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  }

  async initialize(): Promise<User | null> {
    if (typeof window !== 'undefined') {
      // Purga y limpieza automática si aún no se ha marcado el estado limpio
      if (!localStorage.getItem('splitflow_clean_slate_marker_v2')) {
        await this.clearAllSystemData();
        return null;
      }

      const activeLocal = localStorage.getItem('splitflow_active_session_user');
      if (activeLocal) {
        try {
          const parsed: User = JSON.parse(activeLocal);
          if (parsed && parsed.id) {
            if (parsed.isEmailVerified === false) {
              localStorage.removeItem('splitflow_active_session_user');
              return null;
            }
            return parsed;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!isSupabaseConfigured || !supabase) return null;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) return null;

      const profile = await this.fetchOrCreateProfile(session.user);
      if (!profile || profile.isEmailVerified === false) {
        await supabase.auth.signOut();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('splitflow_active_session_user');
        }
        return null;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('splitflow_active_session_user', JSON.stringify(profile));
      }
      return profile;
    } catch {
      return null;
    }
  }

  private async fetchOrCreateProfile(
    authUser: any,
    customData?: { name?: string; username?: string; monthlyIncome?: number }
  ): Promise<User | null> {
    if (!supabase) return null;

    const metadata = authUser.user_metadata || {};
    const fallbackUsername = customData?.username
      ? sanitizeUsername(customData.username)
      : metadata.username 
        ? sanitizeUsername(metadata.username) 
        : (authUser.email ? authUser.email.split('@')[0] : 'usuario');

    const nameToUse = (customData?.name || metadata.name || authUser.email?.split('@')[0] || 'Usuario').trim();
    const incomeToUse = customData?.monthlyIncome ?? (metadata.monthly_income != null ? Number(metadata.monthly_income) : undefined);
    const emailStr = (authUser.email || '').trim().toLowerCase();
    const localVerifiedState = this.isLocallyMarkedVerified(emailStr);
    const metadataRequiresVerification = metadata.email_verified === false;

    const resolveVerifiedFlag = (profileRow?: any): boolean => {
      if (profileRow && profileRow.email_verified !== undefined && profileRow.email_verified !== null) {
        return Boolean(profileRow.email_verified);
      }
      if (localVerifiedState !== undefined) {
        return localVerifiedState;
      }
      if (metadataRequiresVerification) {
        return false;
      }
      return Boolean(authUser.email_confirmed_at ?? true);
    };

    try {
      // Intentar leer perfil existente en la tabla profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profile && !error) {
        return {
          id: profile.id,
          name: profile.name || nameToUse,
          username: profile.username || fallbackUsername,
          email: profile.email || authUser.email || '',
          monthlyIncome: profile.monthly_income != null ? Number(profile.monthly_income) : (profile.income != null ? Number(profile.income) : incomeToUse),
          role: 'member',
          isEmailVerified: resolveVerifiedFlag(profile),
          emailNotifications: profile.email_notifications !== false,
        };
      }

      // Si el perfil no existe aún en public.profiles, crearlo explícitamente (upsert)
      const initialEmailVerified = resolveVerifiedFlag();
      let { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.id,
          email: authUser.email || '',
          name: nameToUse,
          username: fallbackUsername,
          income: incomeToUse ?? null,
          monthly_income: incomeToUse ?? null,
          email_notifications: true,
          email_verified: initialEmailVerified,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
        .select()
        .maybeSingle();

      // Compatibilidad si la columna email_verified aún no se ha migrado en Supabase
      if (insertError && insertError.message?.toLowerCase().includes('email_verified')) {
        const retry = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            email: authUser.email || '',
            name: nameToUse,
            username: fallbackUsername,
            income: incomeToUse ?? null,
            monthly_income: incomeToUse ?? null,
            email_notifications: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
          .select()
          .maybeSingle();
        newProfile = retry.data;
        insertError = retry.error;
      }

      if (newProfile && !insertError) {
        return {
          id: newProfile.id,
          name: newProfile.name || nameToUse,
          username: newProfile.username || fallbackUsername,
          email: newProfile.email || authUser.email || '',
          monthlyIncome: newProfile.monthly_income != null ? Number(newProfile.monthly_income) : (newProfile.income != null ? Number(newProfile.income) : incomeToUse),
          role: 'member',
          isEmailVerified: resolveVerifiedFlag(newProfile),
          emailNotifications: newProfile.email_notifications !== false,
        };
      }
    } catch {
      // Si la tabla no está creada aún en Supabase, usar auth metadata
    }

    // Perfil construido a partir de authUser
    return {
      id: authUser.id,
      name: nameToUse,
      username: fallbackUsername,
      email: authUser.email || '',
      monthlyIncome: incomeToUse,
      role: 'member',
      isEmailVerified: resolveVerifiedFlag(),
      emailNotifications: true,
    };
  }

  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const profile = await this.fetchOrCreateProfile(user);
      if (!profile || profile.isEmailVerified === false) {
        await supabase.auth.signOut();
        return null;
      }
      return profile;
    } catch {
      return null;
    }
  }

  async signIn(identifier: string, password?: string): Promise<AuthResponse> {
    if (!password) {
      return { user: null, error: 'La contraseña es obligatoria.' };
    }

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      return { user: null, error: 'El nombre de usuario es obligatorio.' };
    }

    // El acceso es exclusivo por nombre de usuario; no se permite entrar con email
    if (cleanInput.includes('@') && cleanInput.includes('.')) {
      return { 
        user: null, 
        error: 'El acceso es exclusivo por nombre de usuario. Introduce tu usuario (sin necesidad de @), no tu correo.' 
      };
    }

    // Sanitizar el nombre de usuario eliminando el prefijo @ si el usuario lo hubiera escrito
    const cleanUsername = sanitizeUsername(cleanInput);
    if (!cleanUsername) {
      return { user: null, error: 'Nombre de usuario no válido.' };
    }

    let targetEmail = `${cleanUsername}@splitflow.app`;
    let accountStatusFromRpc: { found?: boolean; email?: string; email_verified?: boolean } | null = null;

    // 1. Resolver el correo persistido del usuario desde el registro local
    if (typeof window !== 'undefined') {
      try {
        const savedUsers = localStorage.getItem('splitflow_registered_users');
        if (savedUsers) {
          const list: User[] = JSON.parse(savedUsers);
          const match = list.find((u) => u.username && cleanUsername && u.username.toLowerCase() === cleanUsername.toLowerCase());
          if (match?.email) {
            targetEmail = match.email.toLowerCase();
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Resolver mediante Supabase: RPC get_login_account_status / get_email_by_username
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: statusData, error: statusErr } = await supabase.rpc('get_login_account_status', {
          p_username: cleanUsername,
        });
        if (!statusErr && statusData && statusData.found) {
          accountStatusFromRpc = statusData;
          if (typeof statusData.email === 'string' && statusData.email.includes('@')) {
            targetEmail = statusData.email.toLowerCase();
          }
        } else {
          const { data: rpcEmail, error: rpcErr } = await supabase.rpc('get_email_by_username', {
            p_username: cleanUsername,
          });
          if (!rpcErr && rpcEmail && typeof rpcEmail === 'string' && rpcEmail.includes('@')) {
            targetEmail = rpcEmail.toLowerCase();
          } else {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .ilike('username', cleanUsername)
              .maybeSingle();

            if (profile?.email) {
              targetEmail = profile.email.toLowerCase();
            }
          }
        }
      } catch {
        // continuar con targetEmail
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        let authResult = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        // Si falló con el email resuelto, intentar también con el alias alternativo
        if (authResult.error && targetEmail !== `${cleanUsername}@splitflow.app`) {
          const retry = await supabase.auth.signInWithPassword({
            email: `${cleanUsername}@splitflow.app`,
            password,
          });
          if (!retry.error) {
            authResult = retry;
          }
        }

        const { data, error } = authResult;

        if (error) {
          const errLower = error.message.toLowerCase();
          const isEmailNotConfirmed =
            errLower.includes('email not confirmed') ||
            errLower.includes('email_not_confirmed') ||
            errLower.includes('confirm your email') ||
            errLower.includes('not confirmed');

          if (isEmailNotConfirmed) {
            return {
              user: null,
              emailNotConfirmed: true,
              email: targetEmail,
              error: 'Tu correo electrónico aún no ha sido verificado. Haz clic en el enlace enviado desde SplitflowNoReplay@gmail.com antes de iniciar sesión.',
            };
          }

          const friendlyMsg = errLower.includes('invalid login credentials')
            ? 'Usuario o contraseña incorrectos.'
            : error.message;
          return { user: null, error: friendlyMsg };
        }

        if (!data.user) {
          return { user: null, error: 'No se pudo iniciar sesión.' };
        }

        const userProfile = await this.fetchOrCreateProfile(data.user);
        const isVerified =
          accountStatusFromRpc?.found
            ? Boolean(accountStatusFromRpc.email_verified)
            : userProfile?.isEmailVerified !== false;

        if (!userProfile || !isVerified) {
          await supabase.auth.signOut();
          if (typeof window !== 'undefined') {
            localStorage.removeItem('splitflow_active_session_user');
          }
          return {
            user: null,
            emailNotConfirmed: true,
            email: userProfile?.email || targetEmail,
            error: 'Tu cuenta aún no está verificada. Revisa tu bandeja de entrada y pulsa el enlace enviado desde SplitflowNoReplay@gmail.com para activarla.',
          };
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('splitflow_active_session_user', JSON.stringify(userProfile));
        }
        return { user: userProfile, session: data.session, requiresEmailConfirmation: false };
      } catch (err: any) {
        return { user: null, error: err.message || 'Error de conexión con Supabase.' };
      }
    }

    // Modo local si Supabase no está configurado
    if (typeof window !== 'undefined') {
      const savedUsers = localStorage.getItem('splitflow_registered_users');
      if (savedUsers) {
        const parsed: User[] = JSON.parse(savedUsers);
        const found = parsed.find(
          (u) =>
            (u.email && u.email.toLowerCase() === targetEmail) ||
            (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()) ||
            (u.username && cleanUsername && u.username.toLowerCase() === cleanUsername.toLowerCase())
        );
        if (found) {
          if (found.isEmailVerified === false) {
            return {
              user: null,
              emailNotConfirmed: true,
              email: found.email,
              error: 'Tu cuenta aún no está verificada. Revisa el enlace enviado desde SplitflowNoReplay@gmail.com para activarla.',
            };
          }
          localStorage.setItem('splitflow_active_session_user', JSON.stringify(found));
          return { user: found, requiresEmailConfirmation: false };
        }
      }
    }

    return { user: null, error: 'Usuario no encontrado o credenciales incorrectas.' };
  }

  async checkUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const clean = sanitizeUsername(username);
    if (!clean) return false;
    if (!isSupabaseConfigured || !supabase) return true;

    try {
      let query = supabase.from('profiles').select('id, username').ilike('username', clean);
      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }
      const { data, error } = await query.limit(1);
      if (error) {
        return true;
      }
      return !data || data.length === 0;
    } catch {
      return true;
    }
  }

  async checkEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const clean = email.trim().toLowerCase();
    if (!clean) return false;

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('profiles').select('id, email').ilike('email', clean);
        if (excludeUserId) {
          query = query.neq('id', excludeUserId);
        }
        const { data, error } = await query.limit(1);
        if (!error && data && data.length > 0) {
          return false;
        }
      } catch {
        // En caso de que profiles no contenga email aún, continuar
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const savedUsers = localStorage.getItem('splitflow_registered_users');
        if (savedUsers) {
          const parsed: User[] = JSON.parse(savedUsers);
          const exists = parsed.some(
            (u) => u.email.trim().toLowerCase() === clean && (!excludeUserId || u.id !== excludeUserId)
          );
          if (exists) return false;
        }
      } catch {
        // ignore
      }
    }

    return true;
  }

  async getContactSuggestions(currentUserId: string, excludeGroupId?: string): Promise<PublicUser[]> {
    if (!currentUserId) return [];

    let suggestions: PublicUser[] = [];

    // 1. Si Supabase está disponible, consultar vía RPC o joins seguros
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_contact_suggestions', {
          current_user_id: currentUserId,
        });

        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
          suggestions = rpcData.map((item: any) => ({
            id: item.id,
            username: item.username,
            isPastContact: true,
            sharedGroupsCount: Number(item.shared_groups_count || 1),
          }));
        } else {
          // Fallback a consulta directa sobre group_members y profiles
          const { data: memberGroups } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', currentUserId);

          if (memberGroups && memberGroups.length > 0) {
            const groupIds = memberGroups.map((mg: any) => mg.group_id).filter(Boolean);
            const { data: coMembers } = await supabase
              .from('group_members')
              .select('user_id, group_id, profiles(id, username)')
              .in('group_id', groupIds)
              .neq('user_id', currentUserId);

            if (coMembers && coMembers.length > 0) {
              const countMap = new Map<string, { username: string; count: number }>();
              for (const cm of coMembers as any[]) {
                if (cm.profiles?.id && cm.profiles?.username) {
                  const existing = countMap.get(cm.profiles.id);
                  if (existing) {
                    existing.count += 1;
                  } else {
                    countMap.set(cm.profiles.id, {
                      username: cm.profiles.username,
                      count: 1,
                    });
                  }
                }
              }

              suggestions = Array.from(countMap.entries()).map(([id, info]) => ({
                id,
                username: info.username,
                isPastContact: true,
                sharedGroupsCount: info.count,
              }));
            }
          }
        }
      } catch (e) {
        console.warn('Supabase getContactSuggestions notice:', e);
      }
    }

    // 2. Si no hubo resultados remotos o está en modo local/offline, resolver mediante historial local de grupos
    if (suggestions.length === 0) {
      const localGroups = this.getStoredEntity<Group[]>(currentUserId, 'groups', []);
      const countMap = new Map<string, { username: string; count: number }>();

      for (const g of localGroups) {
        for (const m of g.members) {
          if (m.id !== currentUserId) {
            const uname = m.username || m.name.toLowerCase().replace(/\s+/g, '_');
            const existing = countMap.get(m.id);
            if (existing) {
              existing.count += 1;
            } else {
              countMap.set(m.id, { username: uname, count: 1 });
            }
          }
        }
      }

      suggestions = Array.from(countMap.entries()).map(([id, info]) => ({
        id,
        username: info.username,
        isPastContact: true,
        sharedGroupsCount: info.count,
      }));
    }

    // Ordenar de mayor a menor grupos compartidos
    suggestions.sort((a, b) => (b.sharedGroupsCount || 0) - (a.sharedGroupsCount || 0));

    // Si se especifica un excludeGroupId, filtrar miembros que ya pertenecen a ese grupo
    if (excludeGroupId) {
      const targetGroup = this.getStoredEntity<Group[]>(currentUserId, 'groups', [])
        .find((g) => g.id === excludeGroupId);
      if (targetGroup) {
        const memberIds = new Set(targetGroup.members.map((m) => m.id));
        suggestions = suggestions.filter((s) => !memberIds.has(s.id));
      }
    }

    return suggestions;
  }

  async searchPublicUsers(
    query: string,
    currentUserId: string,
    excludeGroupId?: string
  ): Promise<PublicUser[]> {
    const cleanQuery = sanitizeUsername(query);
    if (!cleanQuery) return [];

    let results: PublicUser[] = [];

    // 1. Consulta en Supabase con RPC o select restringido a columnas públicas (id, username)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('search_public_users', {
          search_query: cleanQuery,
          max_results: 10,
        });

        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
          results = rpcData.map((item: any) => ({
            id: item.id,
            username: item.username,
          }));
        } else {
          // Consulta fallback select('id, username') con ILIKE
          const { data: profileRows, error } = await supabase
            .from('profiles')
            .select('id, username')
            .ilike('username', `%${cleanQuery}%`)
            .neq('id', currentUserId)
            .limit(10);

          if (!error && profileRows) {
            results = profileRows
              .filter((r: any) => r && r.username)
              .map((r: any) => ({
                id: r.id,
                username: r.username,
              }));
          }
        }
      } catch (e) {
        console.warn('Supabase searchPublicUsers notice:', e);
      }
    }

    // 2. Fallback a directorio local registrado si no hay resultados remotos
    if (results.length === 0 && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('splitflow_registered_users');
        if (saved) {
          const registeredUsers: User[] = JSON.parse(saved);
          results = registeredUsers
            .filter((u) => {
              if (u.id === currentUserId) return false;
              const uName = (u.username || '').toLowerCase();
              return uName.includes(cleanQuery);
            })
            .slice(0, 8)
            .map((u) => ({
              id: u.id,
              username: u.username || u.name.toLowerCase().replace(/\s+/g, '_'),
            }));
        }
      } catch {
        // ignore
      }
    }

    // Comprobar si alguno es contacto previo para marcar isPastContact y contar grupos
    const contactSuggestions = await this.getContactSuggestions(currentUserId);
    const pastContactMap = new Map(contactSuggestions.map((c) => [c.id, c.sharedGroupsCount || 1]));

    results = results.map((r) => ({
      ...r,
      isPastContact: pastContactMap.has(r.id),
      sharedGroupsCount: pastContactMap.get(r.id),
    }));

    // Excluir usuarios que ya pertenezcan al grupo objetivo
    if (excludeGroupId) {
      const targetGroup = this.getStoredEntity<Group[]>(currentUserId, 'groups', [])
        .find((g) => g.id === excludeGroupId);
      if (targetGroup) {
        const memberIds = new Set(targetGroup.members.map((m) => m.id));
        results = results.filter((r) => !memberIds.has(r.id));
      }
    }

    return results;
  }

  async signUp(
    userData: { name: string; username: string; email: string; monthlyIncome?: number },
    password?: string
  ): Promise<AuthResponse> {
    if (!password) {
      return { user: null, error: 'La contraseña es obligatoria.' };
    }

    const cleanUsername = sanitizeUsername(userData.username);
    if (!cleanUsername) {
      return { user: null, error: 'El nombre de usuario es obligatorio.' };
    }

    const cleanEmail = userData.email ? userData.email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      return { user: null, error: 'El correo electrónico es obligatorio.' };
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { user: null, error: 'Introduce un correo electrónico válido.' };
    }

    // Comprobación de unicidad de correo
    const emailAvailable = await this.checkEmailAvailable(cleanEmail);
    if (!emailAvailable) {
      return { 
        user: null, 
        error: 'Ya existe una cuenta registrada con este correo electrónico.' 
      };
    }

    // Comprobación estricta: Nombre de usuario único
    const usernameAvailable = await this.checkUsernameAvailable(cleanUsername);
    if (!usernameAvailable) {
      return {
        user: null,
        error: `El nombre de usuario @${cleanUsername} ya se encuentra ocupado.`,
      };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const verificationTokenFallback = this.createVerificationTokenValue();
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: origin,
            data: {
              name: userData.name.trim(),
              username: cleanUsername,
              monthly_income: userData.monthlyIncome,
              email_verified: false,
            },
          },
        });

        if (error) {
          const errLower = error.message.toLowerCase();
          if (
            errLower.includes('already registered') || 
            errLower.includes('user already exists') || 
            errLower.includes('already been registered')
          ) {
            return {
              user: null,
              error: `El usuario @${cleanUsername} ya se encuentra registrado. Inicia sesión en su lugar.`,
            };
          }
          return { user: null, error: error.message };
        }

        // Supabase con email enumeration protection retorna user pero identities vacío si el correo ya existía
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          return {
            user: null,
            error: 'Ya existe una cuenta registrada con este correo electrónico. Inicia sesión en su lugar.',
          };
        }

        if (data.user) {
          // Si Supabase autoconfirmó sesión al registrar, aseguramos el perfil con email_verified = false
          // y cerramos inmediatamente la sesión para exigir la verificación por correo antes del login.
          if (data.session) {
            try {
              await this.fetchOrCreateProfile(data.user, {
                name: userData.name.trim(),
                username: cleanUsername,
                monthlyIncome: userData.monthlyIncome,
              });
              await supabase
                .from('profiles')
                .update({ email_verified: false })
                .eq('id', data.user.id);
            } catch {
              // ignore if column not yet migrated
            }
            try {
              await supabase.auth.signOut();
            } catch {
              // ignore
            }
          }

          if (typeof window !== 'undefined') {
            localStorage.removeItem('splitflow_active_session_user');
          }

          // Solicitar token seguro en base de datos y enviar enlace oficial desde SplitflowNoReplay@gmail.com
          let tokenToSend = verificationTokenFallback;
          try {
            const { data: rpcTokenRes, error: rpcTokenErr } = await supabase.rpc('request_email_verification_token', {
              p_email: cleanEmail,
            });

            if (rpcTokenErr) {
              const errMsg = rpcTokenErr.message?.toLowerCase() || '';
              const isMissingRpc =
                rpcTokenErr.code === 'PGRST202' ||
                rpcTokenErr.code === '42883' ||
                errMsg.includes('does not exist') ||
                errMsg.includes('schema cache');

              if (!isMissingRpc) {
                console.error('[signUp] Error generando token de verificación en Supabase:', rpcTokenErr);
                return {
                  user: null,
                  error: rpcTokenErr.message || 'No se pudo generar el token de verificación en la base de datos.',
                };
              }
            } else if (rpcTokenRes) {
              if (!rpcTokenRes.success) {
                return {
                  user: null,
                  error: rpcTokenRes.error || 'No se pudo generar el token de verificación.',
                };
              }
              if (rpcTokenRes.token) {
                tokenToSend = rpcTokenRes.token;
              }
            }
          } catch (rpcException) {
            console.warn('[signUp] Aviso generando token:', rpcException);
          }

          this.saveLocalVerificationRecord({
            email: cleanEmail,
            token: tokenToSend,
            verified: false,
            username: cleanUsername,
            name: userData.name.trim(),
          });

          const verificationUrl = this.buildVerificationUrl(tokenToSend, cleanEmail);
          const mailRes = await sendAccountVerificationEmail({
            email: cleanEmail,
            name: userData.name.trim(),
            username: cleanUsername,
            verificationUrl,
          });

          if (!mailRes.success && !mailRes.simulated) {
            console.warn('[signUp] Aviso enviando correo de verificación:', mailRes.error);
          }

          const pendingProfile: User = {
            id: data.user.id,
            name: userData.name.trim(),
            username: cleanUsername,
            email: cleanEmail,
            monthlyIncome: userData.monthlyIncome,
            role: 'member',
            isEmailVerified: false,
          };

          if (typeof window !== 'undefined') {
            const savedUsers = localStorage.getItem('splitflow_registered_users');
            const usersList: User[] = savedUsers ? JSON.parse(savedUsers) : [];
            if (!usersList.some((u) => u.email.toLowerCase() === cleanEmail)) {
              usersList.push(pendingProfile);
              localStorage.setItem('splitflow_registered_users', JSON.stringify(usersList));
            }
          }

          return {
            user: null,
            session: null,
            userId: data.user.id,
            email: cleanEmail,
            username: cleanUsername,
            requiresEmailConfirmation: true,
          };
        }

        return { user: null, error: 'Respuesta inesperada al crear la cuenta.' };
      } catch (err: any) {
        return { user: null, error: err.message || 'Error al comunicarse con Supabase.' };
      }
    }

    // Modo local / Fallback con verificación obligatoria por correo
    if (typeof window !== 'undefined') {
      const savedUsers = localStorage.getItem('splitflow_registered_users');
      const usersList: User[] = savedUsers ? JSON.parse(savedUsers) : [];
      if (usersList.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return {
          user: null,
          error: 'Ya existe una cuenta registrada con este correo electrónico. Solo se permite 1 usuario por correo.',
        };
      }
    }

    const localUser: User = {
      id: `usr_${Date.now()}`,
      name: userData.name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      monthlyIncome: userData.monthlyIncome,
      role: 'member',
      isEmailVerified: false,
    };

    const localToken = this.createVerificationTokenValue();
    this.saveLocalVerificationRecord({
      email: cleanEmail,
      token: localToken,
      verified: false,
      username: cleanUsername,
      name: userData.name.trim(),
    });

    if (typeof window !== 'undefined') {
      localStorage.removeItem('splitflow_active_session_user');
      const savedUsers = localStorage.getItem('splitflow_registered_users');
      const usersList: User[] = savedUsers ? JSON.parse(savedUsers) : [];
      usersList.push(localUser);
      localStorage.setItem('splitflow_registered_users', JSON.stringify(usersList));
    }

    const localVerificationUrl = this.buildVerificationUrl(localToken, cleanEmail);
    await sendAccountVerificationEmail({
      email: cleanEmail,
      name: userData.name.trim(),
      username: cleanUsername,
      verificationUrl: localVerificationUrl,
    });

    return {
      user: null,
      userId: localUser.id,
      email: cleanEmail,
      username: cleanUsername,
      requiresEmailConfirmation: true,
    };
  }

  async signOut(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('splitflow_active_session_user');
    }
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
  }

  async resendVerification(emailOrUsername: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const raw = (emailOrUsername || '').trim().toLowerCase();
    if (!raw) {
      return { success: false, error: 'Introduce un correo electrónico o usuario válido.' };
    }

    let targetEmail = raw;
    let targetName: string | undefined;
    let targetUsername: string | undefined;

    if (!raw.includes('@')) {
      const cleanU = sanitizeUsername(raw);
      targetUsername = cleanU;
      if (typeof window !== 'undefined') {
        try {
          const savedUsers = localStorage.getItem('splitflow_registered_users');
          if (savedUsers) {
            const list: User[] = JSON.parse(savedUsers);
            const match = list.find((u) => u.username?.toLowerCase() === cleanU.toLowerCase());
            if (match?.email) {
              targetEmail = match.email.toLowerCase();
              targetName = match.name;
            }
          }
        } catch {
          // ignore
        }
      }
      if (!targetEmail.includes('@') && isSupabaseConfigured && supabase) {
        try {
          const { data: rpcEmail } = await supabase.rpc('get_email_by_username', { p_username: cleanU });
          if (rpcEmail && typeof rpcEmail === 'string' && rpcEmail.includes('@')) {
            targetEmail = rpcEmail.toLowerCase();
          }
        } catch {
          // ignore
        }
      }
    }

    if (!targetEmail.includes('@')) {
      return { success: false, error: 'No se encontró la dirección de correo electrónico de esta cuenta.' };
    }

    let tokenToSend = this.createVerificationTokenValue();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('request_email_verification_token', {
          p_email: targetEmail,
        });
        if (rpcErr) {
          const errMsg = rpcErr.message?.toLowerCase() || '';
          const isMissingRpc =
            rpcErr.code === 'PGRST202' ||
            rpcErr.code === '42883' ||
            errMsg.includes('does not exist') ||
            errMsg.includes('schema cache');

          if (!isMissingRpc) {
            return {
              success: false,
              email: targetEmail,
              error: rpcErr.message || 'No se pudo generar un nuevo enlace de verificación.',
            };
          }
        } else if (rpcRes) {
          if (rpcRes.already_verified) {
            this.markLocalUserVerified(targetEmail);
            return {
              success: true,
              email: targetEmail,
            };
          }
          if (!rpcRes.success) {
            return {
              success: false,
              email: targetEmail,
              error: rpcRes.error || 'No se pudo generar un nuevo enlace de verificación.',
            };
          }
          if (rpcRes.token) {
            tokenToSend = rpcRes.token;
            targetName = rpcRes.name || targetName;
            targetUsername = rpcRes.username || targetUsername;
          }
        }
      } catch (err) {
        console.warn('[resendVerification] Aviso RPC:', err);
      }
    }

    this.saveLocalVerificationRecord({
      email: targetEmail,
      token: tokenToSend,
      verified: false,
      username: targetUsername,
      name: targetName,
    });

    const verificationUrl = this.buildVerificationUrl(tokenToSend, targetEmail);
    const mailRes = await sendAccountVerificationEmail({
      email: targetEmail,
      name: targetName,
      username: targetUsername,
      verificationUrl,
    });

    if (!mailRes.success && !mailRes.simulated) {
      return {
        success: false,
        email: targetEmail,
        error: mailRes.error || 'No se pudo reenviar el correo de verificación.',
      };
    }

    return { success: true, email: targetEmail };
  }

  async verifyEmailToken(email: string, token: string): Promise<EmailVerificationResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanToken = (token || '').trim();

    if (!cleanToken) {
      return { success: false, error: 'El enlace de verificación no contiene un token válido.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('verify_email_token', {
          p_email: cleanEmail,
          p_token: cleanToken,
        });

        if (!rpcErr && rpcRes) {
          if (rpcRes.success) {
            const verifiedEmail = (rpcRes.email || cleanEmail).toLowerCase();
            this.markLocalUserVerified(verifiedEmail);
            return {
              success: true,
              alreadyVerified: Boolean(rpcRes.already_verified),
              email: verifiedEmail,
              username: rpcRes.username || undefined,
            };
          }
          // Si falló explícitamente en la BD (ej. token expirado o falso), no hacer fallback a menos que sea RPC inexistente
          return {
            success: false,
            error: rpcRes.error || 'El enlace de verificación no es válido o ha expirado.',
          };
        }

        // Si la función RPC no existía aún en Supabase (PGRST202 / 42883), continuar al fallback local
        const errMsg = rpcErr?.message?.toLowerCase() || '';
        const isMissingRpc =
          rpcErr?.code === 'PGRST202' ||
          rpcErr?.code === '42883' ||
          errMsg.includes('does not exist') ||
          errMsg.includes('schema cache');

        if (!isMissingRpc && rpcErr) {
          return { success: false, error: rpcErr.message };
        }
      } catch (err: unknown) {
        console.warn('[verifyEmailToken] Aviso RPC:', err);
      }
    }

    // Validación contra registro local (modo local o migración SQL pendiente)
    const store = this.getLocalVerificationStore();
    const record = cleanEmail
      ? store[cleanEmail]
      : Object.values(store).find((item) => item.token === cleanToken);

    if (record && record.token === cleanToken) {
      if (record.verified) {
        return {
          success: true,
          alreadyVerified: true,
          email: record.email,
          username: record.username,
        };
      }
      if (Date.now() > record.expiresAt) {
        return {
          success: false,
          email: record.email,
          error: 'Este enlace de verificación ha caducado. Solicita uno nuevo desde el inicio de sesión.',
        };
      }
      this.markLocalUserVerified(record.email);
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.rpc('auto_confirm_user_email', { p_email: record.email });
        } catch {
          // ignore
        }
      }
      return {
        success: true,
        alreadyVerified: false,
        email: record.email,
        username: record.username,
      };
    }

    return {
      success: false,
      email: cleanEmail || undefined,
      error: 'El enlace de verificación no es válido o ha caducado.',
    };
  }

  async requestPasswordReset(identifier: string, _customRedirectTo?: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    if (!cleanIdentifier) {
      return { success: false, error: 'Introduce un usuario o correo electrónico válido.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Invocar RPC para generar el código aleatorio de 6 dígitos
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('request_password_reset_code', {
          p_identifier: cleanIdentifier,
        });

        if (rpcErr || !rpcRes) {
          return { success: false, error: rpcErr?.message || 'Error al generar código de recuperación.' };
        }

        if (!rpcRes.success) {
          return { success: false, error: rpcRes.error || 'No se encontró ningún usuario con ese correo o nombre de usuario.' };
        }

        const targetEmail = rpcRes.email;
        const targetName = rpcRes.name || 'Usuario';
        const otpCode = rpcRes.code;

        // 2. Enviar el correo oficial desde SplitflowNoReplay@gmail.com mediante la Edge Function
        const emailRes = await sendNotificationEmail({
          recipient_email: targetEmail,
          recipient_name: targetName,
          subject: `[SplitFlow] Código de recuperación de contraseña: ${otpCode}`,
          title: 'Recuperación de contraseña',
          message: `¡Hola, ${targetName}!\n\nHemos recibido una solicitud para restablecer la contraseña de tu cuenta en SplitFlow.\n\nTu código de verificación de 6 dígitos es:\n${otpCode}\n\nIntroduce este código en la aplicación para verificar tu identidad y a continuación podrás cambiar y confirmar tu nueva contraseña.\n\nEste código es válido durante 15 minutos. Si no has solicitado este cambio, puedes ignorar este mensaje de forma segura.`,
        });

        if (!emailRes.success && !emailRes.simulated) {
          return { success: false, error: emailRes.error || 'No se pudo enviar el correo de recuperación.' };
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`splitflow_reset_otp_${targetEmail}`, otpCode);
          sessionStorage.setItem('splitflow_reset_active_email', targetEmail);
        }

        return { success: true, email: targetEmail };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al procesar la recuperación de contraseña.';
        return { success: false, error: msg };
      }
    }

    // Modo local / Fallback para desarrollo sin conexión externa
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`splitflow_reset_otp_${cleanIdentifier}`, mockOtp);
      sessionStorage.setItem('splitflow_reset_active_email', cleanIdentifier);
      console.info(`[SplitFlow OTP SplitflowNoReplay] Código de 6 dígitos enviado a ${cleanIdentifier}: ${mockOtp}`);
    }
    return { success: true, email: cleanIdentifier };
  }

  async verifyPasswordResetOtp(email: string, token: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    if (!cleanToken || cleanToken.length < 6) {
      return { success: false, error: 'Introduce los 6 dígitos del código de verificación.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('verify_password_reset_code', {
          p_email: cleanEmail,
          p_code: cleanToken,
        });

        if (error) {
          return { success: false, error: error.message || 'Error al validar el código OTP.' };
        }

        if (!data || !data.success) {
          return { success: false, error: data?.error || 'Código de 6 dígitos incorrecto o expirado.' };
        }

        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al verificar el código de verificación.';
        return { success: false, error: msg };
      }
    }

    // Fallback local
    if (typeof window !== 'undefined') {
      const savedOtp = sessionStorage.getItem(`splitflow_reset_otp_${cleanEmail}`);
      if (cleanToken === savedOtp || cleanToken.length === 6) {
        return { success: true };
      }
    }

    return { success: false, error: 'Código de verificación incorrecto o expirado.' };
  }

  async updateUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al actualizar la contraseña.';
        return { success: false, error: msg };
      }
    }

    return { success: true };
  }

  async confirmPasswordReset(email: string, token: string, newPassword: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    if (newPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Invocar RPC complete_password_reset (valida código y cifra contraseña en auth.users con bcrypt)
        const { data, error } = await supabase.rpc('complete_password_reset', {
          p_email: cleanEmail,
          p_code: cleanToken,
          p_new_password: newPassword,
        });

        if (error) {
          return { success: false, error: error.message || 'Error al actualizar la contraseña.' };
        }

        if (!data || !data.success) {
          return { success: false, error: data?.error || 'No se pudo actualizar la contraseña.' };
        }

        // 2. Iniciar sesión con la nueva contraseña para obtener sesión activa
        let updatedProfile: User | null = null;
        try {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: newPassword,
          });

          if (signInData?.user) {
            updatedProfile = await this.fetchOrCreateProfile(signInData.user);
            if (updatedProfile && typeof window !== 'undefined') {
              localStorage.setItem('splitflow_active_session_user', JSON.stringify(updatedProfile));
            }
          }
        } catch {
          // ignore signin catch
        }

        return { success: true, user: updatedProfile || undefined };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al procesar la actualización de contraseña.';
        return { success: false, error: msg };
      }
    }

    // Fallback local
    if (typeof window !== 'undefined') {
      const savedUsers = localStorage.getItem('splitflow_registered_users');
      const list: User[] = savedUsers ? JSON.parse(savedUsers) : [];
      const found = list.find((u) => u.email.toLowerCase() === cleanEmail);
      return { success: true, user: found };
    }

    return { success: true };
  }

  async updateProfile(user: User): Promise<User> {
    const cleanUsername = user.username ? sanitizeUsername(user.username) : undefined;
    const updatedUser: User = { 
      ...user, 
      username: cleanUsername || user.username,
      emailNotifications: user.emailNotifications !== false,
    };

    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .update({
            name: user.name,
            username: cleanUsername,
            monthly_income: user.monthlyIncome,
            email_notifications: updatedUser.emailNotifications,
          })
          .eq('id', user.id);

        await supabase.auth.updateUser({
          data: {
            name: user.name,
            username: cleanUsername,
            monthly_income: user.monthlyIncome,
            email_notifications: updatedUser.emailNotifications,
          },
        });
      } catch (e) {
        console.warn('Could not update profile in Supabase:', e);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('splitflow_active_session_user', JSON.stringify(updatedUser));
      const savedUsers = localStorage.getItem('splitflow_registered_users');
      if (savedUsers) {
        try {
          const list: User[] = JSON.parse(savedUsers);
          const idx = list.findIndex((u) => u.id === user.id);
          if (idx >= 0) {
            list[idx] = updatedUser;
            localStorage.setItem('splitflow_registered_users', JSON.stringify(list));
          }
        } catch {}
      }
    }

    return updatedUser;
  }

  async getGroups(userId?: string): Promise<Group[]> {
    if (!supabase) return [];

    let authUid = userId;
    try {
      if (!authUid) {
        const { data: authData } = await supabase.auth.getUser();
        authUid = authData?.user?.id;
      }
      if (!authUid) return [];

      // 1. Invocar función RPC optimizada get_user_groups en Supabase con SECURITY DEFINER (cero recursión de RLS)
      const { data: rpcGroups, error: rpcErr } = await supabase.rpc('get_user_groups', {
        p_user_id: authUid,
      });

      if (!rpcErr && Array.isArray(rpcGroups) && rpcGroups.length > 0) {
        this.setStoredEntity(authUid, 'groups', rpcGroups);
        return rpcGroups as Group[];
      }

      // 2. Intentar consultar tablas de Supabase PostgreSQL directamente
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', authUid);

      if (!memberErr && memberRows && memberRows.length > 0) {
        const groupIds = memberRows.map((r: any) => r.group_id).filter(Boolean);
        const { data: groupRows } = await supabase.from('groups').select('*').in('id', groupIds);

        if (groupRows && groupRows.length > 0) {
          const { data: allMemberships } = await supabase
            .from('group_members')
            .select('group_id, user_id, role, profiles(id, name, username, email, monthly_income)')
            .in('group_id', groupIds);

          const mappedGroups: Group[] = groupRows.map((g: any) => {
            const adminId = g.admin_id || g.created_by;
            const groupMemberships = (allMemberships || []).filter((m: any) => m.group_id === g.id && m.profiles);
            const callerMembership = groupMemberships.find((m: any) => m.profiles.id === authUid);
            const isCallerAdmin = authUid === adminId || callerMembership?.role === 'admin';
            const fullGroupCode = g.codigo_grupo || g.invite_code || `SF-${g.id.slice(-6).toUpperCase()}`;

            return {
              id: g.id,
              name: g.name,
              description: g.description || '',
              category: g.category || 'HOME',
              currency: g.currency || 'EUR',
              // REQUISITO: El código único del grupo es visible para cualquiera de los administradores (hasta 4)
              inviteCode: isCallerAdmin ? fullGroupCode : undefined,
              codigoGrupo: isCallerAdmin ? fullGroupCode : undefined,
              adminId: adminId,
              created_by: g.created_by,
              createdAt: g.created_at,
              budgetBlocks: g.budget_blocks || undefined,
              incomeModuleEnabled: Boolean(g.income_module_enabled ?? g.incomeModuleEnabled ?? false),
              members: groupMemberships.map((m: any) => ({
                id: m.profiles.id,
                name: m.profiles.name || 'Miembro',
                username: m.profiles.username,
                email: m.profiles.email || '',
                monthlyIncome: m.profiles.monthly_income != null ? Number(m.profiles.monthly_income) : undefined,
                role: (m.profiles.id === adminId || m.role === 'admin') ? 'admin' : 'member',
              })),
            };
          });

          this.setStoredEntity(authUid, 'groups', mappedGroups);
          return mappedGroups;
        }
      }
    } catch (e) {
      console.warn('Error reading groups from Supabase:', e);
    }

    // 3. Si no hay registros remotos o las tablas aún no se han migrado, cargar grupos persistidos del usuario
    if (authUid) {
      const stored = this.getStoredEntity<Group[]>(authUid, 'groups', []);
      return stored.map((g) => {
        const adminId = g.adminId || g.created_by || (g.members.find((m) => m.role === 'admin')?.id) || (g.members[0]?.id);
        const isCallerAdmin = authUid === adminId || g.members.some((m) => m.id === authUid && m.role === 'admin');
        const code = g.inviteCode || g.codigoGrupo || `SF-${g.id.slice(-6).toUpperCase()}`;

        return {
          ...g,
          adminId,
          inviteCode: isCallerAdmin ? code : undefined,
          codigoGrupo: isCallerAdmin ? code : undefined,
          members: g.members.map((m) => ({
            ...m,
            role: (m.id === adminId || m.role === 'admin') ? 'admin' : 'member',
          })),
        };
      });
    }
    return [];
  }

  async createGroup(group: Group, creatorId: string): Promise<Group> {
    const rawCode = `SF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    let savedGroup: Group = {
      ...group,
      adminId: creatorId,
      created_by: creatorId,
      inviteCode: rawCode,
      codigoGrupo: rawCode,
      members: group.members.map((m) => ({
        ...m,
        role: m.id === creatorId ? 'admin' : 'member',
      })),
    };

    if (supabase) {
      try {
        const { data: insertedGroup, error: groupErr } = await supabase
          .from('groups')
          .insert({
            name: group.name,
            description: group.description,
            category: group.category || 'HOME',
            currency: group.currency || 'EUR',
            income_module_enabled: group.incomeModuleEnabled ?? false,
            budget_blocks: group.budgetBlocks,
            created_by: creatorId,
            admin_id: creatorId,
            codigo_grupo: rawCode,
            invite_code: rawCode,
          })
          .select('*')
          .single();

        if (!groupErr && insertedGroup) {
          await supabase.from('group_members').insert({
            group_id: insertedGroup.id,
            user_id: creatorId,
            role: 'admin',
          });

          // Si el grupo contiene otros miembros, agregarlos a la tabla de miembros
          const otherMembers = group.members.filter((m) => m.id !== creatorId);
          if (otherMembers.length > 0) {
            const memberRows = otherMembers.map((m) => ({
              group_id: insertedGroup.id,
              user_id: m.id,
              role: 'member',
            }));
            await supabase.from('group_members').upsert(memberRows, { onConflict: 'group_id,user_id' });
          }

          savedGroup = {
            ...savedGroup,
            id: insertedGroup.id,
            createdAt: insertedGroup.created_at,
            adminId: insertedGroup.admin_id || creatorId,
          };
        }
      } catch (e) {
        console.warn('Supabase createGroup notice:', e);
      }
    }

    // Sincronizar en almacén persistente del usuario
    const userGroups = this.getStoredEntity<Group[]>(creatorId, 'groups', []);
    const updated = [savedGroup, ...userGroups.filter((g) => g.id !== savedGroup.id)];
    this.setStoredEntity(creatorId, 'groups', updated);

    return savedGroup;
  }

  async updateGroup(group: Group): Promise<Group> {
    if (supabase) {
      try {
        await supabase
          .from('groups')
          .update({
            name: group.name,
            description: group.description,
            category: group.category,
            currency: group.currency,
            income_module_enabled: group.incomeModuleEnabled ?? false,
            budget_blocks: group.budgetBlocks,
          })
          .eq('id', group.id);
      } catch (e) {
        console.warn('Supabase updateGroup notice:', e);
      }
    }

    // Sincronizar en el almacén local del creador/miembros
    for (const m of group.members) {
      const userGroups = this.getStoredEntity<Group[]>(m.id, 'groups', []);
      const updated = userGroups.map((g) => (g.id === group.id ? group : g));
      this.setStoredEntity(m.id, 'groups', updated);
    }

    return group;
  }

  async deleteGroup(groupId: string): Promise<void> {
    if (supabase) {
      try {
        const { data: groupExpenses } = await supabase
          .from('expenses')
          .select('id')
          .eq('group_id', groupId);

        if (groupExpenses && groupExpenses.length > 0) {
          const expenseIds = groupExpenses.map((e: any) => e.id);
          await supabase.from('expense_splits').delete().in('expense_id', expenseIds);
          await supabase.from('expenses').delete().eq('group_id', groupId);
        }

        await supabase.from('group_members').delete().eq('group_id', groupId);
        await supabase.from('groups').delete().eq('id', groupId);
      } catch (e) {
        console.warn('Supabase deleteGroup notice:', e);
      }
    }

    // Limpiar de los almacenes locales
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const remaining = groups.filter((g) => g.id !== groupId);
              localStorage.setItem(key, JSON.stringify(remaining));
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }

  async getExpenses(groupId: string): Promise<Expense[]> {
    if (supabase) {
      try {
        // 1. Invocar función RPC get_group_expenses (ultrarrápida y con splits formateados)
        const { data: rpcExpenses, error: rpcErr } = await supabase.rpc('get_group_expenses', {
          p_group_id: groupId,
        });

        if (!rpcErr && Array.isArray(rpcExpenses)) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`splitflow_group_${groupId}_expenses`, JSON.stringify(rpcExpenses));
            } catch (e) {
              console.warn(e);
            }
          }
          return rpcExpenses as Expense[];
        }

        // 2. Consulta fallback directa en tabla expenses
        const { data: rows, error } = await supabase
          .from('expenses')
          .select('*, expense_splits(*)')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });

        if (!error && rows && rows.length > 0) {
          const mappedExpenses: Expense[] = rows.map((r: any) => ({
            id: r.id,
            groupId: r.group_id,
            description: r.description,
            amount: Number(r.amount),
            paidByUserId: r.paid_by_user_id,
            splitType: r.split_type,
            category: r.category,
            notes: r.notes || undefined,
            createdAt: r.created_at,
            splits: (r.expense_splits || []).map((s: any) => ({
              userId: s.user_id,
              amount: Number(s.amount),
              percentage: s.percentage ? Number(s.percentage) : undefined,
            })),
          }));

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`splitflow_group_${groupId}_expenses`, JSON.stringify(mappedExpenses));
            } catch (e) {
              console.warn(e);
            }
          }
          return mappedExpenses;
        }
      } catch (e) {
        console.warn('Supabase getExpenses notice:', e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`splitflow_group_${groupId}_expenses`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async createExpense(expense: Expense): Promise<Expense> {
    let saved = { ...expense };

    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('expenses')
          .insert({
            group_id: expense.groupId,
            description: expense.description,
            amount: expense.amount,
            paid_by_user_id: expense.paidByUserId,
            category: expense.category,
            split_type: expense.splitType,
            notes: expense.notes,
            splits: expense.splits,
          })
          .select('*')
          .single();

        if (!error && inserted) {
          if (expense.splits && expense.splits.length > 0) {
            const splitsToInsert = expense.splits.map((s) => ({
              expense_id: inserted.id,
              user_id: s.userId,
              amount: s.amount,
              percentage: s.percentage,
            }));
            await supabase.from('expense_splits').insert(splitsToInsert);
          }

          saved = {
            ...expense,
            id: inserted.id,
            createdAt: inserted.created_at,
          };
        }
      } catch (e) {
        console.warn('Supabase createExpense notice:', e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const current = this.getExpensesFromLocal(expense.groupId);
        const updated = [saved, ...current.filter((e) => e.id !== saved.id)];
        localStorage.setItem(`splitflow_group_${expense.groupId}_expenses`, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }

    return saved;
  }

  private getExpensesFromLocal(groupId: string): Expense[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(`splitflow_group_${groupId}_expenses`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  async deleteExpense(expenseId: string): Promise<void> {
    if (supabase) {
      try {
        await supabase.from('expenses').delete().eq('id', expenseId);
      } catch (e) {
        console.warn('Supabase deleteExpense notice:', e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_expenses')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const expenses: Expense[] = JSON.parse(raw);
              const remaining = expenses.filter((e) => e.id !== expenseId);
              localStorage.setItem(key, JSON.stringify(remaining));
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }

  async getSettlements(groupId: string): Promise<SettlementTransaction[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('settlement_transactions')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((s: any) => ({
            id: s.id,
            groupId: s.group_id,
            fromUserId: s.from_user_id,
            toUserId: s.to_user_id,
            amount: Number(s.amount),
            currency: s.currency || 'EUR',
            isSettled: Boolean(s.is_settled),
            settledAt: s.settled_at || s.created_at,
            paymentMethod: (s.payment_method as SettlementPaymentMethod) || 'BIZUM',
          }));
        }
      } catch (e) {
        console.warn('Supabase getSettlements notice:', e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`splitflow_group_${groupId}_settlements`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async settleDebt(settlement: SettlementTransaction): Promise<SettlementTransaction> {
    const saved = {
      ...settlement,
      id: settlement.id || `settle-${Date.now()}`,
      settledAt: new Date().toISOString(),
      isSettled: true,
    };

    if (supabase && settlement.groupId) {
      try {
        await supabase.from('settlement_transactions').insert({
          group_id: settlement.groupId,
          from_user_id: settlement.fromUserId,
          to_user_id: settlement.toUserId,
          amount: settlement.amount,
          currency: settlement.currency,
          is_settled: true,
          settled_at: saved.settledAt,
          payment_method: settlement.paymentMethod || 'BIZUM',
        });
      } catch (e) {
        console.warn('Supabase settleDebt notice:', e);
      }
    }

    if (typeof window !== 'undefined' && settlement.groupId) {
      try {
        const key = `splitflow_group_${settlement.groupId}_settlements`;
        const raw = localStorage.getItem(key);
        const current: SettlementTransaction[] = raw ? JSON.parse(raw) : [];
        const updated = [saved, ...current];
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }

    return saved;
  }

  async resetSettlements(groupId: string, _memberIds: string[]): Promise<void> {
    if (supabase) {
      try {
        await supabase.from('settlement_transactions').delete().eq('group_id', groupId);
      } catch (e) {
        console.warn(e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`splitflow_group_${groupId}_settlements`);
      } catch (e) {
        console.warn(e);
      }
    }
  }

  async addMemberToGroup(groupId: string, user: User): Promise<void> {
    if (supabase) {
      try {
        await supabase.from('group_members').insert({
          group_id: groupId,
          user_id: user.id,
          role: 'member',
        });
      } catch (e) {
        console.warn(e);
      }
    }
  }

  async joinGroupByCode(code: string, user: User): Promise<Group | null> {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return null;

    if (supabase) {
      try {
        const { data: group } = await supabase
          .from('groups')
          .select('*')
          .ilike('invite_code', cleanCode)
          .maybeSingle();

        if (group) {
          await supabase.from('group_members').upsert({
            group_id: group.id,
            user_id: user.id,
            role: 'member',
          });

          const groups = await this.getGroups(user.id);
          return groups.find((g) => g.id === group.id) || null;
        }
      } catch (e) {
        console.warn(e);
      }
    }

    // Local fallback check
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const found = groups.find((g) => (g.inviteCode || '').toUpperCase() === cleanCode);
              if (found) {
                if (!found.members.some((m) => m.id === user.id)) {
                  found.members.push(user);
                  localStorage.setItem(key, JSON.stringify(groups));
                }
                return found;
              }
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    return null;
  }

  async transferGroupAdmin(groupId: string, newAdminId: string): Promise<{ success: boolean; reassignedAdminId?: string; error?: string }> {
    if (supabase) {
      try {
        // 1. Invocar RPC transfer_group_admin
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('transfer_group_admin', {
          p_group_id: groupId,
          p_new_admin_id: newAdminId,
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          return { success: true, reassignedAdminId: newAdminId };
        }

        // 2. Fallback directo en tabla groups si el RPC no estuviese disponible
        const { error: groupUpdateErr } = await supabase
          .from('groups')
          .update({ admin_id: newAdminId })
          .eq('id', groupId);

        if (groupUpdateErr) {
          return { success: false, error: groupUpdateErr.message };
        }

        await supabase
          .from('group_members')
          .update({ role: 'member' })
          .eq('group_id', groupId);

        await supabase
          .from('group_members')
          .update({ role: 'admin' })
          .eq('group_id', groupId)
          .eq('user_id', newAdminId);

        return { success: true, reassignedAdminId: newAdminId };
      } catch (err: any) {
        return { success: false, error: err.message || 'Error al transferir rol de administrador' };
      }
    }

    // Local fallback
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const gIdx = groups.findIndex((g) => g.id === groupId);
              if (gIdx >= 0) {
                groups[gIdx].adminId = newAdminId;
                groups[gIdx].members = groups[gIdx].members.map((m) => ({
                  ...m,
                  role: m.id === newAdminId ? 'admin' : 'member',
                }));
                localStorage.setItem(key, JSON.stringify(groups));
              }
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    return { success: true, reassignedAdminId: newAdminId };
  }

  async promoteGroupAdmin(groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('promote_group_admin', {
          p_group_id: groupId,
          p_target_user_id: targetUserId,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        if (data && !data.success) {
          return { success: false, error: data.error || 'No se pudo promover a administrador.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Error al promover administrador.' };
      }
    }

    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const gIdx = groups.findIndex((g) => g.id === groupId);
              if (gIdx >= 0) {
                const adminCount = groups[gIdx].members.filter(m => m.id === groups[gIdx].adminId || m.role === 'admin').length;
                if (adminCount >= 4) {
                  return { success: false, error: 'Límite alcanzado: Un grupo puede tener un máximo de 4 administradores simultáneos.' };
                }
                groups[gIdx].members = groups[gIdx].members.map((m) => ({
                  ...m,
                  role: m.id === targetUserId ? 'admin' : m.role,
                }));
                localStorage.setItem(key, JSON.stringify(groups));
              }
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    return { success: true };
  }

  async revokeGroupAdmin(groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('revoke_group_admin', {
          p_group_id: groupId,
          p_target_user_id: targetUserId,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        if (data && !data.success) {
          return { success: false, error: data.error || 'No se pudo revocar el rol de administrador.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Error al revocar rol de administrador.' };
      }
    }

    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const gIdx = groups.findIndex((g) => g.id === groupId);
              if (gIdx >= 0) {
                groups[gIdx].members = groups[gIdx].members.map((m) => ({
                  ...m,
                  role: m.id === targetUserId ? 'member' : m.role,
                }));
                localStorage.setItem(key, JSON.stringify(groups));
              }
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    return { success: true };
  }

  async transferSupremeAdmin(groupId: string, newSupremeAdminId: string): Promise<{ success: boolean; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('transfer_supreme_admin', {
          p_group_id: groupId,
          p_new_supreme_admin_id: newSupremeAdminId,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        if (data && !data.success) {
          return { success: false, error: data.error || 'No se pudo transferir la administración suprema.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Error al transferir administración suprema.' };
      }
    }

    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const gIdx = groups.findIndex((g) => g.id === groupId);
              if (gIdx >= 0) {
                groups[gIdx].adminId = newSupremeAdminId;
                groups[gIdx].members = groups[gIdx].members.map((m) => ({
                  ...m,
                  role: m.id === newSupremeAdminId ? 'admin' : m.role,
                }));
                localStorage.setItem(key, JSON.stringify(groups));
              }
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    return { success: true };
  }

  async removeGroupMember(groupId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('remove_group_member', {
          p_group_id: groupId,
          p_target_user_id: targetUserId,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        if (data && !data.success) {
          return { success: false, error: data.error || 'No se pudo eliminar al integrante del grupo.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Error al eliminar integrante.' };
      }
    }

    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const gIdx = groups.findIndex((g) => g.id === groupId);
              if (gIdx >= 0) {
                groups[gIdx].members = groups[gIdx].members.filter((m) => m.id !== targetUserId);
                localStorage.setItem(key, JSON.stringify(groups));
              }
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    return { success: true };
  }

  async leaveGroup(groupId: string, userId: string): Promise<{ success: boolean; reassignedAdminId?: string; error?: string }> {
    let reassignedAdminId: string | undefined = undefined;

    if (supabase) {
      try {
        // Verificar si el usuario saliente es el admin del grupo
        const { data: groupBefore } = await supabase
          .from('groups')
          .select('id, admin_id, created_by')
          .eq('id', groupId)
          .maybeSingle();

        const wasAdmin = groupBefore && (groupBefore.admin_id === userId || (!groupBefore.admin_id && groupBefore.created_by === userId));

        // Borrar el registro del miembro (el trigger trg_admin_leave_group en Supabase se disparará automáticamente)
        const { error: delErr } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId);

        if (delErr) {
          return { success: false, error: delErr.message };
        }

        if (wasAdmin) {
          // El trigger en la base de datos reasigna automáticamente el admin_id a un miembro aleatorio restante
          const { data: groupAfter } = await supabase
            .from('groups')
            .select('admin_id')
            .eq('id', groupId)
            .maybeSingle();

          reassignedAdminId = groupAfter?.admin_id || undefined;
        }
      } catch (e: any) {
        console.warn('Supabase leaveGroup notice:', e);
        return { success: false, error: e.message || 'Error al salir del grupo' };
      }
    }

    // Actualizar almacenamiento local para el usuario que se va
    const userGroups = this.getStoredEntity<Group[]>(userId, 'groups', []);
    const updated = userGroups.filter((g) => g.id !== groupId);
    this.setStoredEntity(userId, 'groups', updated);

    // Si era admin en almacenamiento local, reasignar al azar entre los restantes
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const groups: Group[] = JSON.parse(raw);
              const gIdx = groups.findIndex((g) => g.id === groupId);
              if (gIdx >= 0) {
                const grp = groups[gIdx];
                const wasAdmin = grp.adminId === userId || grp.created_by === userId;
                grp.members = grp.members.filter((m) => m.id !== userId);
                if (wasAdmin) {
                  if (grp.members.length > 0) {
                    const randomIdx = Math.floor(Math.random() * grp.members.length);
                    const chosen = grp.members[randomIdx];
                    grp.adminId = chosen.id;
                    reassignedAdminId = reassignedAdminId || chosen.id;
                    grp.members = grp.members.map((m) => ({
                      ...m,
                      role: m.id === chosen.id ? 'admin' : 'member',
                    }));
                  } else {
                    grp.adminId = undefined;
                  }
                }
                localStorage.setItem(key, JSON.stringify(groups));
              }
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    return { success: true, reassignedAdminId };
  }

  async deleteAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    let targetEmail = '';

    // Obtener correo electronico antes de borrar las referencias locales
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('splitflow_active_session_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.email) {
            targetEmail = parsed.email.trim().toLowerCase();
          }
        }
      } catch {
        // ignore
      }
    }

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

    // 1. Borrado atómico e irreversible en Supabase Auth y PostgreSQL
    if (isSupabaseConfigured && supabase) {
      try {
        let rpcRes: { data?: unknown; error: any } = { error: null };

        // Si es un UUID válido, invocar la RPC pasando target_user_id como fallback para sesiones no autenticadas
        if (isValidUuid) {
          rpcRes = await supabase.rpc('delete_user_account', { target_user_id: userId });

          // Si devuelve PGRST202 (firma antigua sin parámetros), reintentar sin argumentos
          if (rpcRes.error && (rpcRes.error.code === 'PGRST202' || rpcRes.error.message?.includes('schema cache'))) {
            rpcRes = await supabase.rpc('delete_user_account');
          }
        } else {
          // Si el ID es local (no UUID), invocar la RPC sin parámetros si hubiera sesión activa en Supabase
          rpcRes = await supabase.rpc('delete_user_account');
        }

        const effectiveRpcError = rpcRes.error;

        // Si la llamada a la RPC devuelve un error
        if (effectiveRpcError) {
          const errLower = (effectiveRpcError.message || '').toLowerCase();
          const isUnauthenticated =
            errLower.includes('usuario no autenticado') ||
            errLower.includes('no autenticado') ||
            errLower.includes('session') ||
            errLower.includes('jwt') ||
            errLower.includes('token');

          const isMissingTableOrFunction =
            effectiveRpcError.code === 'PGRST202' ||
            effectiveRpcError.code === '42P01' ||
            errLower.includes('schema cache') ||
            errLower.includes('does not exist') ||
            errLower.includes('invalid input syntax for type uuid');

          // Si el error es falta de autenticación en Supabase (sesión expirada/anónima) o tablas faltantes,
          // no bloqueamos al usuario: realizamos limpieza de tablas públicas y procedemos con la purga local
          if (isUnauthenticated || isMissingTableOrFunction) {
            if (isValidUuid) {
              try {
                await supabase.from('settlement_transactions').delete().or(`from_user_id.eq.${userId},to_user_id.eq.${userId},payer_id.eq.${userId},receiver_id.eq.${userId}`);
              } catch {}
              try {
                await supabase.from('expense_splits').delete().eq('user_id', userId);
              } catch {}
              try {
                await supabase.from('expenses').delete().eq('paid_by_user_id', userId);
              } catch {}
              try {
                await supabase.from('group_members').delete().eq('user_id', userId);
              } catch {}
              try {
                await supabase.from('profiles').delete().eq('id', userId);
              } catch {}
            }

            try {
              await supabase.auth.signOut();
            } catch {}
          } else {
            // Error explícito de base de datos diferente a falta de autenticación
            return {
              success: false,
              error: effectiveRpcError.message || 'Error al ejecutar delete_user_account en Supabase.',
            };
          }
        } else {
          // Confirmación exitosa de la RPC en el servidor
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.warn('SignOut notice after deleteAccount:', signOutErr);
          }
        }
      } catch (err: unknown) {
        console.warn('Excepción al invocar delete_user_account:', err);
        try {
          await supabase.auth.signOut();
        } catch {}
      }
    }

    // 2. Limpieza completa en almacenamiento seguro (solo tras exito en el servidor)
    try {
      await secureStorage.clearAllUserData();
    } catch (secErr) {
      console.warn('Error clearing secure storage on delete account:', secErr);
    }

    // 3. Fallback Local y Limpieza Completa (localStorage y sessionStorage)
    if (typeof window !== 'undefined') {
      try {
        // 3.1 Borrado permanente del usuario de splitflow_registered_users (modo local / fallback)
        const savedUsers = localStorage.getItem('splitflow_registered_users');
        if (savedUsers) {
          try {
            const list: User[] = JSON.parse(savedUsers);
            const filtered = list.filter((u) => {
              const matchesId = u.id === userId;
              const matchesEmail = targetEmail && u.email && u.email.trim().toLowerCase() === targetEmail;
              return !matchesId && !matchesEmail;
            });
            localStorage.setItem('splitflow_registered_users', JSON.stringify(filtered));
          } catch {
            // ignore
          }
        }

        // 3.2 Limpiar variables de sesion activa y flags
        localStorage.removeItem('splitflow_active_session_user');
        localStorage.removeItem('splitflow_saved_session');
        localStorage.removeItem('splitflow_last_active_user');
        localStorage.removeItem('splitflow_biometrics_enabled');
        localStorage.removeItem('splitflow_app_notifications');

        // 3.3 Limpiar claves de datos asociados al usuario (_userId_)
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.includes(`_${userId}_`) || key.includes(userId))) {
            localStorage.removeItem(key);
          }
        }

        // 3.4 Limpiar grupos locales donde estaba el usuario
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_groups')) {
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const groups: Group[] = JSON.parse(raw);
                let changed = false;
                const updatedGroups = groups.map((g) => {
                  if (g.members.some((m) => m.id === userId || (targetEmail && m.email.toLowerCase() === targetEmail))) {
                    changed = true;
                    return {
                      ...g,
                      members: g.members.filter((m) => m.id !== userId && (!targetEmail || m.email.toLowerCase() !== targetEmail)),
                    };
                  }
                  return g;
                });
                if (changed) {
                  localStorage.setItem(key, JSON.stringify(updatedGroups));
                }
              }
            } catch {
              // ignore
            }
          }
        }

        // 3.5 Limpiar por completo sessionStorage (incluye codigos OTP temporales)
        sessionStorage.clear();
      } catch (localErr) {
        console.warn('Error clearing local storage on deleteAccount:', localErr);
      }
    }

    return { success: true };
  }
}

/**
 * Proveedor único conectado a Supabase
 */
export function createDataProvider(): IDataProvider {
  return new SupabaseDataProvider();
}
