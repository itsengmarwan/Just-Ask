'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { Trash2, ShieldAlert, Users, MessageSquare, AlertOctagon, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').maybeSingle()
    const isAdmin = user?.user_metadata?.role === 'admin' || profile?.role === 'admin'

    if (!user || !isAdmin) {
      toast.error('Access Denied. Admins only.')
      router.push('/home')
      return
    }
    setUser(user)

    const { data: qData } = await supabase
      .from('questions')
      .select('*, profiles:user_id (full_name, email)')
      .order('created_at', { ascending: false })
    
    const { data: pData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    setQuestions(qData || [])
    setProfiles(pData || [])
    setIsLoading(false)
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm('Are you sure you want to completely delete this question?')) return
    const supabase = createClient()
    const { error } = await supabase.from('questions').delete().eq('id', id)
    
    if (error) {
      toast.error('Error deleting question: ' + error.message)
    } else {
      toast.success('Question deleted successfully')
      setQuestions(questions.filter(q => q.id !== id))
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!confirm('WARNING: Are you sure you want to ban/delete this user profile?')) return
    const supabase = createClient()
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    
    if (error) {
      toast.error('Error deleting profile: ' + error.message)
    } else {
      toast.success('Profile deleted successfully')
      setProfiles(profiles.filter(p => p.id !== id))
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="h-10 w-10 text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 -z-10 bg-[url('/bg-ejust.jpg')] bg-cover bg-center opacity-10 blur-md" />
      <AppHeader user={user} />

      <main className="mx-auto max-w-6xl px-4 py-8 relative z-10 animate-fade-in">
        <div className="mb-8 flex items-center gap-4 bg-destructive/10 border border-destructive/20 p-6 rounded-2xl backdrop-blur-md">
          <div className="bg-destructive/20 p-3 rounded-full">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Control Panel</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              With great power comes great responsibility. Manage platform content and users here.
            </p>
          </div>
        </div>

        <Tabs defaultValue="questions" className="w-full">
          <TabsList className="bg-card/50 backdrop-blur-sm border border-white/5 h-14 rounded-xl p-1 w-full max-w-md mb-6">
            <TabsTrigger value="questions" className="rounded-lg flex-1 gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <MessageSquare className="h-4 w-4" /> Manage Questions
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg flex-1 gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="h-4 w-4" /> Manage Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions">
            <Card className="border-white/10 bg-card/60 backdrop-blur-md shadow-xl">
              <CardHeader>
                <CardTitle>All Questions ({questions.length})</CardTitle>
                <CardDescription>Review, edit, or remove any inappropriate questions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-background/50 hover:bg-background/80 transition-colors">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate">{q.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{q.content}</p>
                      <div className="mt-2 text-xs text-muted-foreground/70 flex gap-3">
                        <span>By: {q.is_anonymous ? 'Anonymous' : q.profiles?.full_name || 'Unknown'}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(q.created_at))} ago</span>
                      </div>
                    </div>
                    {/* التعديل هنا: إضافة زر التعديل View & Edit */}
                    <div className="flex gap-2 shrink-0">
                      <Link href={`/questions/${q.id}`}>
                        <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/10 hover:text-primary">
                          <Edit className="h-4 w-4" /> View & Edit
                        </Button>
                      </Link>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteQuestion(q.id)} className="gap-2">
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {questions.length === 0 && <p className="text-center text-muted-foreground py-8">No questions found.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-white/10 bg-card/60 backdrop-blur-md shadow-xl">
              <CardHeader>
                <CardTitle>All User Accounts ({profiles.length})</CardTitle>
                <CardDescription>Manage student and professor accounts on the platform.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profiles.map((p) => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-background/50 hover:bg-background/80 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                        {p.full_name?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h3 className="font-bold">{p.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{p.email}</p>
                        <p className="text-xs text-primary mt-1 font-medium">Reputation: {p.reputation_score}</p>
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-white shrink-0 gap-2" onClick={() => handleDeleteProfile(p.id)}>
                      <AlertOctagon className="h-4 w-4" /> Ban Profile
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}