import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CircleCheck, CircleX, ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CategorySelect } from '@/components/category-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const questionSchema = z.object({
  title: z.string().trim().min(8).max(180),
  content: z.string().trim().min(20).max(5000),
  category_id: z.string().uuid(),
  is_anonymous: z.boolean(),
})

const alertMessages: Record<string, { title: string; description: string; variant?: 'destructive' }> = {
  success: {
    title: 'Question posted successfully',
    description: 'Your question is now live in the community feed.',
  },
  invalid_input: {
    title: 'Invalid question data',
    description: 'Please add a clear title, useful details, and a valid category.',
    variant: 'destructive',
  },
  invalid_image: {
    title: 'Invalid image file',
    description: 'Image must be JPG, PNG, WEBP, or GIF with max size 5MB.',
    variant: 'destructive',
  },
  upload_failed: {
    title: 'Image upload failed',
    description: 'We could not upload your image. Please try again.',
    variant: 'destructive',
  },
  save_failed: {
    title: 'Question publishing failed',
    description: 'Could not save your question right now. Try again shortly.',
    variant: 'destructive',
  },
}

type AskPageProps = {
  searchParams: Promise<{ status?: string }>
}

export default async function AskPage({ searchParams }: AskPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const resolvedSearchParams = await searchParams
  const status = resolvedSearchParams?.status
  const banner = status ? alertMessages[status] : null

  const { data: categories } = await supabase.from('categories').select('*').order('name')

  async function submitQuestion(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      redirect('/auth/login')
    }

    const parsed = questionSchema.safeParse({
      title: formData.get('title'),
      content: formData.get('content'),
      category_id: formData.get('category_id'),
      is_anonymous: formData.get('is_anonymous') === 'on',
    })

    if (!parsed.success) {
      redirect('/ask?status=invalid_input')
    }

    const { data: matchedCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('id', parsed.data.category_id)
      .single()

    if (!matchedCategory) {
      redirect('/ask?status=invalid_input')
    }

    const file = formData.get('image') as File | null
    let imageUrl: string | null = null

    if (file && file.size > 0) {
      const maxSizeBytes = 5 * 1024 * 1024
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      const isValidImage = file.size <= maxSizeBytes && allowedTypes.includes(file.type)

      if (!isValidImage) {
        redirect('/ask?status=invalid_image')
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const safeExt = /^[a-z0-9]+$/.test(fileExt) ? fileExt : 'jpg'
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`
      const fileBuffer = await file.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('question_images')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600',
        })

      if (uploadError) {
        redirect('/ask?status=upload_failed')
      }

      const { data: { publicUrl } } = supabase.storage.from('question_images').getPublicUrl(fileName)
      imageUrl = publicUrl
    }

    const { error } = await supabase.from('questions').insert({
      title: parsed.data.title,
      content: parsed.data.content,
      category_id: parsed.data.category_id,
      user_id: user.id,
      is_anonymous: parsed.data.is_anonymous,
      image_url: imageUrl,
    })

    if (error) {
      redirect('/ask?status=save_failed')
    }

    revalidatePath('/home')
    redirect('/home')
  }

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <AppHeader user={user} />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:py-12 relative z-10">
        <div className="mb-6 animate-fade-in">
          <Link href="/home">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground rounded-full px-4 -ml-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Questions
            </Button>
          </Link>
        </div>

        {banner && (
          <Alert variant={banner.variant} className="mb-6 border-white/10 bg-card/70 backdrop-blur-sm">
            {banner.variant === 'destructive' ? <CircleX /> : <CircleCheck />}
            <AlertTitle>{banner.title}</AlertTitle>
            <AlertDescription>{banner.description}</AlertDescription>
          </Alert>
        )}

        <Card className="border-white/10 bg-card/40 backdrop-blur-md shadow-2xl animate-slide-up">
          <CardHeader className="pb-6 border-b border-white/5">
            <CardTitle className="text-3xl font-extrabold text-primary">Ask a Question</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Ask clearly, choose the right category, and add context so others can help faster.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form action={submitQuestion} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground font-semibold">Question Title <span className="text-destructive">*</span></Label>
                <Input id="title" name="title" minLength={8} maxLength={180} placeholder="e.g., How to solve Integration by Parts in Math 1?" required className="bg-background/50 border-white/10 focus-visible:ring-primary h-12" />
              </div>

              <CategorySelect categories={categories ?? []} />

              <div className="space-y-2">
                <Label htmlFor="content" className="text-foreground font-semibold">Details <span className="text-destructive">*</span></Label>
                <Textarea id="content" name="content" minLength={20} maxLength={5000} placeholder="Explain your problem, add context, or share what you have tried so far..." rows={8} required className="bg-background/50 border-white/10 focus-visible:ring-primary resize-none" />
                <p className="text-xs text-muted-foreground">Minimum 20 characters helps others understand and answer better.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image" className="text-foreground font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Attach an image (Optional)
                </Label>
                <Input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="bg-background/50 border-white/10 focus-visible:ring-primary file:text-primary file:bg-primary/10 file:border-0 file:ml-4 file:py-2 file:px-4 file:rounded-md cursor-pointer" />
                <p className="text-xs text-muted-foreground">Allowed: JPG, PNG, WEBP, GIF (max 5MB).</p>
              </div>

              <div className="flex items-center bg-secondary/30 p-5 rounded-2xl border border-white/5 hover:border-primary/20 transition-colors space-x-3">
                <Switch id="is_anonymous" name="is_anonymous" className="data-[state=checked]:bg-primary" />
                <Label htmlFor="is_anonymous" className="flex flex-col cursor-pointer gap-1">
                  <span className="font-semibold text-foreground">Ask Anonymously</span>
                  <span className="text-sm text-muted-foreground">Your name and profile picture will be hidden from everyone.</span>
                </Label>
              </div>

              <Button type="submit" size="lg" className="w-full text-md font-bold shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all">
                Post Question
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}