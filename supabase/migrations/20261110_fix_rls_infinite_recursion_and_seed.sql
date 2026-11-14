-- ============================================================================
-- SplitFlow — Migration: Fix RLS Infinite Recursion and Seed Real Database Data
-- ============================================================================

-- 1. Asegurar columnas requeridas en public.groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS budget_blocks JSONB;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS income_module_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS codigo_grupo TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 2. Asegurar columnas requeridas en public.settlement_transactions
ALTER TABLE public.settlement_transactions ADD COLUMN IF NOT EXISTS from_user_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.settlement_transactions ADD COLUMN IF NOT EXISTS to_user_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.settlement_transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE public.settlement_transactions ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.settlement_transactions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.settlement_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'BIZUM';

-- 3. Asegurar columnas requeridas en public.expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS splits JSONB;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

-- 4. Funciones Auxiliares SECURITY DEFINER para evitar la recursión infinita en RLS
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

-- 5. Eliminar todas las políticas existentes que causan recursión infinita en group_members, groups, expenses, settlements
DROP POLICY IF EXISTS "Group members viewable by peers in same group" ON public.group_members;
DROP POLICY IF EXISTS "Group admins or creators can manage members" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select_policy" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_policy" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update_policy" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete_policy" ON public.group_members;

DROP POLICY IF EXISTS "Groups viewable by members" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "groups_select_policy" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_policy" ON public.groups;
DROP POLICY IF EXISTS "groups_update_policy" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_policy" ON public.groups;

DROP POLICY IF EXISTS "Expenses viewable by group members" ON public.expenses;
DROP POLICY IF EXISTS "Group members can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Expense creators can delete their expenses" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;

DROP POLICY IF EXISTS "Settlements viewable by group members" ON public.settlement_transactions;
DROP POLICY IF EXISTS "Settlements insertable by group members" ON public.settlement_transactions;
DROP POLICY IF EXISTS "Permitir acceso total a usuarios autenticados sobre sus liquida" ON public.settlement_transactions;
DROP POLICY IF EXISTS "settlements_select_policy" ON public.settlement_transactions;
DROP POLICY IF EXISTS "settlements_insert_policy" ON public.settlement_transactions;
DROP POLICY IF EXISTS "settlements_update_policy" ON public.settlement_transactions;
DROP POLICY IF EXISTS "settlements_delete_policy" ON public.settlement_transactions;

-- 6. Crear políticas RLS limpias y sin recursión (usando las funciones SECURITY DEFINER)

-- POLÍTICAS: GROUP_MEMBERS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select_policy"
ON public.group_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  OR public.check_is_group_member(group_id, auth.uid())
);

CREATE POLICY "group_members_insert_policy"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.check_is_group_admin(group_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.created_by = auth.uid() OR g.admin_id = auth.uid()))
);

CREATE POLICY "group_members_update_policy"
ON public.group_members FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() 
  OR public.check_is_group_admin(group_id, auth.uid())
)
WITH CHECK (
  user_id = auth.uid() 
  OR public.check_is_group_admin(group_id, auth.uid())
);

CREATE POLICY "group_members_delete_policy"
ON public.group_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid() 
  OR public.check_is_group_admin(group_id, auth.uid())
);

-- POLÍTICAS: GROUPS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select_policy"
ON public.groups FOR SELECT TO authenticated
USING (
  created_by = auth.uid() 
  OR admin_id = auth.uid() 
  OR public.check_is_group_member(id, auth.uid())
);

CREATE POLICY "groups_insert_policy"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() 
  OR admin_id = auth.uid()
);

CREATE POLICY "groups_update_policy"
ON public.groups FOR UPDATE TO authenticated
USING (
  created_by = auth.uid() 
  OR admin_id = auth.uid() 
  OR public.check_is_group_admin(id, auth.uid())
)
WITH CHECK (
  created_by = auth.uid() 
  OR admin_id = auth.uid() 
  OR public.check_is_group_admin(id, auth.uid())
);

CREATE POLICY "groups_delete_policy"
ON public.groups FOR DELETE TO authenticated
USING (
  created_by = auth.uid() 
  OR admin_id = auth.uid()
);

-- POLÍTICAS: EXPENSES
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_policy"
ON public.expenses FOR SELECT TO authenticated
USING (
  public.check_is_group_member(group_id, auth.uid())
);

CREATE POLICY "expenses_insert_policy"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (
  public.check_is_group_member(group_id, auth.uid())
);

CREATE POLICY "expenses_update_policy"
ON public.expenses FOR UPDATE TO authenticated
USING (
  paid_by_user_id = auth.uid() 
  OR public.check_is_group_admin(group_id, auth.uid())
);

CREATE POLICY "expenses_delete_policy"
ON public.expenses FOR DELETE TO authenticated
USING (
  paid_by_user_id = auth.uid() 
  OR public.check_is_group_admin(group_id, auth.uid())
);

-- POLÍTICAS: SETTLEMENT_TRANSACTIONS
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlements_select_policy"
ON public.settlement_transactions FOR SELECT TO authenticated
USING (
  payer_id = auth.uid() 
  OR receiver_id = auth.uid() 
  OR from_user_id = auth.uid() 
  OR to_user_id = auth.uid() 
  OR (group_id IS NOT NULL AND public.check_is_group_member(group_id, auth.uid()))
);

CREATE POLICY "settlements_insert_policy"
ON public.settlement_transactions FOR INSERT TO authenticated
WITH CHECK (
  payer_id = auth.uid() 
  OR receiver_id = auth.uid() 
  OR from_user_id = auth.uid() 
  OR to_user_id = auth.uid() 
  OR (group_id IS NOT NULL AND public.check_is_group_member(group_id, auth.uid()))
);

CREATE POLICY "settlements_update_policy"
ON public.settlement_transactions FOR UPDATE TO authenticated
USING (
  payer_id = auth.uid() 
  OR receiver_id = auth.uid() 
  OR from_user_id = auth.uid() 
  OR to_user_id = auth.uid() 
  OR (group_id IS NOT NULL AND public.check_is_group_admin(group_id, auth.uid()))
);

CREATE POLICY "settlements_delete_policy"
ON public.settlement_transactions FOR DELETE TO authenticated
USING (
  payer_id = auth.uid() 
  OR receiver_id = auth.uid() 
  OR from_user_id = auth.uid() 
  OR to_user_id = auth.uid() 
  OR (group_id IS NOT NULL AND public.check_is_group_admin(group_id, auth.uid()))
);

-- 7. Procedimiento RPC transfer_group_admin totalmente blindado
CREATE OR REPLACE FUNCTION public.transfer_group_admin(p_group_id UUID, p_new_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_current_admin_id UUID;
  v_is_member BOOLEAN;
  v_new_admin_profile RECORD;
  v_group_name TEXT;
BEGIN
  v_caller_id := auth.uid();

  -- Obtener admin actual y nombre del grupo
  SELECT admin_id, created_by, name INTO v_current_admin_id, v_caller_id, v_group_name
  FROM public.groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Grupo no encontrado.');
  END IF;

  -- Comprobar si el que llama es el admin actual o creador
  IF auth.uid() IS NOT NULL AND v_current_admin_id IS NOT NULL AND auth.uid() <> v_current_admin_id AND auth.uid() <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo el administrador actual puede transferir su rol.');
  END IF;

  -- Comprobar que el nuevo admin pertenezca al grupo
  SELECT EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_new_admin_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'El nuevo administrador debe ser miembro del grupo.');
  END IF;

  -- Actualizar admin_id en el grupo
  UPDATE public.groups
  SET admin_id = p_new_admin_id
  WHERE id = p_group_id;

  -- Actualizar roles en group_members
  UPDATE public.group_members
  SET role = 'member'
  WHERE group_id = p_group_id;

  UPDATE public.group_members
  SET role = 'admin'
  WHERE group_id = p_group_id AND user_id = p_new_admin_id;

  -- Obtener datos del nuevo admin
  SELECT id, name, username, email INTO v_new_admin_profile
  FROM public.profiles
  WHERE id = p_new_admin_id;

  RETURN jsonb_build_object(
    'success', true,
    'groupId', p_group_id,
    'newAdminId', p_new_admin_id,
    'newAdminName', v_new_admin_profile.name,
    'newAdminEmail', v_new_admin_profile.email,
    'groupName', v_group_name
  );
END;
$$;

-- 8. Poblar la base de datos con datos reales para los usuarios existentes
DO $$
DECLARE
  v_marcos_id UUID := 'd5b99115-bce7-45ed-a107-8a6c5dc7f53e';
  v_prueba_id UUID := 'fbec4d79-af23-4131-b281-66101ab01291';
  v_test_id UUID := '9957cd85-d51b-4776-81a9-f3d58886ed3b';
  
  v_group1_id UUID := '11111111-1111-1111-1111-111111111111';
  v_group2_id UUID := '22222222-2222-2222-2222-222222222222';

  v_exp1_id UUID := 'aaaaaaaa-1111-1111-1111-111111111111';
  v_exp2_id UUID := 'bbbbbbbb-2222-2222-2222-222222222222';
  v_exp3_id UUID := 'cccccccc-3333-3333-3333-333333333333';
  v_exp4_id UUID := 'dddddddd-4444-4444-4444-444444444444';
BEGIN
  -- Actualizar perfiles con ingresos mensuales
  UPDATE public.profiles SET monthly_income = 1800, income = 1800 WHERE id = v_marcos_id;
  UPDATE public.profiles SET monthly_income = 1500, income = 1500 WHERE id = v_prueba_id;
  UPDATE public.profiles SET monthly_income = 1200, income = 1200 WHERE id = v_test_id;

  -- 1. Insertar Grupo 1: Piso Compartido Centro
  INSERT INTO public.groups (
    id, name, description, category, currency, created_by, admin_id, codigo_grupo, invite_code, budget_blocks, income_module_enabled, created_at
  ) VALUES (
    v_group1_id,
    'Piso Compartido Centro',
    'Gastos comunes de suministros, compras y hogar de nuestro piso',
    'HOME',
    'EUR',
    v_marcos_id,
    v_marcos_id,
    'SF-CENTRO',
    'SF-CENTRO',
    '[
      {"category": "FOOD", "limit": 450, "isActive": true},
      {"category": "UTILITIES", "limit": 200, "isActive": true},
      {"category": "HOUSING", "limit": 150, "isActive": true}
    ]'::jsonb,
    true,
    now() - interval '14 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    admin_id = EXCLUDED.admin_id,
    budget_blocks = EXCLUDED.budget_blocks,
    income_module_enabled = EXCLUDED.income_module_enabled,
    codigo_grupo = EXCLUDED.codigo_grupo,
    invite_code = EXCLUDED.invite_code;

  -- 2. Insertar Miembros de Grupo 1
  INSERT INTO public.group_members (group_id, user_id, role, joined_at)
  VALUES 
    (v_group1_id, v_marcos_id, 'admin', now() - interval '14 days'),
    (v_group1_id, v_prueba_id, 'member', now() - interval '13 days'),
    (v_group1_id, v_test_id, 'member', now() - interval '12 days')
  ON CONFLICT DO NOTHING;

  -- 3. Insertar Grupo 2: Viaje a Roma 2026
  INSERT INTO public.groups (
    id, name, description, category, currency, created_by, admin_id, codigo_grupo, invite_code, budget_blocks, income_module_enabled, created_at
  ) VALUES (
    v_group2_id,
    'Viaje a Roma 2026',
    'Escapada a Italia con amigos: vuelos, apartamentos y restaurantes',
    'TRIP',
    'EUR',
    v_marcos_id,
    v_marcos_id,
    'SF-ROMA26',
    'SF-ROMA26',
    '[
      {"category": "TRANSPORT", "limit": 300, "isActive": true},
      {"category": "FOOD", "limit": 250, "isActive": true},
      {"category": "ENTERTAINMENT", "limit": 200, "isActive": true}
    ]'::jsonb,
    false,
    now() - interval '7 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    admin_id = EXCLUDED.admin_id,
    budget_blocks = EXCLUDED.budget_blocks,
    income_module_enabled = EXCLUDED.income_module_enabled,
    codigo_grupo = EXCLUDED.codigo_grupo,
    invite_code = EXCLUDED.invite_code;

  -- 4. Insertar Miembros de Grupo 2
  INSERT INTO public.group_members (group_id, user_id, role, joined_at)
  VALUES 
    (v_group2_id, v_marcos_id, 'admin', now() - interval '7 days'),
    (v_group2_id, v_prueba_id, 'member', now() - interval '6 days')
  ON CONFLICT DO NOTHING;

  -- 5. Insertar Gastos en Grupo 1
  INSERT INTO public.expenses (
    id, group_id, title, description, amount, paid_by_user_id, category, split_type, notes, currency, created_at, splits
  ) VALUES
    (
      v_exp1_id,
      v_group1_id,
      'Compra semanal Mercadona',
      'Compra semanal Mercadona',
      126.60,
      v_marcos_id,
      'FOOD',
      'EQUAL',
      'Frutas, verduras, lácteos y productos de limpieza',
      'EUR',
      now() - interval '5 days',
      jsonb_build_array(
        jsonb_build_object('userId', v_marcos_id, 'amount', 42.20),
        jsonb_build_object('userId', v_prueba_id, 'amount', 42.20),
        jsonb_build_object('userId', v_test_id, 'amount', 42.20)
      )
    ),
    (
      v_exp2_id,
      v_group1_id,
      'Factura Fibra y Electricidad',
      'Factura Fibra y Electricidad',
      87.30,
      v_prueba_id,
      'UTILITIES',
      'EQUAL',
      'Recibo mensual de luz y conexión de 600Mb',
      'EUR',
      now() - interval '3 days',
      jsonb_build_array(
        jsonb_build_object('userId', v_marcos_id, 'amount', 29.10),
        jsonb_build_object('userId', v_prueba_id, 'amount', 29.10),
        jsonb_build_object('userId', v_test_id, 'amount', 29.10)
      )
    ),
    (
      v_exp3_id,
      v_group1_id,
      'Artículos de cocina y menaje',
      'Artículos de cocina y menaje',
      36.00,
      v_marcos_id,
      'HOUSING',
      'EQUAL',
      'Sartenes antiadherentes y juego de vasos',
      'EUR',
      now() - interval '1 days',
      jsonb_build_array(
        jsonb_build_object('userId', v_marcos_id, 'amount', 12.00),
        jsonb_build_object('userId', v_prueba_id, 'amount', 12.00),
        jsonb_build_object('userId', v_test_id, 'amount', 12.00)
      )
    )
  ON CONFLICT (id) DO NOTHING;

  -- 6. Insertar Gasto en Grupo 2
  INSERT INTO public.expenses (
    id, group_id, title, description, amount, paid_by_user_id, category, split_type, notes, currency, created_at, splits
  ) VALUES
    (
      v_exp4_id,
      v_group2_id,
      'Reserva Apartamento Trastevere',
      'Reserva Apartamento Trastevere',
      280.00,
      v_marcos_id,
      'HOUSING',
      'EQUAL',
      'Estancia 4 noches para 2 personas',
      'EUR',
      now() - interval '2 days',
      jsonb_build_array(
        jsonb_build_object('userId', v_marcos_id, 'amount', 140.00),
        jsonb_build_object('userId', v_prueba_id, 'amount', 140.00)
      )
    )
  ON CONFLICT (id) DO NOTHING;

END $$;
