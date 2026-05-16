import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

async function getPublishedAnswers() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('answers')
    .select(`
      id,
      content,
      question_id,
      created_at,
      profiles:user_id (id, full_name, avatar_url),
      questions:question_id (title)
    `)
    .order('created_at', { ascending: false })
    .limit(30)

  return data || []
}

export default async function KnowledgeBasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const answers = await getPublishedAnswers()

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Knowledge Base</p>
          <h1 className="text-3xl font-bold">Published Answers</h1>
          <p className="text-muted-foreground">Search and review past explanations to learn from previous lectures.</p>
        </div>

        <div className="space-y-3">
          {answers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No published answers yet.
              </CardContent>
            </Card>
          ) : (
            answers.map((answer) => (
              <Card key={answer.id}>
                <CardHeader>
                  <CardTitle>{answer.questions?.title || 'Untitled Question'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">By {typeof answer.profiles === 'object' ? (answer.profiles as any).full_name || 'Anonymous' : 'Anonymous'}</p>
                  <p className="mt-2 line-clamp-3">{answer.content}</p>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {new Date(answer.created_at).toLocaleDateString()}
                  </div>
                  <div className="mt-3">
                    <Link href={`/questions/${answer.question_id}`} className="text-primary underline">View full discussion</Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
