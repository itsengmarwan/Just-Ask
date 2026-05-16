'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { AnswerCard } from '@/components/answer-card'
import { AnswerForm } from '@/components/answer-form'
import { ArrowBigUp, MessageSquare, Trash2, Edit, Save, Eye, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ensureProfile } from '@/lib/ensure-profile'
import { softDeleteQuestion, toggleQuestionUpvote } from '@/lib/question-mutations'

interface QuestionDetailProps {
  question: any
  answers: any[]
  currentUserId?: string
  currentUserRole?: string
  isAdmin?: boolean
}

export function QuestionDetail({ question: initialQuestion, answers: initialAnswers, currentUserId, currentUserRole, isAdmin: isAdminProp }: QuestionDetailProps) {
  const router = useRouter()
  
  const [question, setQuestion] = useState(initialQuestion)
  const [answers, setAnswers] = useState(initialAnswers)
  const [upvoteCount, setUpvoteCount] = useState(question.upvotes_count || 0)
  const [hasUpvoted, setHasUpvoted] = useState(question.user_has_upvoted || false)
  const [isUpvoting, setIsUpvoting] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(question.title)
  const [editContent, setEditContent] = useState(question.content)
  const [isSaving, setIsSaving] = useState(false)

  const isAdmin = isAdminProp || currentUserRole === 'admin'
  const isOwner = currentUserId === question.user_id
  const canManage = isAdmin || isOwner

  async function handleDelete() {
    if (!canManage) {
      toast.error('You do not have permission to delete this question')
      return
    }
    if (!confirm('Are you sure you want to delete this question?')) return
    const supabase = createClient()
    const { error } = await softDeleteQuestion(supabase, question.id)
    if (error) {
      toast.error(error.message || 'Failed to delete question')
    } else {
      toast.success('Question deleted successfully')
      router.push('/home')
      router.refresh()
    }
  }

  async function handleSaveEdit() {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error('Title and details cannot be empty')
      return
    }
    setIsSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('questions')
      .update({ title: editTitle, content: editContent })
      .eq('id', question.id)

    if (error) {
      toast.error(error.message || 'Failed to update question')
    } else {
      toast.success('Question updated successfully')
      setQuestion({ ...question, title: editTitle, content: editContent })
      setIsEditing(false)
      router.refresh()
    }
    setIsSaving(false)
  }

  async function handleUpvote() {
    if (!currentUserId) return toast.error('Please sign in to upvote')
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
      setUpvoteCount((prev: number) => (hasUpvoted ? Math.max(0, prev - 1) : prev + 1))
      setHasUpvoted(!hasUpvoted)
      router.refresh()
    }
    setIsUpvoting(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-white/10 bg-card/60 backdrop-blur-md shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex flex-wrap items-center gap-2">
                {question.categories && <Badge variant="secondary">{question.categories.name}</Badge>}
              </div>
              
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-bold bg-background/50 border-primary/30 focus-visible:ring-primary/50"
                  placeholder="Question Title"
                />
              ) : (
                <h1 className="text-2xl font-bold leading-tight text-foreground">{question.title}</h1>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {canManage && !isEditing && (
                <Button variant="outline" size="icon" onClick={() => setIsEditing(true)} title="Edit Question" className="hover:text-primary hover:border-primary/50 transition-colors">
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {canManage && !isEditing && (
                <Button variant="destructive" size="icon" onClick={handleDelete} title="Delete Question" className="hover:bg-destructive/90">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <div className="space-y-4 mb-6">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[150px] bg-background/50 text-base border-primary/30 focus-visible:ring-primary/50"
                placeholder="Question Details"
              />
              <div className="flex gap-3">
                <Button onClick={handleSaveEdit} disabled={isSaving} className="gap-2 shadow-lg hover:-translate-y-0.5 transition-all">
                  <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { setIsEditing(false); setEditTitle(question.title); setEditContent(question.content); }} 
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
              <p className="whitespace-pre-wrap text-base">{question.content}</p>
            </div>
          )}

          {question.image_url && !isEditing && (
            <div className="mb-6 overflow-hidden rounded-xl border border-white/10 shadow-inner">
              <img src={question.image_url} alt="Question Attachment" className="w-full max-h-[500px] object-contain bg-black/5" />
            </div>
          )}

          <Separator className="my-4 border-white/10" />
          
          <div className="mt-3 flex items-center justify-between">
            <Button variant="ghost" className={cn('gap-2 hover:bg-primary/10 hover:text-primary transition-all duration-300', hasUpvoted && 'bg-primary/10 text-primary')} onClick={handleUpvote} disabled={isUpvoting}>
              <ArrowBigUp className={cn('h-5 w-5 transition-transform', hasUpvoted && 'fill-current scale-110')} />
              {upvoteCount} Upvotes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6 animate-slide-up-delayed">
        <h2 className="text-xl font-bold px-1">Answers ({answers.length})</h2>
        
        {currentUserId ? (
          <AnswerForm 
            questionId={question.id} 
            userId={currentUserId} 
            onAnswerSubmitted={(newAns) => setAnswers([...answers, newAns])} 
          />
        ) : (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground font-medium">
              Please sign in to answer this question.
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {answers.map((answer) => (
            <AnswerCard 
              key={answer.id} 
              answer={answer} 
              currentUserId={currentUserId} 
              questionOwnerId={question.user_id} 
              onAccept={(acceptedId) => {
                setAnswers(answers.map(a => a.id === acceptedId ? { ...a, is_accepted: true } : a))
                router.refresh() // أضفنا هذا السطر فقط لتحديث شارة السؤال
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}