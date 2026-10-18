'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field, FieldLabel, FieldGroup, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { QuestionCard } from '@/components/question-card'
import { Empty } from '@/components/ui/empty'
import { 
  MessageSquare, 
  HelpCircle, 
  ArrowBigUp, 
  Settings,
  User as UserIcon,
  X
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Question, Profile } from '@/lib/types'
import { toast } from 'sonner'

interface ProfileContentProps {
  user: User
  profile: Profile | null
  questions: Question[]
  stats: {
    questions: number
    answers: number
    upvotes: number
  }
}

export function ProfileContent({ user, profile, questions, stats }: ProfileContentProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(
    profile?.full_name || user.user_metadata?.display_name || user.user_metadata?.full_name || ''
  )
  const [bio, setBio] = useState(user.user_metadata?.bio || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initials = (displayName || 'Anonymous User').slice(0, 2).toUpperCase()

  async function handleSave() {
    setError(null)
    setIsLoading(true)

    const supabase = createClient()

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: displayName || 'Anonymous User',
        email: user.email || '',
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      setError(profileError.message)
      setIsLoading(false)
      return
    }

    // Update user metadata
    await supabase.auth.updateUser({
      data: { display_name: displayName, bio },
    })

    toast.success('Profile updated!')
    setIsEditing(false)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left">
              {isEditing ? (
                <FieldGroup className="max-w-md">
                  <Field>
                    <FieldLabel>Display Name</FieldLabel>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your display name"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Bio</FieldLabel>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                  </Field>
                  {error && <FieldError>{error}</FieldError>}
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={isLoading}>
                      {isLoading ? <Spinner className="mr-2" /> : null}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </FieldGroup>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-3 sm:justify-start">
                    <h1 className="text-2xl font-bold">{displayName || 'Anonymous User'}</h1>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditing(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-muted-foreground">{user.email}</p>
                  {bio && <p className="mt-3">{bio}</p>}
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                {stats.questions}
              </div>
              <p className="text-sm text-muted-foreground">Questions</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                {stats.answers}
              </div>
              <p className="text-sm text-muted-foreground">Answers</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                <ArrowBigUp className="h-5 w-5 text-muted-foreground" />
                {stats.upvotes}
              </div>
              <p className="text-sm text-muted-foreground">Upvotes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            My Questions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="mt-4 space-y-3">
          {questions.length === 0 ? (
            <Empty>
              <div className="mb-2 text-muted-foreground"><UserIcon className="h-10 w-10" /></div>
              <div className="text-lg font-medium">No questions yet</div>
              <p className="text-sm text-muted-foreground">You haven't asked any questions. Start engaging with the community!</p>
            </Empty>
          ) : (
            questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                currentUserId={user.id}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
