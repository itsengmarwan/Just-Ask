import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteLogo } from '@/components/site-logo'
import { PlusCircle } from 'lucide-react'
import { UserAccountMenu } from '@/components/user-account-menu'
import { NotificationBell } from '@/components/notification-bell'

export function AppHeader({ user }: { user: any }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/55 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <SiteLogo href="/home" className="transition-transform duration-500 hover:scale-[1.03]" />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {user ? (
            <>
              <NotificationBell userId={user.id} />
              <Link href="/ask">
                <Button variant="default" size="sm" className="hidden sm:flex gap-2 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/35 border-gradient-brand">
                  <PlusCircle className="h-4 w-4" />
                  Ask Question
                </Button>
              </Link>
              <UserAccountMenu user={user} />
            </>
          ) : (
            <Link href="/auth/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}