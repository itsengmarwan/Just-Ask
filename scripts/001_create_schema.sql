-- Just Ask Database Schema
-- A Q&A platform for EJUST university students

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  reputation_score INTEGER DEFAULT 0,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories/Tags table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
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

-- Answers table
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

-- Question upvotes table
CREATE TABLE IF NOT EXISTS public.question_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, user_id)
);

-- Answer upvotes table
CREATE TABLE IF NOT EXISTS public.answer_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(answer_id, user_id)
);

-- Insert default categories
INSERT INTO public.categories (name, slug, description, color) VALUES
  ('Programming', 'programming', 'Questions about coding and software development', '#3b82f6'),
  ('Math', 'math', 'Mathematics and calculations', '#8b5cf6'),
  ('Physics', 'physics', 'Physics and natural sciences', '#06b6d4'),
  ('Electronics', 'electronics', 'Electronics and circuits', '#f59e0b'),
  ('University Life', 'university-life', 'General questions about campus life', '#10b981')
ON CONFLICT (slug) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_upvotes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Categories policies (public read)
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT USING (true);

-- Questions policies
CREATE POLICY "questions_select_all" ON public.questions FOR SELECT USING (is_deleted = false);
CREATE POLICY "questions_insert_own" ON public.questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "questions_update_own" ON public.questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "questions_delete_own" ON public.questions FOR DELETE USING (auth.uid() = user_id);

-- Answers policies
CREATE POLICY "answers_select_all" ON public.answers FOR SELECT USING (is_deleted = false);
CREATE POLICY "answers_insert_own" ON public.answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "answers_update_own" ON public.answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "answers_delete_own" ON public.answers FOR DELETE USING (auth.uid() = user_id);

-- Question upvotes policies
CREATE POLICY "question_upvotes_select_all" ON public.question_upvotes FOR SELECT USING (true);
CREATE POLICY "question_upvotes_insert_own" ON public.question_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "question_upvotes_delete_own" ON public.question_upvotes FOR DELETE USING (auth.uid() = user_id);

-- Answer upvotes policies
CREATE POLICY "answer_upvotes_select_all" ON public.answer_upvotes FOR SELECT USING (true);
CREATE POLICY "answer_upvotes_insert_own" ON public.answer_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "answer_upvotes_delete_own" ON public.answer_upvotes FOR DELETE USING (auth.uid() = user_id);

-- Create trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Anonymous User'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to increment question upvote count
CREATE OR REPLACE FUNCTION increment_question_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questions SET upvotes_count = upvotes_count + 1 WHERE id = NEW.question_id;
  -- Give reputation to question author
  UPDATE public.profiles SET reputation_score = reputation_score + 5 
  WHERE id = (SELECT user_id FROM public.questions WHERE id = NEW.question_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_question_upvotes()
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
  FOR EACH ROW
  EXECUTE FUNCTION increment_question_upvotes();

DROP TRIGGER IF EXISTS on_question_upvote_delete ON public.question_upvotes;
CREATE TRIGGER on_question_upvote_delete
  AFTER DELETE ON public.question_upvotes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_question_upvotes();

-- Function to increment answer upvote count
CREATE OR REPLACE FUNCTION increment_answer_upvotes()
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

CREATE OR REPLACE FUNCTION decrement_answer_upvotes()
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
  FOR EACH ROW
  EXECUTE FUNCTION increment_answer_upvotes();

DROP TRIGGER IF EXISTS on_answer_upvote_delete ON public.answer_upvotes;
CREATE TRIGGER on_answer_upvote_delete
  AFTER DELETE ON public.answer_upvotes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_answer_upvotes();

-- Function to update answer count on questions
CREATE OR REPLACE FUNCTION update_answer_count()
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
  FOR EACH ROW
  EXECUTE FUNCTION update_answer_count();

DROP TRIGGER IF EXISTS on_answer_delete ON public.answers;
CREATE TRIGGER on_answer_delete
  AFTER DELETE ON public.answers
  FOR EACH ROW
  EXECUTE FUNCTION update_answer_count();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON public.questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON public.answers(user_id);
CREATE INDEX IF NOT EXISTS idx_question_upvotes_question_id ON public.question_upvotes(question_id);
CREATE INDEX IF NOT EXISTS idx_answer_upvotes_answer_id ON public.answer_upvotes(answer_id);

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
