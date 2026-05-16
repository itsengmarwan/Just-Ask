-- =============================================================================
-- Just Ask — Supabase schema (final)
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where possible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Clean up old triggers/functions (from previous scripts)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_question_upvotes_count ON public.question_upvotes;
DROP TRIGGER IF EXISTS tr_answer_upvotes_count ON public.answer_upvotes;
DROP TRIGGER IF EXISTS tr_notify_on_answer ON public.answers;
DROP TRIGGER IF EXISTS tr_notify_on_accept ON public.answers;
DROP FUNCTION IF EXISTS public.update_question_upvotes_count();
DROP FUNCTION IF EXISTS public.update_answer_upvotes_count();

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  reputation_score INTEGER DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'professor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  is_resolved BOOLEAN DEFAULT false,
  upvotes_count INTEGER DEFAULT 0,
  answers_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  upvotes_count INTEGER DEFAULT 0,
  is_accepted BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.question_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.answer_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(answer_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'new_answer',
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columns for databases created before this script
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON public.questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_is_resolved ON public.questions(is_resolved);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON public.answers(user_id);
CREATE INDEX IF NOT EXISTS idx_question_upvotes_question_id ON public.question_upvotes(question_id);
CREATE INDEX IF NOT EXISTS idx_answer_upvotes_answer_id ON public.answer_upvotes(answer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- -----------------------------------------------------------------------------
-- 3. Helper functions (admin check)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', 'student');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR public.jwt_role() = 'admin';
$$;

-- -----------------------------------------------------------------------------
-- 4. Auth: auto-create profile on signup
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'display_name', 'Anonymous User'),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. Counter triggers (SECURITY DEFINER — fixes upvotes / answer counts / views)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_question_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questions SET upvotes_count = upvotes_count + 1 WHERE id = NEW.question_id;
  UPDATE public.profiles SET reputation_score = reputation_score + 5
  WHERE id = (SELECT user_id FROM public.questions WHERE id = NEW.question_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_question_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questions SET upvotes_count = GREATEST(upvotes_count - 1, 0) WHERE id = OLD.question_id;
  UPDATE public.profiles SET reputation_score = GREATEST(reputation_score - 5, 0)
  WHERE id = (SELECT user_id FROM public.questions WHERE id = OLD.question_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_question_upvote_insert ON public.question_upvotes;
CREATE TRIGGER on_question_upvote_insert
  AFTER INSERT ON public.question_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.increment_question_upvotes();

DROP TRIGGER IF EXISTS on_question_upvote_delete ON public.question_upvotes;
CREATE TRIGGER on_question_upvote_delete
  AFTER DELETE ON public.question_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.decrement_question_upvotes();

CREATE OR REPLACE FUNCTION public.increment_answer_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.answers SET upvotes_count = upvotes_count + 1 WHERE id = NEW.answer_id;
  UPDATE public.profiles SET reputation_score = reputation_score + 10
  WHERE id = (SELECT user_id FROM public.answers WHERE id = NEW.answer_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_answer_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.answers SET upvotes_count = GREATEST(upvotes_count - 1, 0) WHERE id = OLD.answer_id;
  UPDATE public.profiles SET reputation_score = GREATEST(reputation_score - 10, 0)
  WHERE id = (SELECT user_id FROM public.answers WHERE id = OLD.answer_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_answer_upvote_insert ON public.answer_upvotes;
CREATE TRIGGER on_answer_upvote_insert
  AFTER INSERT ON public.answer_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.increment_answer_upvotes();

DROP TRIGGER IF EXISTS on_answer_upvote_delete ON public.answer_upvotes;
CREATE TRIGGER on_answer_upvote_delete
  AFTER DELETE ON public.answer_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.decrement_answer_upvotes();

CREATE OR REPLACE FUNCTION public.update_answer_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.questions SET answers_count = answers_count + 1 WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.questions SET answers_count = GREATEST(answers_count - 1, 0) WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_answer_insert ON public.answers;
CREATE TRIGGER on_answer_insert
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_answer_count();

DROP TRIGGER IF EXISTS on_answer_delete ON public.answers;
CREATE TRIGGER on_answer_delete
  AFTER DELETE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_answer_count();

CREATE OR REPLACE FUNCTION public.increment_question_views(p_question_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questions
  SET views_count = views_count + 1
  WHERE id = p_question_id AND is_deleted = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_question_views(UUID) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Notification triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_question_owner_on_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_owner UUID;
  q_title TEXT;
  answerer_name TEXT;
BEGIN
  SELECT user_id, title INTO q_owner, q_title FROM public.questions WHERE id = NEW.question_id;
  IF q_owner IS NULL OR q_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.is_anonymous THEN
    answerer_name := 'A student';
  ELSE
    SELECT full_name INTO answerer_name FROM public.profiles WHERE id = NEW.user_id;
    answerer_name := COALESCE(answerer_name, 'A student');
  END IF;

  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    q_owner,
    'new_answer',
    answerer_name || ' answered your question: "' || q_title || '"',
    '/questions/' || NEW.question_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_answer_owner_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_owner UUID;
  q_title TEXT;
BEGIN
  IF NEW.is_accepted = true AND (OLD.is_accepted IS DISTINCT FROM true) THEN
    a_owner := NEW.user_id;
    SELECT title INTO q_title FROM public.questions WHERE id = NEW.question_id;
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      a_owner,
      'accepted_answer',
      'Your answer was marked as accepted in: "' || COALESCE(q_title, 'a question') || '"',
      '/questions/' || NEW.question_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_on_answer ON public.answers;
CREATE TRIGGER tr_notify_on_answer
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.notify_question_owner_on_answer();

DROP TRIGGER IF EXISTS tr_notify_on_accept ON public.answers;
CREATE TRIGGER tr_notify_on_accept
  AFTER UPDATE OF is_accepted ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.notify_answer_owner_on_accept();

-- -----------------------------------------------------------------------------
-- 7. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.is_admin() AND id <> auth.uid());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (public.is_admin());

-- Categories
DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT USING (true);

-- Questions
DROP POLICY IF EXISTS "questions_select_all" ON public.questions;
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "questions_select_all" ON public.questions FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "questions_insert_own" ON public.questions;
DROP POLICY IF EXISTS "Users can insert questions" ON public.questions;
CREATE POLICY "questions_insert_own" ON public.questions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_update_own" ON public.questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.questions;
CREATE POLICY "questions_update_own" ON public.questions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_delete_own" ON public.questions;
CREATE POLICY "questions_delete_own" ON public.questions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_update_admin" ON public.questions;
DROP POLICY IF EXISTS "Admin can update questions" ON public.questions;
CREATE POLICY "questions_update_admin" ON public.questions FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "questions_delete_admin" ON public.questions;
DROP POLICY IF EXISTS "Admin can delete questions" ON public.questions;
CREATE POLICY "questions_delete_admin" ON public.questions FOR DELETE USING (public.is_admin());

-- Answers
DROP POLICY IF EXISTS "answers_select_all" ON public.answers;
DROP POLICY IF EXISTS "Anyone can view answers" ON public.answers;
CREATE POLICY "answers_select_all" ON public.answers FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "answers_insert_own" ON public.answers;
DROP POLICY IF EXISTS "Users can insert answers" ON public.answers;
CREATE POLICY "answers_insert_own" ON public.answers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "answers_update_own" ON public.answers;
DROP POLICY IF EXISTS "Users can update their own answers" ON public.answers;
CREATE POLICY "answers_update_own" ON public.answers FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "answers_update_by_question_owner" ON public.answers;
CREATE POLICY "answers_update_by_question_owner" ON public.answers FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = answers.question_id AND q.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "answers_delete_own" ON public.answers;
CREATE POLICY "answers_delete_own" ON public.answers FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "answers_update_admin" ON public.answers;
DROP POLICY IF EXISTS "Admin can update answers" ON public.answers;
CREATE POLICY "answers_update_admin" ON public.answers FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "answers_delete_admin" ON public.answers;
DROP POLICY IF EXISTS "Admin can delete answers" ON public.answers;
CREATE POLICY "answers_delete_admin" ON public.answers FOR DELETE USING (public.is_admin());

-- Upvotes (required for voting to work)
DROP POLICY IF EXISTS "question_upvotes_select_all" ON public.question_upvotes;
CREATE POLICY "question_upvotes_select_all" ON public.question_upvotes FOR SELECT USING (true);

DROP POLICY IF EXISTS "question_upvotes_insert_own" ON public.question_upvotes;
CREATE POLICY "question_upvotes_insert_own" ON public.question_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "question_upvotes_delete_own" ON public.question_upvotes;
CREATE POLICY "question_upvotes_delete_own" ON public.question_upvotes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "answer_upvotes_select_all" ON public.answer_upvotes;
CREATE POLICY "answer_upvotes_select_all" ON public.answer_upvotes FOR SELECT USING (true);

DROP POLICY IF EXISTS "answer_upvotes_insert_own" ON public.answer_upvotes;
CREATE POLICY "answer_upvotes_insert_own" ON public.answer_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "answer_upvotes_delete_own" ON public.answer_upvotes;
CREATE POLICY "answer_upvotes_delete_own" ON public.answer_upvotes FOR DELETE USING (auth.uid() = user_id);

-- Notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "Allow inserting notifications" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 8. Storage (bucket name must match app: question_images)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('question_images', 'question_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Optional legacy bucket from older script
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "question_images_public_read" ON storage.objects;
CREATE POLICY "question_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'question_images');

DROP POLICY IF EXISTS "question_images_auth_upload" ON storage.objects;
CREATE POLICY "question_images_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'question_images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "question_images_owner_update" ON storage.objects;
CREATE POLICY "question_images_owner_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'question_images' AND auth.uid() = owner);

DROP POLICY IF EXISTS "question_images_owner_delete" ON storage.objects;
CREATE POLICY "question_images_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'question_images' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Public Access to Images" ON storage.objects;
DROP POLICY IF EXISTS "images_public_read" ON storage.objects;
CREATE POLICY "images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Allow Authenticated Users to Upload" ON storage.objects;
DROP POLICY IF EXISTS "images_auth_upload" ON storage.objects;
CREATE POLICY "images_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow Users to Update Their Own Images" ON storage.objects;
DROP POLICY IF EXISTS "images_owner_update" ON storage.objects;
CREATE POLICY "images_owner_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'images' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Allow Users to Delete Their Own Images" ON storage.objects;
DROP POLICY IF EXISTS "images_owner_delete" ON storage.objects;
CREATE POLICY "images_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'images' AND auth.uid() = owner);

-- -----------------------------------------------------------------------------
-- 9. Realtime (enable in Dashboard if this line errors)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 10. Seed categories (E-JUST)
-- -----------------------------------------------------------------------------
INSERT INTO public.categories (name, slug, description) VALUES
  ('Mathematics 1', 'mathematics-1', 'Semester 1 Course'),
  ('Physics 1', 'physics-1', 'Semester 1 Course'),
  ('Mechanics 1', 'mechanics-1', 'Semester 1 Course'),
  ('Chemistry', 'chemistry', 'Semester 1 Course'),
  ('Engineering Drawing', 'engineering-drawing', 'Semester 1 Course'),
  ('English Language 1', 'english-language-1', 'Semester 1 Course'),
  ('Mathematics 2', 'mathematics-2', 'Semester 2 Course'),
  ('Physics 2', 'physics-2', 'Semester 2 Course'),
  ('Computer Programming', 'computer-programming', 'Semester 2 Course'),
  ('Manufacturing Technology', 'manufacturing-technology', 'Semester 2 Course'),
  ('Mechanics 2', 'mechanics-2', 'Semester 2 Course'),
  ('English Language 2', 'english-language-2', 'Semester 2 Course')
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. Default admin / professor accounts (edit emails if needed)
-- -----------------------------------------------------------------------------
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admi.000000000@ejust.edu.eg';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"professor"'
)
WHERE email = 'doctor.000000000@ejust.edu.eg';

UPDATE public.profiles p
SET role = COALESCE(u.raw_user_meta_data ->> 'role', 'student'),
    updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND u.email IN ('admi.000000000@ejust.edu.eg', 'doctor.000000000@ejust.edu.eg');

-- -----------------------------------------------------------------------------
-- 12. Recalculate cached counters
-- -----------------------------------------------------------------------------
UPDATE public.questions q
SET upvotes_count = COALESCE((
  SELECT COUNT(*)::int FROM public.question_upvotes qu WHERE qu.question_id = q.id
), 0);

UPDATE public.answers a
SET upvotes_count = COALESCE((
  SELECT COUNT(*)::int FROM public.answer_upvotes au WHERE au.answer_id = a.id
), 0);

UPDATE public.questions q
SET answers_count = COALESCE((
  SELECT COUNT(*)::int FROM public.answers an
  WHERE an.question_id = q.id AND an.is_deleted = false
), 0);
