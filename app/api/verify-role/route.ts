import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET
  const profSecret = process.env.PROF_SECRET

  if (!adminSecret || !profSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code : ''

  let newRole: 'student' | 'admin' | 'professor' = 'student'
  if (code === adminSecret) newRole = 'admin'
  else if (code === profSecret) newRole = 'professor'
  else return NextResponse.json({ error: 'Invalid access code' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { role: newRole },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ role: newRole })
}
