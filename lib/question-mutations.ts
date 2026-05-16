import type { SupabaseClient } from '@supabase/supabase-js'

export async function softDeleteQuestion(supabase: SupabaseClient, questionId: string) {
  return supabase
    .from('questions')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', questionId)
}

export async function toggleQuestionUpvote(
  supabase: SupabaseClient,
  userId: string,
  questionId: string,
  hasUpvoted: boolean,
) {
  if (hasUpvoted) {
    return supabase
      .from('question_upvotes')
      .delete()
      .eq('user_id', userId)
      .eq('question_id', questionId)
  }
  return supabase.from('question_upvotes').insert({ user_id: userId, question_id: questionId })
}

export async function toggleAnswerUpvote(
  supabase: SupabaseClient,
  userId: string,
  answerId: string,
  hasUpvoted: boolean,
) {
  if (hasUpvoted) {
    return supabase
      .from('answer_upvotes')
      .delete()
      .eq('user_id', userId)
      .eq('answer_id', answerId)
  }
  return supabase.from('answer_upvotes').insert({ user_id: userId, answer_id: answerId })
}
