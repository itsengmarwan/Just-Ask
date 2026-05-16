'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldError } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Shield } from 'lucide-react'
import { toast } from 'sonner'
import type { Answer } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { ensureProfile } from '@/lib/ensure-profile'

interface AnswerFormProps {
  questionId: string
  userId: string
  onAnswerSubmitted: (answer: Answer) => void
}

export function AnswerForm({ questionId, userId, onAnswerSubmitted }: AnswerFormProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()

    const profileCheck = await ensureProfile(supabase)
    if (!profileCheck.ok) {
      setError(profileCheck.error || 'Could not verify your profile')
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('answers')
      .insert({
        content,
        question_id: questionId,
        user_id: userId,
        is_anonymous: isAnonymous,
      })
      .select(`*, profiles:user_id (id, full_name, avatar_url)`)
      .single()

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    const { data: questionRow } = await supabase
      .from('questions')
      .select('user_id, title')
      .eq('id', questionId)
      .single()

    if (questionRow?.user_id && questionRow.user_id !== userId) {
      await supabase.from('notifications').insert({
        user_id: questionRow.user_id,
        message: `New answer on "${questionRow.title}"`,
        link: `/questions/${questionId}`,
        type: 'new_answer',
      })
    }

    toast.success('Answer posted!')
    setContent('')
    setIsAnonymous(false)
    onAnswerSubmitted(data as Answer)
    setIsLoading(false)
    router.refresh() // لتحديث الصفحة بعد الإجابة
  }

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">Your Answer</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <Textarea
                placeholder="Write your detailed answer here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={5}
                className="bg-background/50 border-white/10 focus-visible:ring-primary"
              />
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-secondary/20 p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="answer-anonymous" className="text-sm font-medium cursor-pointer">
                  Post anonymously (Hide my name)
                </Label>
              </div>
              <Switch id="answer-anonymous" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>

            {error && <FieldError>{error}</FieldError>}

            <Button type="submit" size="lg" className="w-full sm:w-auto font-bold shadow-lg" disabled={isLoading || !content.trim()}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              Post Answer
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}