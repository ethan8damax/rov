'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createHousehold } from '@/lib/queries/households'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user:        User | null
  householdId: string | null
  displayName: string | null
  loading:     boolean
  signOut:     () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, householdId: null, displayName: null, loading: true, signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const supabase = createClient()
    // Do NOT make any supabase.from() calls inside this callback — that would
    // call getSession() while initializePromise is still pending, causing a deadlock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setHouseholdId(null)
        setDisplayName(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Fetch household data in a separate effect so it runs AFTER initializePromise resolves.
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    ;(async () => {
      try {
        let { data } = await supabase
          .from('household_members')
          .select('household_id, display_name')
          .eq('user_id', user.id)
          .maybeSingle()

        // Signup that required email confirmation couldn't create the household
        // at signup time (no session yet) — finish it now that the user has one.
        const pending = !data && localStorage.getItem('rov-pending-household')
        if (pending) {
          const { householdName, displayName: pendingName } = JSON.parse(pending)
          await createHousehold(householdName, pendingName)
          localStorage.removeItem('rov-pending-household')
          ;({ data } = await supabase
            .from('household_members')
            .select('household_id, display_name')
            .eq('user_id', user.id)
            .maybeSingle())
        }

        setHouseholdId(data?.household_id ?? null)
        setDisplayName(data?.display_name ?? null)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  async function signOut() {
    await createClient().auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, householdId, displayName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
