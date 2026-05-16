'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowBigUp, CheckCircle2 } from 'lucide-react'
import type { Answer } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface AnswerCardProps {
  answer: Answer
  currentUserId?: string
  questionOwnerId?: string
  onAccept?: (answerId: string) => void
}

export function AnswerCard({ answer, currentUserId, questionOwnerId, onAccept }: AnswerCardProps) {
  const router = useRouter()
  const [upvoteCount, setUpvoteCount] = useState(answer.upvotes_count || 0)
  const [hasUpvoted, setHasUpvoted] = useState(answer.user_has_upvoted || false)
  const [isUpvoting, setIsUpvoting] = useState(false)
  const [isAccepted, setIsAccepted] = useState(answer.is_accepted)

  const authorName = answer.is_anonymous ? 'Anonymous' : answer.profiles?.full_name || 'Anonymous'
  const initials = authorName.slice(0, 2).toUpperCase()

  const canAccept = currentUserId === questionOwnerId && !isAccepted

  async function handleUpvote() {
    if (!currentUserId) return toast.error('Please sign in to upvote')
    setIsUpvoting(true)
    const supabase = createClient()

    if (hasUpvoted) {
      const { error } = await supabase.from('answer_upvotes').delete().eq('user_id', currentUserId).eq('answer_id', answer.id)
      if (error) toast.error('Failed to remove upvote')
      else { setUpvoteCount((prev) => Math.max(0, prev - 1)); setHasUpvoted(false) }
    } else {
      const { error } = await supabase.from('answer_upvotes').insert({ user_id: currentUserId, answer_id: answer.id })
      if (error) {
        if (error.code === '23505') toast.error('Already upvoted')
        else toast.error('Failed to upvote')
      } else { setUpvoteCount((prev) => prev + 1); setHasUpvoted(true) }
    }
    setIsUpvoting(false)
  }

  async function handleAccept() {
    if (!currentUserId || currentUserId !== questionOwnerId) return

    const supabase = createClient()
    
    // قبول الإجابة
    const { error: ansError } = await supabase.from('answers').update({ is_accepted: true }).eq('id', answer.id)
    if (ansError) { toast.error('Failed to accept answer'); return }

    // 🐛 تم الإصلاح: جعل السؤال (مُحلول) فور قبول الإجابة
    await supabase.from('questions').update({ is_resolved: true }).eq('id', answer.question_id)

    setIsAccepted(true)
    onAccept?.(answer.id)
    toast.success('Answer accepted and question marked as resolved!')
    router.refresh() // تحديث الصفحة لتظهر شارة (Resolved) على السؤال
  }

  return (
    <Card className={cn('transition-all duration-300', isAccepted ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-card/30 backdrop-blur-sm')}>
      <CardContent className="flex gap-4 p-4">
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-10 w-10 rounded-lg transition-all duration-300 hover:bg-primary/20', hasUpvoted && 'bg-primary/10 text-primary')}
            onClick={handleUpvote}
            disabled={isUpvoting}
          >
            <ArrowBigUp className={cn('h-6 w-6 transition-transform hover:scale-110', hasUpvoted && 'fill-current scale-110')} />
          </Button>
          <span className={cn('text-sm font-bold', hasUpvoted && 'text-primary')}>{upvoteCount}</span>
          {isAccepted && <CheckCircle2 className="h-6 w-6 text-emerald-500 mt-2 animate-in fade-in zoom-in" />}
        </div>

        <div className="min-w-0 flex-1">
          {isAccepted && (
            <Badge variant="default" className="mb-3 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Accepted Answer
            </Badge>
          )}
          
          <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
            <p className="whitespace-pre-wrap leading-relaxed">{answer.content}</p>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-full border border-white/5">
              {answer.is_anonymous ? (
                <Avatar className="h-6 w-6 border border-white/10"><AvatarFallback className="text-[10px] bg-muted">AN</AvatarFallback></Avatar>
              ) : (
                <Avatar className="h-6 w-6 border border-white/10">
                  <AvatarImage src={answer.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
              )}
              <span className="font-semibold text-foreground">{authorName}</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-xs">{formatDistanceToNow(new Date(answer.created_at))} ago</span>
            </div>

            {canAccept && (
              <Button variant="outline" size="sm" className="gap-2 shadow-sm hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30 transition-all rounded-full" onClick={handleAccept}>
                <CheckCircle2 className="h-4 w-4" /> Accept
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}