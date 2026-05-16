-- Run this in Supabase SQL Editor (fixes "new row violates row-level security" on delete)

-- 1. Owner & admin can update their rows (including is_deleted = true)
DROP POLICY IF EXISTS "questions_update_own" ON public.questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.questions;
CREATE POLICY "questions_update_own" ON public.questions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_update_admin" ON public.questions;
DROP POLICY IF EXISTS "Admin can update questions" ON public.questions;
CREATE POLICY "questions_update_admin" ON public.questions
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. Hard delete policies (if missing)
DROP POLICY IF EXISTS "questions_delete_own" ON public.questions;
CREATE POLICY "questions_delete_own" ON public.questions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_delete_admin" ON public.questions;
DROP POLICY IF EXISTS "Admin can delete questions" ON public.questions;
CREATE POLICY "questions_delete_admin" ON public.questions
  FOR DELETE
  USING (public.is_admin());

-- 3. Safe soft-delete via RPC (bypasses RLS after permission check)
CREATE OR REPLACE FUNCTION public.soft_delete_question(p_question_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = p_question_id
      AND (q.user_id = auth.uid() OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not allowed to delete this question';
  END IF;

  UPDATE public.questions
  SET is_deleted = true, updated_at = NOW()
  WHERE id = p_question_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_question(UUID) TO authenticated;
