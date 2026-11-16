-- Migration 0002: Fix Admin RLS Policy and Storage Bucket Configuration

-- 1. Ensure project-pdfs bucket exists in storage.buckets with 3 MB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-pdfs', 'project-pdfs', false, 3145728, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 3145728,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- 2. Enhanced is_admin function
-- Directly verifies against auth.users for 'teaminosap26@gmail.com' OR admin_users table
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid) 
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, auth 
AS $$ 
  SELECT EXISTS (
    SELECT 1 FROM auth.users u 
    WHERE u.id = _uid 
      AND lower(trim(u.email)) = 'teaminosap26@gmail.com'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_users a 
    WHERE a.user_id = _uid 
      AND lower(trim(coalesce(a.email, ''))) = 'teaminosap26@gmail.com'
  );
$$;

-- 3. Robust claim_first_admin function
CREATE OR REPLACE FUNCTION public.claim_first_admin() 
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth 
AS $$ 
BEGIN 
  IF auth.uid() IS NULL THEN 
    RETURN false; 
  END IF; 

  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
      AND lower(trim(email)) = 'teaminosap26@gmail.com'
  ) THEN 
    RETURN false; 
  END IF; 

  INSERT INTO public.admin_users(user_id, email) 
  VALUES(auth.uid(), 'TeamInoSap26@gmail.com') 
  ON CONFLICT(user_id) DO UPDATE SET email = 'TeamInoSap26@gmail.com'; 

  RETURN true; 
END $$;

-- 4. Grant execution permissions on admin functions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated, service_role;

-- 5. Auto-sync trigger on auth.users so TeamInoSap26@gmail.com is automatically registered in admin_users
CREATE OR REPLACE FUNCTION public.sync_admin_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth 
AS $$ 
BEGIN 
  IF lower(trim(NEW.email)) = 'teaminosap26@gmail.com' THEN 
    INSERT INTO public.admin_users(user_id, email) 
    VALUES(NEW.id, 'TeamInoSap26@gmail.com') 
    ON CONFLICT(user_id) DO UPDATE SET email = 'TeamInoSap26@gmail.com'; 
  END IF; 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS on_auth_user_admin_sync ON auth.users;
CREATE TRIGGER on_auth_user_admin_sync 
  AFTER INSERT OR UPDATE OF email ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.sync_admin_user();

-- 6. Backfill any existing admin user from auth.users into admin_users
INSERT INTO public.admin_users(user_id, email)
SELECT id, 'TeamInoSap26@gmail.com'
FROM auth.users
WHERE lower(trim(email)) = 'teaminosap26@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET email = 'TeamInoSap26@gmail.com';

-- 7. Storage Bucket & Object RLS Policies
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin bucket read" ON storage.buckets;
CREATE POLICY "admin bucket read" ON storage.buckets
  FOR SELECT TO authenticated
  USING (id = 'project-pdfs' AND public.is_admin(auth.uid()));

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin pdf read" ON storage.objects;
CREATE POLICY "admin pdf read" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (bucket_id = 'project-pdfs' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin pdf write" ON storage.objects;
CREATE POLICY "admin pdf write" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'project-pdfs' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin pdf update" ON storage.objects;
CREATE POLICY "admin pdf update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (bucket_id = 'project-pdfs' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'project-pdfs' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin pdf delete" ON storage.objects;
CREATE POLICY "admin pdf delete" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'project-pdfs' AND public.is_admin(auth.uid()));

-- 8. Refresh RLS Policies on teams and team_members
DROP POLICY IF EXISTS "admin all" ON public.teams;
CREATE POLICY "admin all" ON public.teams 
  FOR ALL TO authenticated 
  USING (public.is_admin(auth.uid())) 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all" ON public.team_members;
CREATE POLICY "admin all" ON public.team_members 
  FOR ALL TO authenticated 
  USING (public.is_admin(auth.uid())) 
  WITH CHECK (public.is_admin(auth.uid()));

-- 9. Diagnostic status function
CREATE OR REPLACE FUNCTION public.get_admin_status() 
RETURNS jsonb 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER 
SET search_path = public, auth 
AS $$ 
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _is_admin boolean;
BEGIN 
  IF _uid IS NULL THEN 
    RETURN jsonb_build_object('authenticated', false, 'is_admin', false);
  END IF; 
  
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  _is_admin := public.is_admin(_uid);
  
  RETURN jsonb_build_object(
    'authenticated', true, 
    'user_id', _uid, 
    'email', _email, 
    'is_admin', _is_admin
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_admin_status() TO authenticated, anon, service_role;
