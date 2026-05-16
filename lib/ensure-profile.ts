import type { SupabaseClient } from '@supabase/supabase-js'

/** Ensures profiles row exists (required for question_upvotes FK). */
export async function ensureProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) return { ok: true as const, userId: user.id }

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    full_name:
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'User',
    email: user.email || '',
  })

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, userId: user.id }
}
