'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data } = await supabase
          .from('household_members')
          .select('household_id, display_name')
          .eq('user_id', session.user.id)
          .maybeSingle()
        setHouseholdId(data?.household_id ?? null)
        setDisplayName(data?.display_name ?? null)
      } else {
        setHouseholdId(null)
        setDisplayName(null)
      }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

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
