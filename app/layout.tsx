import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://just-ask-swart.vercel.app'),
  title: {
    default: 'Just Ask | E-JUST Community',
    template: '%s | Just Ask',
  },
  description: 'A dedicated platform for E-JUST university students to ask questions.',
  generator: 'itsengmarwan',
  authors: [{ name: 'Marwan Tarek' }],
  creator: 'Marwan Tarek',
  openGraph: {
    type: 'website',
    url: 'https://just-ask-swart.vercel.app',
    title: 'Just Ask | E-JUST Community',
    description: 'A dedicated platform for E-JUST university students to ask questions.',
    siteName: 'Just Ask',
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${inter.className} font-sans antialiased relative min-h-screen`}>
        <div className="fixed inset-0 -z-30 bg-[url('/bg-ejust.jpg')] bg-cover bg-center bg-no-repeat bg-fixed" />
        <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_80%_18%,rgba(244,63,94,0.15),transparent_40%),linear-gradient(to_bottom,rgba(15,23,42,0.1),transparent_35%)]" />
        <div className="pointer-events-none fixed -top-24 left-[-6rem] -z-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-float-slow" />
        <div className="pointer-events-none fixed top-1/3 right-[-8rem] -z-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl animate-float-delayed" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-background/85 backdrop-blur-[3px]" />

        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="relative z-0 flex min-h-screen flex-col">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
