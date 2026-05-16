import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import { QuestionDetail } from './question-detail'
import { ArrowLeft } from 'lucide-react'
import type { Question, Answer } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getQuestion(id: string, userId?: string) {
  const supabase = await createClient()

  const { data: qRow, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (qErr || !qRow) {
    return null
  }

  const [profileRes, categoryRes] = await Promise.all([
    qRow.user_id
      ? supabase.from('profiles').select('id, full_name, avatar_url').eq('id', qRow.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    qRow.category_id
      ? supabase.from('categories').select('id, name, slug, color').eq('id', qRow.category_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ])

  let question: Question = {
    ...qRow,
    profiles: profileRes?.data ?? undefined,
    categories: categoryRes?.data ?? undefined,
  } as Question

  if (userId) {
    const { data: upvote } = await supabase
      .from('question_upvotes')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', id)
      .maybeSingle()

    question.user_has_upvoted = !!upvote
  }

  return question
}

async function getAnswers(questionId: string, userId?: string) {
  const supabase = await createClient()

  const { data: aRows, error: aErr } = await supabase
    .from('answers')
    .select('*')
    .eq('question_id', questionId)
    .order('is_accepted', { ascending: false })
    .order('created_at', { ascending: true })

  if (aErr || !aRows) return []

  const userIds = Array.from(new Set(aRows.map((a: any) => a.user_id).filter(Boolean)))
  const profilesById = new Map<string, any>()
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
    for (const p of profiles || []) profilesById.set(p.id, p)
  }

  let answersBase = aRows.map((a: any) => ({
    ...a,
    profiles: a.user_id ? profilesById.get(a.user_id) : undefined,
  }))

  if (userId) {
    const { data: upvotes } = await supabase
      .from('answer_upvotes')
      .select('answer_id')
      .eq('user_id', userId)

    const upvotedIds = new Set(upvotes?.map((u) => u.answer_id) || [])
    return answersBase.map((a: any) => ({
      ...a,
      user_has_upvoted: upvotedIds.has(a.id),
    })) as Answer[]
  }

  return answersBase as Answer[]
}

// 🐛 تم الإصلاح: الزيادة أصبحت ديناميكية تعتمد على الرقم الحالي
async function incrementViewCount(id: string) {
  const supabase = await createClient()
  await supabase.rpc('increment_question_views', { p_question_id: id }).catch(() => {})
}

export default async function QuestionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = params.id

  if (!id) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = user?.user_metadata?.role === 'admin'
  if (user && !isAdmin) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  const [question, answers] = await Promise.all([
    getQuestion(id, user?.id),
    getAnswers(id, user?.id),
  ])

  if (!question) {
    notFound()
  }

  // تمرير عدد المشاهدات الحالي
  incrementViewCount(id)

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 -z-10 bg-[url('/bg-ejust.jpg')] bg-cover bg-center opacity-10 blur-sm" />
      
      <AppHeader user={user} />

      <main className="mx-auto max-w-4xl px-4 py-6 relative z-10">
        <Link
          href="/home"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to questions
        </Link>

        <QuestionDetail
          question={question}
          answers={answers}
          currentUserId={user?.id}
          currentUserRole={user?.user_metadata?.role}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  )
}