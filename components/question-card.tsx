'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowBigUp, MessageSquare, Eye, CheckCircle2 } from 'lucide-react'
import type { Question } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ShareButton } from '@/components/share-button'
import { ensureProfile } from '@/lib/ensure-profile'
import { toggleQuestionUpvote } from '@/lib/question-mutations'

interface QuestionCardProps {
  question: Question
  currentUserId?: string
}

export function QuestionCard({ question, currentUserId }: QuestionCardProps) {
  const router = useRouter()
  const [upvoteCount, setUpvoteCount] = useState(question.upvotes_count || 0)
  const [hasUpvoted, setHasUpvoted] = useState(question.user_has_upvoted || false)
  const [isUpvoting, setIsUpvoting] = useState(false)
  
  const authorName = question.is_anonymous
    ? 'Anonymous Student'
    : question.profiles?.full_name || 'Anonymous Student'
  const initials = authorName.slice(0, 2).toUpperCase()

  async function handleUpvote(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUserId) {
      toast.error('Please sign in to upvote')
      return
    }

    setIsUpvoting(true)
    const supabase = createClient()
    const profileCheck = await ensureProfile(supabase)
    if (!profileCheck.ok) {
      toast.error(profileCheck.error || 'Could not verify your profile')
      setIsUpvoting(false)
      return
    }

    const { error } = await toggleQuestionUpvote(supabase, currentUserId, question.id, hasUpvoted)
    if (error) {
      if (error.code === '23505') toast.error('Already upvoted')
      else toast.error(error.message || 'Failed to update upvote')
    } else {
      setUpvoteCount((prev) => (hasUpvoted ? Math.max(0, prev - 1) : prev + 1))
      setHasUpvoted(!hasUpvoted)
      router.refresh()
    }
    setIsUpvoting(false)
  }

  return (
    <Link href={`/questions/${question.id}`} className="block group">
      <Card className="relative overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 bg-card/45 backdrop-blur-md border-white/10 border-gradient-brand">
        <CardContent className="flex flex-col sm:flex-row gap-4 p-5">
          
          <div className="flex sm:flex-col items-center gap-2 sm:gap-1 bg-muted/35 p-2 sm:p-3 rounded-xl sm:min-w-[60px] border border-white/10">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9 rounded-full transition-all duration-500 hover:bg-primary/20', hasUpvoted && 'bg-primary/15 text-primary')}
              onClick={handleUpvote}
              disabled={isUpvoting}
            >
              <ArrowBigUp className={cn('h-5 w-5 transition-transform duration-500 group-hover:scale-110', hasUpvoted && 'fill-current')} />
            </Button>
            <span className={cn('text-sm font-bold transition-colors duration-500', hasUpvoted ? 'text-primary' : 'text-muted-foreground')}>
              {upvoteCount}
            </span>
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              {question.categories && (
                <Badge variant="secondary" className="shrink-0 bg-secondary/50 hover:bg-secondary/70 text-secondary-foreground transition-colors duration-500">
                  {question.categories.name}
                </Badge>
              )}
              {question.is_resolved && (
                <Badge variant="default" className="shrink-0 gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 transition-colors duration-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Resolved
                </Badge>
              )}
            </div>
            
            <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-tight text-foreground group-hover:text-primary transition-colors duration-500">
              {question.title}
            </h3>
            
            <p className="mb-4 line-clamp-2 text-sm text-muted-foreground/90 leading-relaxed">
              {question.content}
            </p>

            {question.image_url && (
              <div className="mb-4 relative w-full h-48 sm:h-64 rounded-xl overflow-hidden border border-white/10">
                {/* تم إضافة هذا السطر لتخطي خطأ الـ Build الخاص بالصور */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={question.image_url} alt="Question Attachment" className="object-cover w-full h-full hover:scale-105 transition-transform duration-500" />
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-2.5 bg-muted/30 px-2.5 py-1 rounded-full border border-white/5 transition-colors duration-500 group-hover:bg-muted/50">
                {question.is_anonymous ? (
                  <Avatar className="h-5 w-5 ring-1 ring-border">
                    <AvatarFallback className="text-[9px] bg-muted">?</AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-5 w-5 ring-1 ring-border">
                    <AvatarImage src={question.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                )}
                <span className="truncate max-w-[120px]">{authorName}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block">
                  {question.created_at ? formatDistanceToNow(new Date(question.created_at), { addSuffix: true }) : 'Just now'}
                </span>
                <div className="flex items-center gap-1.5 transition-colors duration-500 group-hover:text-foreground ml-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>{question.answers_count || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 mx-2 transition-colors duration-500 group-hover:text-foreground">
                  <Eye className="h-4 w-4" />
                  <span>{question.views_count || 0}</span>
                </div>
                <ShareButton questionId={question.id} title={question.title} />
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </Link>
  )
}