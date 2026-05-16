import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUp, BookOpen, MessageSquare, Sparkles } from 'lucide-react'

async function getProfessorStats() {
  const supabase = await createClient()
  const [questionsRes, answersRes, profilesRes] = await Promise.all([
    supabase.from('questions').select('*', { count: 'exact' }).neq('is_deleted', true),
    supabase.from('answers').select('*', { count: 'exact' }).neq('is_deleted', true),
    supabase.from('profiles').select('*', { count: 'exact' }),
  ])

  return {
    questions: questionsRes.count ?? 0,
    answers: answersRes.count ?? 0,
    users: profilesRes.count ?? 0,
  }
}

async function getTopQuestions() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('questions')
    .select('id,title,upvotes_count,answers_count,created_at')
    .order('upvotes_count', { ascending: false })
    .limit(5)
  return data || []
}

export default async function ProfessorDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [stats, topQuestions] = await Promise.all([
    getProfessorStats(),
    getTopQuestions(),
  ])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Professor Dashboard</p>
            <h1 className="text-3xl font-bold">Lecture Insights</h1>
            <p className="text-muted-foreground">Monitor top topics, trending questions, and student pain points.</p>
          </div>
          <Link href="/home">
            <Button>
              <MessageSquare className="mr-2 h-4 w-4" /> Browse Questions
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Total Questions</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{stats.questions}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Answers</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{stats.answers}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ArrowUp className="h-4 w-4" /> Active Students</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{stats.users}</CardContent>
          </Card>
        </div>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Top voted questions</h2>
            <Link href="/home" className="text-primary underline">View all</Link>
          </div>
          <div className="space-y-2">
            {topQuestions.map((q) => (
              <Card key={q.id}>
                <CardContent className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{q.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="rounded-md bg-primary/10 px-2 py-1">↑ {q.upvotes_count}</span>
                    <span className="rounded-md bg-secondary/10 px-2 py-1">💬 {q.answers_count}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
