'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'

export default function VerifyRolePage() {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    
    const response = await fetch('/api/verify-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(result.error || 'Invalid access code!')
    } else {
      const newRole = result.role as string
      toast.success(`Account successfully upgraded to ${newRole.toUpperCase()}!`)
      router.push(newRole === 'admin' ? '/admin' : '/professor')
      router.refresh()
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative px-4">
      <div className="fixed inset-0 -z-10 bg-[url('/bg-ejust.jpg')] bg-cover bg-center opacity-20 blur-sm" />
      
      <Card className="w-full max-w-md border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Role Verification</CardTitle>
          <CardDescription>Enter the secret code provided by the university IT to upgrade your account access.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Enter Access Code" 
              value={code} 
              onChange={(e) => setCode(e.target.value)}
              required
              className="text-center tracking-widest"
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify & Upgrade'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}