-- Set admin role for a specific user (run in Supabase SQL Editor)

DO $$
DECLARE
  admin_uid UUID := 'cb83aac6-a25b-4886-b900-9ac25e4a8d31';
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
  WHERE id = admin_uid;

  INSERT INTO public.profiles (id, full_name, email, role)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'display_name', 'Admin'),
    COALESCE(u.email, ''),
    'admin'
  FROM auth.users u
  WHERE u.id = admin_uid
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    updated_at = NOW();
END $$;

-- Verify
SELECT id, email, raw_user_meta_data ->> 'role' AS jwt_role
FROM auth.users
WHERE id = 'cb83aac6-a25b-4886-b900-9ac25e4a8d31';

SELECT id, email, role
FROM public.profiles
WHERE id = 'cb83aac6-a25b-4886-b900-9ac25e4a8d31';
