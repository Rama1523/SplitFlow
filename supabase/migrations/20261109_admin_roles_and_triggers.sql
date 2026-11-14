-- ==============================================================================
-- SplitFlow — Migración de Roles de Administrador, Triggers y Visibilidad de Código
-- ==============================================================================

-- 1. Añadir columnas admin_id y codigo_grupo a public.groups si no existen
ALTER TABLE public.groups 
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo_grupo TEXT,
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 2. Asegurar que los grupos existentes tengan admin_id (usando created_by como fallback)
UPDATE public.groups
SET admin_id = created_by
WHERE admin_id IS NULL AND created_by IS NOT NULL;

-- 3. Asegurar que los miembros creadores tengan role = 'admin' en group_members
UPDATE public.group_members gm
SET role = 'admin'
FROM public.groups g
WHERE gm.group_id = g.id AND gm.user_id = g.admin_id;

-- 4. Trigger para asignar admin_id por defecto al creador en nuevos grupos
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

-- 5. Trigger para reasignación automática de admin al abandonar el grupo
CREATE OR REPLACE FUNCTION public.handle_admin_leave_group()
RETURNS TRIGGER AS $$
DECLARE
  v_next_admin_id UUID;
BEGIN
  -- Comprobar si el usuario eliminado era el admin actual del grupo
  IF EXISTS (SELECT 1 FROM public.groups WHERE id = OLD.group_id AND admin_id = OLD.user_id) THEN
    -- Seleccionar un usuario aleatorio entre los miembros restantes del grupo
    SELECT user_id INTO v_next_admin_id
    FROM public.group_members
    WHERE group_id = OLD.group_id AND user_id <> OLD.user_id
    ORDER BY random()
    LIMIT 1;

    -- Actualizar admin_id en public.groups
    UPDATE public.groups
    SET admin_id = v_next_admin_id
    WHERE id = OLD.group_id;

    -- Si quedan miembros, actualizar el rol del nuevo admin a 'admin'
    IF v_next_admin_id IS NOT NULL THEN
      UPDATE public.group_members
      SET role = 'admin'
      WHERE group_id = OLD.group_id AND user_id = v_next_admin_id;
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

-- 6. Función RPC para transferir el rol de administrador
CREATE OR REPLACE FUNCTION public.transfer_group_admin(
  p_group_id UUID,
  p_new_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_current_admin_id UUID;
  v_new_admin_profile RECORD;
BEGIN
  v_caller_id := auth.uid();

  -- Obtener admin actual
  SELECT admin_id INTO v_current_admin_id
  FROM public.groups
  WHERE id = p_group_id;

  -- Validar permisos: solo el admin actual puede transferir
  IF v_caller_id IS NOT NULL AND v_current_admin_id IS NOT NULL AND v_caller_id <> v_current_admin_id THEN
    RAISE EXCEPTION 'No autorizado: Solo el administrador actual del grupo puede transferir el cargo.';
  END IF;

  -- Validar que el candidato sea miembro activo del grupo
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_new_admin_id) THEN
    RAISE EXCEPTION 'El nuevo administrador debe ser un miembro activo del grupo.';
  END IF;

  -- Actualizar admin_id en el grupo
  UPDATE public.groups
  SET admin_id = p_new_admin_id
  WHERE id = p_group_id;

  -- Actualizar roles en group_members
  IF v_current_admin_id IS NOT NULL THEN
    UPDATE public.group_members
    SET role = 'member'
    WHERE group_id = p_group_id AND user_id = v_current_admin_id;
  END IF;

  UPDATE public.group_members
  SET role = 'admin'
  WHERE group_id = p_group_id AND user_id = p_new_admin_id;

  SELECT id, name, username, email INTO v_new_admin_profile
  FROM public.profiles
  WHERE id = p_new_admin_id;

  RETURN jsonb_build_object(
    'success', true,
    'groupId', p_group_id,
    'previousAdminId', v_current_admin_id,
    'newAdminId', p_new_admin_id,
    'newAdminName', v_new_admin_profile.name,
    'newAdminEmail', v_new_admin_profile.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_group_admin(UUID, UUID) TO authenticated, anon;

-- 7. Función RPC segura para consultar el código de invitación del grupo (solo visible por el admin)
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
  v_code TEXT;
BEGIN
  v_caller_id := auth.uid();
  SELECT admin_id, COALESCE(codigo_grupo, invite_code) INTO v_admin_id, v_code
  FROM public.groups
  WHERE id = p_group_id;

  -- Si el usuario actual es el admin del grupo, devolver el código
  IF v_caller_id IS NOT NULL AND v_admin_id IS NOT NULL AND v_caller_id = v_admin_id THEN
    RETURN v_code;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_invite_code(UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
