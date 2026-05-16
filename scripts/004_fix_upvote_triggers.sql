-- CRITICAL: Run in Supabase SQL Editor
-- Fixes upvotes, view counts, and answer counts blocked by RLS on trigger updates

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
