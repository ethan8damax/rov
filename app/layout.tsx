import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthProvider } from '@/lib/context/auth'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Rov',
  description: 'Household budgeting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>
              {children}
            </AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
