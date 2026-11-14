-- ==============================================================================
-- SplitFlow — Migration: Email Ownership Verification via SplitflowNoReplay Link
-- ==============================================================================
-- Evita el registro con correos inexistentes o sin acceso real exigiendo la
-- verificación mediante un enlace único enviado desde SplitflowNoReplay@gmail.com.

-- 1. Añadir columna email_verified a public.profiles
-- Las cuentas ya existentes quedan marcadas como TRUE para no bloquear a usuarios actuales;
-- los nuevos registros partirán de FALSE hasta pulsar el enlace de verificación.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true;

ALTER TABLE public.profiles
  ALTER COLUMN email_verified SET DEFAULT false;

-- 2. Actualizar trigger handle_new_user para inicializar email_verified según metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_initial_verified BOOLEAN;
BEGIN
  v_initial_verified := COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, false);

  INSERT INTO public.profiles (
    id, email, name, username, income, monthly_income, avatar_url, email_verified
  )
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
$$;

-- 3. Tabla segura para tokens de verificación de correo por enlace
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

-- 4. RPC: Generar token de verificación de correo para enviar por enlace oficial
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

    -- Garantizar que exista fila en public.profiles marcada como no verificada
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

  -- Invalidar tokens anteriores sin usar para este correo
  UPDATE public.email_verification_tokens
  SET is_used = true
  WHERE lower(email) = v_clean_email AND is_used = false;

  -- Generar token criptográfico único de 64 caracteres hexadecimales usando gen_random_uuid() nativo
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '24 hours';

  INSERT INTO public.email_verification_tokens (user_id, email, token, expires_at, is_used)
  VALUES (v_user_id, v_clean_email, v_token, v_expires, false);

  -- Asegurar que el perfil queda marcado como pendiente de verificación
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

-- 5. RPC: Confirmar cuenta al hacer clic en el enlace de verificación
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

  -- Idempotencia: si ya estaba verificado por este enlace, devolver éxito igualmente
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

  -- Marcar perfil como verificado y confirmar correo en auth.users
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

-- 6. RPC: Consultar estado de verificación de cuenta antes/durante el inicio de sesión
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

NOTIFY pgrst, 'reload schema';
