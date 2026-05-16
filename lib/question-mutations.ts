import type { SupabaseClient } from '@supabase/supabase-js'

export async function softDeleteQuestion(supabase: SupabaseClient, questionId: string) {
  const { error: rpcError } = await supabase.rpc('soft_delete_question', {
    p_question_id: questionId,
  })

  if (!rpcError) return { data: null, error: null }

  const rpcMissing =
    rpcError.code === 'PGRST202' ||
    rpcError.message?.toLowerCase().includes('could not find the function')

  if (rpcMissing) {
    return supabase
      .from('questions')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', questionId)
  }

  return { data: null, error: rpcError }
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
