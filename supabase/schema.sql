-- ==============================================================================
-- SplitFlow — PostgreSQL Database Migration Schema (Supabase)
-- Gestor Inteligente de Gastos Compartidos y Presupuesto del Hogar
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE PERFILES (Extiende auth.users de Supabase con ON DELETE CASCADE)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  income NUMERIC(10, 2) DEFAULT NULL,
  monthly_income NUMERIC(10, 2) DEFAULT NULL,
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  email_notifications BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar compatibilidad si la tabla profiles ya fue migrada previamente
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN email_verified SET DEFAULT false;

-- Trigger para crear perfil automáticamente al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_initial_verified BOOLEAN;
BEGIN
  v_initial_verified := COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, false);

  INSERT INTO public.profiles (id, email, name, username, income, monthly_income, avatar_url, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), '@', '')),
    (NEW.raw_user_meta_data->>'monthly_income')::NUMERIC,
    (NEW.raw_user_meta_data->>'monthly_income')::NUMERIC,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'),
    v_initial_verified
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    username = EXCLUDED.username,
    income = COALESCE(EXCLUDED.income, public.profiles.income),
    monthly_income = COALESCE(EXCLUDED.monthly_income, public.profiles.monthly_income),
    email_verified = COALESCE(public.profiles.email_verified, EXCLUDED.email_verified);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sincronizar usuarios existentes previamente en auth.users hacia public.profiles
INSERT INTO public.profiles (id, email, name, username, income, monthly_income)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
  LOWER(REPLACE(COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)), '@', '')),
  (raw_user_meta_data->>'monthly_income')::NUMERIC,
  (raw_user_meta_data->>'monthly_income')::NUMERIC
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. TABLA DE GRUPOS
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'HOME' CHECK (category IN ('HOME', 'TRIP', 'COUPLE', 'EVENT', 'OTHER')),
  currency TEXT DEFAULT 'EUR',
  category_icon TEXT DEFAULT 'HOME',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  codigo_grupo TEXT,
  invite_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para asignar admin_id por defecto al creador en nuevos grupos
CREATE OR REPLACE FUNCTION public.handle_new_group_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.admin_id IS NULL THEN
    NEW.admin_id := NEW.created_by;
  END IF;
  IF NEW.codigo_grupo IS NULL AND NEW.invite_code IS NOT NULL THEN
    NEW.codigo_grupo := NEW.invite_code;
  END IF;
  IF NEW.invite_code IS NULL AND NEW.codigo_grupo IS NOT NULL THEN
    NEW.invite_code := NEW.codigo_grupo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_new_group_admin ON public.groups;
CREATE TRIGGER trg_new_group_admin
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_group_admin();


-- 4. TABLA DE MIEMBROS DE GRUPO (Relación N:M)
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- 5. TABLA DE GASTOS
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  paid_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('HOUSING', 'FOOD', 'ENTERTAINMENT', 'UTILITIES', 'TRANSPORT', 'OTHER')),
  split_type TEXT NOT NULL CHECK (split_type IN ('EQUAL', 'PERCENTAGE', 'EXACT', 'INCOME_PROPORTIONAL')),
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE DESGLOSE DE REPARTOS POR GASTO (Splits)
CREATE TABLE IF NOT EXISTS public.expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  percentage NUMERIC(5, 2),
  UNIQUE(expense_id, user_id)
);

-- 7. TABLA DE PRESUPUESTOS MENSUALES POR CATEGORÍA
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('HOUSING', 'FOOD', 'ENTERTAINMENT', 'UTILITIES', 'TRANSPORT', 'OTHER')),
  monthly_limit NUMERIC(10, 2) NOT NULL CHECK (monthly_limit > 0),
  UNIQUE(group_id, category)
);

-- 8. TABLA DE LIQUIDACIONES Y PAGOS SALDADOS
CREATE TABLE IF NOT EXISTS public.settlement_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  settled BOOLEAN DEFAULT TRUE,
  is_settled BOOLEAN DEFAULT TRUE,
  currency TEXT DEFAULT 'EUR',
  settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. SEGURIDAD A NIVEL DE FILA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles: Un usuario solo puede ver su propio perfil o el de miembros con los que comparte grupo
CREATE POLICY "Profiles viewable by self or group peers"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Funciones Auxiliares SECURITY DEFINER para evitar la recursión infinita en RLS
CREATE OR REPLACE FUNCTION public.check_is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id AND (admin_id = p_user_id OR created_by = p_user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

-- Políticas para Grupos: Visibles únicamente para los miembros del grupo
CREATE POLICY "groups_select_policy"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR admin_id = auth.uid() 
    OR public.check_is_group_member(id, auth.uid())
  );

CREATE POLICY "groups_insert_policy"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update_policy"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR admin_id = auth.uid() 
    OR public.check_is_group_admin(id, auth.uid())
  );

-- Políticas para Miembros de Grupo: Aislamiento estricto sin recursión
CREATE POLICY "group_members_select_policy"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.check_is_group_member(group_id, auth.uid())
  );

CREATE POLICY "group_members_insert_policy"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    OR public.check_is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "group_members_update_policy"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.check_is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "group_members_delete_policy"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.check_is_group_admin(group_id, auth.uid())
  );

-- Políticas para Gastos: Los miembros del grupo pueden ver y registrar gastos
CREATE POLICY "expenses_select_policy"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    paid_by_user_id = auth.uid() 
    OR public.check_is_group_member(group_id, auth.uid())
  );

CREATE POLICY "expenses_insert_policy"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_is_group_member(group_id, auth.uid())
  );

CREATE POLICY "expenses_update_policy"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (
    paid_by_user_id = auth.uid() 
    OR public.check_is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "expenses_delete_policy"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (
    paid_by_user_id = auth.uid() 
    OR public.check_is_group_admin(group_id, auth.uid())
  );

-- Políticas para Expense Splits: Solo accesibles a través del grupo del gasto
CREATE POLICY "splits_select_policy"
  ON public.expense_splits FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id
      AND public.check_is_group_member(e.group_id, auth.uid())
    )
  );

CREATE POLICY "splits_insert_policy"
  ON public.expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id
      AND public.check_is_group_member(e.group_id, auth.uid())
    )
  );

-- Políticas para Budgets: Aislamiento por grupo
CREATE POLICY "budgets_select_policy"
  ON public.budgets FOR SELECT
  TO authenticated
  USING (
    public.check_is_group_member(group_id, auth.uid())
  );

CREATE POLICY "budgets_manage_policy"
  ON public.budgets FOR ALL
  TO authenticated
  USING (
    public.check_is_group_member(group_id, auth.uid())
  );

-- Políticas para Liquidaciones (Settlements): Aislamiento por grupo
CREATE POLICY "settlements_select_policy"
  ON public.settlement_transactions FOR SELECT
  TO authenticated
  USING (
    from_user_id = auth.uid() 
    OR to_user_id = auth.uid() 
    OR payer_id = auth.uid() 
    OR receiver_id = auth.uid() 
    OR public.check_is_group_member(group_id, auth.uid())
  );

CREATE POLICY "settlements_insert_policy"
  ON public.settlement_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    from_user_id = auth.uid() 
    OR payer_id = auth.uid() 
    OR public.check_is_group_member(group_id, auth.uid())
  );

-- ==============================================================================
-- 10. FUNCIONES RPC SEGURAS Y PRIVACIDAD PARA BÚSQUEDA Y SUGERENCIAS
-- ==============================================================================

-- Índices de aceleración para búsqueda predictiva y resolución de contactos
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_group_members_user_group ON public.group_members (user_id, group_id);

-- Función RPC para sugerencias rápidas de contactos previos
-- Obtiene usuarios con los que el usuario activo comparte o ha compartido algún grupo
-- Devuelve ÚNICAMENTE id y username público, protegiendo correos o datos privados
CREATE OR REPLACE FUNCTION public.get_contact_suggestions(
  current_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  shared_groups_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    p.id, 
    p.username,
    COUNT(DISTINCT gm2.group_id) AS shared_groups_count
  FROM public.group_members gm1
  JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
  JOIN public.profiles p ON gm2.user_id = p.id
  WHERE gm1.user_id = COALESCE(current_user_id, auth.uid())
    AND gm2.user_id != COALESCE(current_user_id, auth.uid())
    AND p.username IS NOT NULL
  GROUP BY p.id, p.username
  ORDER BY shared_groups_count DESC, p.username ASC
  LIMIT 20;
$$;

-- Función RPC para búsqueda predictiva (autocomplete) segura por username
-- Devuelve únicamente id y username público para cumplir aislamiento estricto y privacidad
CREATE OR REPLACE FUNCTION public.search_public_users(
  search_query TEXT,
  max_results INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  username TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.username
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND p.username ILIKE ('%' || search_query || '%')
    AND p.id != auth.uid()
  ORDER BY 
    CASE WHEN p.username ILIKE (search_query || '%') THEN 0 ELSE 1 END,
    p.username ASC
  LIMIT LEAST(max_results, 25);
$$;

-- ==============================================================================
-- 11. FUNCIÓN RPC PARA ELIMINACIÓN PERMANENTE DE CUENTA (DELETE ACCOUNT)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.delete_user_account();
DROP FUNCTION IF EXISTS public.delete_user_account(uuid);
DROP FUNCTION IF EXISTS public.delete_user_account(text);

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- 1. Obtener el ID del usuario: desde auth.uid() de la sesión JWT o target_user_id
  current_user_id := COALESCE(auth.uid(), target_user_id);
  
  -- 2. Si auth.uid() está presente, evitar borrar a un usuario distinto
  IF auth.uid() IS NOT NULL AND target_user_id IS NOT NULL AND auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'No autorizado para eliminar esta cuenta.';
  END IF;

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado o ID no especificado.';
  END IF;

  -- 3. Eliminar desgloses de gastos asignados al usuario (splits) si la tabla existe
  IF to_regclass('public.expense_splits') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.expense_splits WHERE user_id = $1' USING current_user_id;
  END IF;

  -- 4. Eliminar liquidaciones/pagos donde participa el usuario si la tabla existe
  IF to_regclass('public.settlement_transactions') IS NOT NULL THEN
    BEGIN
      EXECUTE 'DELETE FROM public.settlement_transactions WHERE payer_id = $1 OR receiver_id = $1' USING current_user_id;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'DELETE FROM public.settlement_transactions WHERE from_user_id = $1 OR to_user_id = $1' USING current_user_id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;

  -- 5. Eliminar gastos registrados/pagados por el usuario si la tabla existe
  IF to_regclass('public.expenses') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.expenses WHERE paid_by_user_id = $1' USING current_user_id;
  END IF;

  -- 6. Eliminar membresías de grupos del usuario si la tabla existe
  IF to_regclass('public.group_members') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.group_members WHERE user_id = $1' USING current_user_id;
  END IF;

  -- 7. Eliminar grupos creados por el usuario que hayan quedado sin integrantes si existen
  IF to_regclass('public.groups') IS NOT NULL AND to_regclass('public.group_members') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.groups WHERE created_by = $1 AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = groups.id)' USING current_user_id;
  END IF;

  -- 8. Eliminar registro del perfil en la tabla pública si existe
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.profiles WHERE id = $1' USING current_user_id;
  END IF;

  -- 9. Eliminar definitivamente el usuario de la tabla interna auth.users
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Otorgar permisos de ejecución para anon y authenticated
REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO anon, authenticated;

-- Función para resolver correo a partir del nombre de usuario en el login
CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email FROM public.profiles WHERE LOWER(username) = LOWER(p_username) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated;

-- Trigger para reasignación automática de admin al abandonar el grupo con notificación interna
CREATE OR REPLACE FUNCTION public.handle_admin_leave_group()
CREATE OR REPLACE FUNCTION public.handle_admin_leave_group()
RETURNS TRIGGER AS $$
DECLARE
  v_next_admin_id UUID;
  v_group_name TEXT;
  v_was_supreme BOOLEAN;
BEGIN
  SELECT (admin_id = OLD.user_id), name INTO v_was_supreme, v_group_name 
  FROM public.groups 
  WHERE id = OLD.group_id;

  IF v_was_supreme THEN
    -- Intentar reasignar primero a otro administrador existente
    SELECT user_id INTO v_next_admin_id
    FROM public.group_members
    WHERE group_id = OLD.group_id AND user_id <> OLD.user_id AND role = 'admin'
    ORDER BY random()
    LIMIT 1;

    -- Si no hay otros administradores, reasignar a cualquier miembro restante
    IF v_next_admin_id IS NULL THEN
      SELECT user_id INTO v_next_admin_id
      FROM public.group_members
      WHERE group_id = OLD.group_id AND user_id <> OLD.user_id
      ORDER BY random()
      LIMIT 1;
    END IF;

    UPDATE public.groups
    SET admin_id = v_next_admin_id
    WHERE id = OLD.group_id;

    IF v_next_admin_id IS NOT NULL THEN
      UPDATE public.group_members
      SET role = 'admin'
      WHERE group_id = OLD.group_id AND user_id = v_next_admin_id;

      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        group_id,
        group_name,
        target_id
      ) VALUES (
        v_next_admin_id,
        'ADMIN_PROMOTED',
        '¡Nuevo Administrador Supremo!',
        '¡Has sido designado como el nuevo Administrador Supremo del grupo "' || COALESCE(v_group_name, '') || '" tras la salida del administrador previo!',
        OLD.group_id,
        v_group_name,
        v_next_admin_id::text
      );
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_admin_leave_group ON public.group_members;
CREATE TRIGGER trg_admin_leave_group
  AFTER DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_leave_group();

-- 1. Función RPC para promover a administrador (hasta 4 por grupo)
CREATE OR REPLACE FUNCTION public.promote_group_admin(
  p_group_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_supreme_admin_id UUID;
  v_group_name TEXT;
  v_admin_count INT;
  v_target_profile RECORD;
BEGIN
  v_caller_id := auth.uid();

  SELECT admin_id, name INTO v_supreme_admin_id, v_group_name
  FROM public.groups
  WHERE id = p_group_id;

  IF v_caller_id IS NOT NULL AND v_supreme_admin_id IS NOT NULL AND v_caller_id <> v_supreme_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado: Solo el administrador supremo o creador del grupo puede nombrar nuevos administradores.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El usuario seleccionado no forma parte de este grupo.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_target_user_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este usuario ya es administrador del grupo.');
  END IF;

  SELECT count(DISTINCT user_id) INTO v_admin_count
  FROM public.group_members
  WHERE group_id = p_group_id AND (role = 'admin' OR user_id = v_supreme_admin_id);

  IF v_admin_count >= 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Límite alcanzado: Un grupo puede tener un máximo de 4 administradores simultáneos.');
  END IF;

  UPDATE public.group_members
  SET role = 'admin'
  WHERE group_id = p_group_id AND user_id = p_target_user_id;

  SELECT id, name, username, email INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_user_id;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    group_id,
    group_name,
    target_id
  ) VALUES (
    p_target_user_id,
    'ADMIN_PROMOTED',
    '¡Ascendido a Administrador!',
    '¡Has sido nombrado como administrador del grupo "' || COALESCE(v_group_name, '') || '"! Ahora puedes gestionar miembros, invitar personas y ver el código del grupo.',
    p_group_id,
    v_group_name,
    p_target_user_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'groupId', p_group_id,
    'targetUserId', p_target_user_id,
    'targetName', v_target_profile.name,
    'targetEmail', v_target_profile.email,
    'adminCount', v_admin_count + 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.promote_group_admin(UUID, UUID) TO authenticated, anon;

-- 2. Función RPC para revocar la capacidad de admin a un administrador
CREATE OR REPLACE FUNCTION public.revoke_group_admin(
  p_group_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_supreme_admin_id UUID;
  v_group_name TEXT;
  v_target_profile RECORD;
BEGIN
  v_caller_id := auth.uid();

  SELECT admin_id, name INTO v_supreme_admin_id, v_group_name
  FROM public.groups
  WHERE id = p_group_id;

  IF v_caller_id IS NOT NULL AND v_supreme_admin_id IS NOT NULL AND v_caller_id <> v_supreme_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado: Solo el administrador supremo puede revocar el rol de administrador.');
  END IF;

  IF p_target_user_id = v_supreme_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede revocar el rol al administrador supremo del grupo.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El usuario no forma parte de este grupo.');
  END IF;

  UPDATE public.group_members
  SET role = 'member'
  WHERE group_id = p_group_id AND user_id = p_target_user_id;

  SELECT id, name, username, email INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_user_id;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    group_id,
    group_name,
    target_id
  ) VALUES (
    p_target_user_id,
    'ADMIN_PROMOTED',
    'Rol de administrador revocado',
    'Tu capacidad de administrador en el grupo "' || COALESCE(v_group_name, '') || '" ha sido revocada por el administrador supremo.',
    p_group_id,
    v_group_name,
    p_target_user_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'groupId', p_group_id,
    'targetUserId', p_target_user_id,
    'targetName', v_target_profile.name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_group_admin(UUID, UUID) TO authenticated, anon;

-- 3. Función RPC para transferir el Admin Supremo
CREATE OR REPLACE FUNCTION public.transfer_supreme_admin(
  p_group_id UUID,
  p_new_supreme_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_current_supreme_id UUID;
  v_group_name TEXT;
  v_new_profile RECORD;
BEGIN
  v_caller_id := auth.uid();

  SELECT admin_id, name INTO v_current_supreme_id, v_group_name
  FROM public.groups
  WHERE id = p_group_id;

  IF v_caller_id IS NOT NULL AND v_current_supreme_id IS NOT NULL AND v_caller_id <> v_current_supreme_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado: Solo el administrador supremo actual puede transferir la jefatura suprema.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_new_supreme_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El nuevo administrador supremo debe ser un miembro activo del grupo.');
  END IF;

  UPDATE public.groups
  SET admin_id = p_new_supreme_admin_id
  WHERE id = p_group_id;

  UPDATE public.group_members
  SET role = 'admin'
  WHERE group_id = p_group_id AND user_id = p_new_supreme_admin_id;

  SELECT id, name, username, email INTO v_new_profile
  FROM public.profiles
  WHERE id = p_new_supreme_admin_id;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    group_id,
    group_name,
    target_id
  ) VALUES (
    p_new_supreme_admin_id,
    'ADMIN_PROMOTED',
    '¡Nuevo Administrador Supremo!',
    '¡Has sido designado como el Administrador Supremo del grupo "' || COALESCE(v_group_name, '') || '"! Tienes control total para gestionar y revocar administradores.',
    p_group_id,
    v_group_name,
    p_new_supreme_admin_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'groupId', p_group_id,
    'newSupremeAdminId', p_new_supreme_admin_id,
    'newSupremeAdminName', v_new_profile.name,
    'newSupremeAdminEmail', v_new_profile.email
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.transfer_supreme_admin(UUID, UUID) TO authenticated, anon;

-- 4. Función RPC para eliminar integrantes del grupo (solo administradores)
CREATE OR REPLACE FUNCTION public.remove_group_member(
  p_group_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_supreme_admin_id UUID;
  v_is_caller_admin BOOLEAN;
  v_target_role TEXT;
  v_group_name TEXT;
  v_target_profile RECORD;
BEGIN
  v_caller_id := auth.uid();

  SELECT admin_id, name INTO v_supreme_admin_id, v_group_name
  FROM public.groups
  WHERE id = p_group_id;

  SELECT (v_caller_id = v_supreme_admin_id) OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = v_caller_id AND role = 'admin'
  ) INTO v_is_caller_admin;

  IF v_caller_id IS NOT NULL AND NOT v_is_caller_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado: Solo los administradores pueden eliminar integrantes del grupo.');
  END IF;

  IF v_caller_id IS NOT NULL AND v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes eliminarte a ti mismo mediante esta opción. Utiliza la opción "Salir del grupo".');
  END IF;

  IF p_target_user_id = v_supreme_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede eliminar al administrador supremo o creador del grupo.');
  END IF;

  SELECT role INTO v_target_role
  FROM public.group_members
  WHERE group_id = p_group_id AND user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'El usuario no es miembro de este grupo.');
  END IF;

  IF v_caller_id IS NOT NULL AND v_caller_id <> v_supreme_admin_id AND v_target_role = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un administrador no puede eliminar a otro administrador. Solo el Administrador Supremo tiene esta potestad.');
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = p_group_id AND user_id = p_target_user_id;

  SELECT id, name, username, email INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_user_id;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    group_id,
    group_name,
    target_id
  ) VALUES (
    p_target_user_id,
    'BUDGET_ALERT',
    'Has sido eliminado del grupo',
    'Has sido eliminado del grupo "' || COALESCE(v_group_name, '') || '" por un administrador.',
    p_group_id,
    v_group_name,
    p_target_user_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'groupId', p_group_id,
    'removedUserId', p_target_user_id,
    'removedUserName', v_target_profile.name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_group_member(UUID, UUID) TO authenticated, anon;

-- Retrocompatibilidad con transfer_group_admin
CREATE OR REPLACE FUNCTION public.transfer_group_admin(
  p_group_id UUID,
  p_new_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.transfer_supreme_admin(p_group_id, p_new_admin_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.transfer_group_admin(UUID, UUID) TO authenticated, anon;

-- 5. Función RPC segura para consultar el código de invitación del grupo (visible por cualquier admin)
CREATE OR REPLACE FUNCTION public.get_group_invite_code(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller_id UUID;
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_code TEXT;
BEGIN
  v_caller_id := auth.uid();
  SELECT admin_id, COALESCE(codigo_grupo, invite_code) INTO v_admin_id, v_code
  FROM public.groups
  WHERE id = p_group_id;

  IF v_caller_id IS NOT NULL THEN
    SELECT (v_caller_id = v_admin_id) OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = p_group_id AND user_id = v_caller_id AND role = 'admin'
    ) INTO v_is_admin;

    IF v_is_admin THEN
      RETURN v_code;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_invite_code(UUID) TO authenticated, anon;

-- 6. Función RPC segura para obtener los grupos de un usuario sin recursión RLS
-- y protegiendo el código de grupo para que solo los administradores puedan consultarlo
CREATE OR REPLACE FUNCTION public.get_user_groups(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', COALESCE(g.description, ''),
        'category', COALESCE(g.category, 'HOME'),
        'currency', COALESCE(g.currency, 'EUR'),
        'adminId', COALESCE(g.admin_id, g.created_by),
        'created_by', g.created_by,
        'createdAt', g.created_at,
        'budgetBlocks', g.budget_blocks,
        'incomeModuleEnabled', COALESCE(g.income_module_enabled, false),
        'inviteCode', CASE WHEN (g.admin_id = p_user_id OR EXISTS(SELECT 1 FROM public.group_members gm_adm WHERE gm_adm.group_id = g.id AND gm_adm.user_id = p_user_id AND gm_adm.role = 'admin'))
                           THEN COALESCE(g.codigo_grupo, g.invite_code, 'SF-' || UPPER(SUBSTRING(g.id::text FROM 1 FOR 6)))
                           ELSE NULL END,
        'codigoGrupo', CASE WHEN (g.admin_id = p_user_id OR EXISTS(SELECT 1 FROM public.group_members gm_adm WHERE gm_adm.group_id = g.id AND gm_adm.user_id = p_user_id AND gm_adm.role = 'admin'))
                            THEN COALESCE(g.codigo_grupo, g.invite_code, 'SF-' || UPPER(SUBSTRING(g.id::text FROM 1 FOR 6)))
                            ELSE NULL END,
        'members', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'name', COALESCE(p.name, 'Miembro'),
              'username', p.username,
              'email', COALESCE(p.email, ''),
              'monthlyIncome', p.monthly_income,
              'role', CASE WHEN p.id = COALESCE(g.admin_id, g.created_by) OR gm.role = 'admin' THEN 'admin' ELSE 'member' END
            )
          )
          FROM public.group_members gm
          JOIN public.profiles p ON p.id = gm.user_id
          WHERE gm.group_id = g.id
        ), '[]'::jsonb)
      )
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM public.groups g
  WHERE EXISTS (
    SELECT 1 FROM public.group_members gm2
    WHERE gm2.group_id = g.id AND gm2.user_id = p_user_id
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_groups(UUID) TO authenticated, anon;

-- Función RPC para obtener gastos de un grupo con desgloses incluidos
CREATE OR REPLACE FUNCTION public.get_group_expenses(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'groupId', e.group_id,
        'description', e.description,
        'amount', e.amount,
        'paidByUserId', e.paid_by_user_id,
        'category', e.category,
        'splitType', e.split_type,
        'notes', e.notes,
        'createdAt', e.created_at,
        'splits', COALESCE(
          e.splits,
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'userId', es.user_id,
                'amount', es.amount,
                'percentage', es.percentage
              )
            )
            FROM public.expense_splits es
            WHERE es.expense_id = e.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY e.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM public.expenses e
  WHERE e.group_id = p_group_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_expenses(UUID) TO authenticated, anon;

-- Función RPC para auto-confirmar correo de usuario si el mailer de Supabase quedara pendiente
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE lower(email) = lower(trim(p_email));
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_confirm_user_email(TEXT) TO anon, authenticated;

-- ==============================================================================
-- SISTEMA DE RECUPERACIÓN DE CONTRASEÑA OFICIAL (SplitflowNoReplay@gmail.com)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email_code 
  ON public.password_reset_codes (lower(email), code, is_used);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Política de RLS: solo accesible vía funciones SECURITY DEFINER
DROP POLICY IF EXISTS "No direct public access to reset codes" ON public.password_reset_codes;
CREATE POLICY "No direct public access to reset codes" 
  ON public.password_reset_codes 
  FOR ALL 
  USING (false);

-- 1. Función RPC para solicitar código aleatorio de 6 dígitos
CREATE OR REPLACE FUNCTION public.request_password_reset_code(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_input TEXT;
  v_user_email TEXT;
  v_user_name TEXT;
  v_code TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_input := lower(trim(p_identifier));
  IF v_input IS NULL OR v_input = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificador inválido');
  END IF;

  -- Determinar si el usuario introdujo un correo o un nombre de usuario (@)
  IF v_input LIKE '%@%.%' THEN
    v_user_email := v_input;
    SELECT name INTO v_user_name FROM public.profiles WHERE lower(email) = v_user_email LIMIT 1;
  ELSE
    v_input := replace(v_input, '@', '');
    SELECT email, name INTO v_user_email, v_user_name 
    FROM public.profiles 
    WHERE lower(username) = v_input 
    LIMIT 1;
  END IF;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No existe ninguna cuenta asociada a este usuario o correo');
  END IF;

  -- Invalidar códigos anteriores no utilizados
  UPDATE public.password_reset_codes
  SET is_used = true
  WHERE lower(email) = lower(v_user_email) AND is_used = false;

  -- Generar código aleatorio criptográfico de 6 dígitos
  v_code := lpad((floor(random() * 900000) + 100000)::text, 6, '0');
  v_expires := now() + interval '15 minutes';

  INSERT INTO public.password_reset_codes (email, code, expires_at, is_used)
  VALUES (v_user_email, v_code, v_expires, false);

  RETURN jsonb_build_object(
    'success', true,
    'email', v_user_email,
    'name', COALESCE(v_user_name, split_part(v_user_email, '@', 1)),
    'code', v_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_password_reset_code(TEXT) TO anon, authenticated;

-- 2. Función RPC para verificar código de 6 dígitos
CREATE OR REPLACE FUNCTION public.verify_password_reset_code(p_email TEXT, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.password_reset_codes
    WHERE lower(email) = lower(trim(p_email))
      AND code = trim(p_code)
      AND is_used = false
      AND expires_at > now()
  ) INTO v_valid;

  IF v_valid THEN
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Código de verificación incorrecto o expirado');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_password_reset_code(TEXT, TEXT) TO anon, authenticated;

-- 3. Función RPC para completar el cambio de contraseña
CREATE OR REPLACE FUNCTION public.complete_password_reset(
  p_email TEXT,
  p_code TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_code_id UUID;
  v_user_id UUID;
  v_hashed_password TEXT;
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La contraseña debe tener al menos 6 caracteres');
  END IF;

  SELECT id INTO v_code_id
  FROM public.password_reset_codes
  WHERE lower(email) = lower(trim(p_email))
    AND code = trim(p_code)
    AND is_used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código de verificación inválido o expirado');
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  -- Generar hash bcrypt idéntico a Supabase
  v_hashed_password := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));

  UPDATE auth.users
  SET encrypted_password = v_hashed_password,
      updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.password_reset_codes
  SET is_used = true
  WHERE id = v_code_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_password_reset(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- SISTEMA DE VERIFICACIÓN DE CORREO AL CREAR CUENTA (SplitflowNoReplay@gmail.com)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_lookup
  ON public.email_verification_tokens (token, lower(email), is_used);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct public access to verification tokens" ON public.email_verification_tokens;
CREATE POLICY "No direct public access to verification tokens"
  ON public.email_verification_tokens
  FOR ALL
  USING (false);

CREATE OR REPLACE FUNCTION public.request_email_verification_token(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_email TEXT;
  v_user_id UUID;
  v_user_name TEXT;
  v_username TEXT;
  v_is_verified BOOLEAN;
  v_token TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_clean_email := lower(trim(p_email));
  IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Correo electrónico no válido.');
  END IF;

  SELECT p.id, p.name, p.username, COALESCE(p.email_verified, false)
  INTO v_user_id, v_user_name, v_username, v_is_verified
  FROM public.profiles p
  WHERE lower(p.email) = v_clean_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT u.id,
           COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
           LOWER(REPLACE(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)), '@', '')),
           false
    INTO v_user_id, v_user_name, v_username, v_is_verified
    FROM auth.users u
    WHERE lower(u.email) = v_clean_email
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.profiles (id, email, name, username, email_verified)
      VALUES (
        v_user_id,
        v_clean_email,
        COALESCE(v_user_name, split_part(v_clean_email, '@', 1)),
        v_username,
        false
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontró ninguna cuenta asociada a este correo electrónico.');
  END IF;

  IF v_is_verified = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_verified', true,
      'email', v_clean_email,
      'name', COALESCE(v_user_name, split_part(v_clean_email, '@', 1)),
      'username', v_username
    );
  END IF;

  UPDATE public.email_verification_tokens
  SET is_used = true
  WHERE lower(email) = v_clean_email AND is_used = false;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '24 hours';

  INSERT INTO public.email_verification_tokens (user_id, email, token, expires_at, is_used)
  VALUES (v_user_id, v_clean_email, v_token, v_expires, false);

  UPDATE public.profiles
  SET email_verified = false, updated_at = now()
  WHERE id = v_user_id AND (email_verified IS NULL OR email_verified = false);

  RETURN jsonb_build_object(
    'success', true,
    'already_verified', false,
    'token', v_token,
    'email', v_clean_email,
    'name', COALESCE(v_user_name, split_part(v_clean_email, '@', 1)),
    'username', v_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_email_verification_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_email_token(p_email TEXT, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_email TEXT;
  v_clean_token TEXT;
  v_rec RECORD;
  v_profile RECORD;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  v_clean_token := trim(COALESCE(p_token, ''));

  IF v_clean_token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token de verificación no proporcionado.');
  END IF;

  SELECT *
  INTO v_rec
  FROM public.email_verification_tokens
  WHERE token = v_clean_token
    AND (v_clean_email = '' OR lower(email) = v_clean_email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'El enlace de verificación no es válido o ha sido revocado.');
  END IF;

  SELECT id, email, username, name, COALESCE(email_verified, false) AS email_verified
  INTO v_profile
  FROM public.profiles
  WHERE lower(email) = lower(v_rec.email)
  LIMIT 1;

  IF v_profile.id IS NOT NULL AND v_profile.email_verified = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_verified', true,
      'email', v_rec.email,
      'username', v_profile.username,
      'name', v_profile.name
    );
  END IF;

  IF v_rec.is_used = true OR v_rec.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este enlace de verificación ha expirado o ya fue utilizado. Solicita uno nuevo desde la pantalla de inicio de sesión.');
  END IF;

  UPDATE public.profiles
  SET email_verified = true,
      updated_at = now()
  WHERE lower(email) = lower(v_rec.email);

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE lower(email) = lower(v_rec.email);

  UPDATE public.email_verification_tokens
  SET is_used = true
  WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'success', true,
    'already_verified', false,
    'email', v_rec.email,
    'username', v_profile.username,
    'name', v_profile.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_email_token(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_login_account_status(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_username TEXT;
  v_profile RECORD;
BEGIN
  v_clean_username := LOWER(REPLACE(TRIM(COALESCE(p_username, '')), '@', ''));
  IF v_clean_username = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT id, email, username, COALESCE(email_verified, true) AS email_verified
  INTO v_profile
  FROM public.profiles
  WHERE LOWER(username) = v_clean_username
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'email', v_profile.email,
    'username', v_profile.username,
    'email_verified', v_profile.email_verified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_account_status(TEXT) TO anon, authenticated;

-- Forzar recarga inmediata de la caché de esquemas de PostgREST
NOTIFY pgrst, 'reload schema';




