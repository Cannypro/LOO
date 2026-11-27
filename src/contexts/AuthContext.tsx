import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoProfile } from '../lib/demo'
import type { Profile } from '../lib/types'

type AuthContextValue = {
  user: User | { id: string; email: string } | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: { email: string; password: string; username: string; displayName: string; dateOfBirth: string }) => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const demoUser = { id: 'demo-user', email: 'demo@loop.local' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(isSupabaseConfigured ? null : demoUser)
  const [profile, setProfile] = useState<Profile | null>(isSupabaseConfigured ? null : demoProfile)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user || user.id === 'demo-user') return
    const { data, error } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,is_private,is_suspended,created_at').eq('id', user.id).maybeSingle()
    if (error) throw error
    if (data) setProfile(data as Profile)
  }, [user])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        const { data: row } = await supabase!.from('profiles').select('id,username,display_name,bio,avatar_url,is_private,is_suspended,created_at').eq('id', data.session.user.id).maybeSingle()
        if (alive) setProfile((row as Profile | null) ?? null)
      } else {
        setProfile(null)
      }
      if (alive) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setProfile(null)
      else {
        // Deferring the profile query avoids doing extra Supabase work inside the auth callback.
        window.setTimeout(async () => {
          const { data } = await supabase!.from('profiles').select('id,username,display_name,bio,avatar_url,is_private,is_suspended,created_at').eq('id', session.user.id).maybeSingle()
          setProfile((data as Profile | null) ?? null)
        }, 0)
      }
      setLoading(false)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Connect Supabase before signing in.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (input: { email: string; password: string; username: string; displayName: string; dateOfBirth: string }) => {
    if (!supabase) throw new Error('Connect Supabase before creating an account.')
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          username: input.username.toLowerCase().replace(/[^a-z0-9_.]/g, ''),
          display_name: input.displayName.trim(),
          date_of_birth: input.dateOfBirth,
        },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) throw error
    return !data.session
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(() => ({ user, profile, loading, configured: isSupabaseConfigured, refreshProfile, signIn, signUp, signOut }), [user, profile, loading, refreshProfile, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
