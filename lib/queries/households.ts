import { createClient } from '@/lib/supabase/client'

export async function resolveHouseholdId(): Promise<string> {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No household — complete sign-up first')
  return data.household_id
}

export async function getHouseholdMemberNames(): Promise<string[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('household_members')
    .select('display_name')
    .eq('household_id', householdId)
  if (error) throw error
  return (data ?? []).map(m => m.display_name)
}

export async function createHousehold(name: string, displayName: string): Promise<void> {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) throw new Error('Not authenticated')

  const { data: household, error: hErr } = await supabase
    .from('households')
    .insert({ name })
    .select()
    .single()
  if (hErr) throw hErr

  const { error: mErr } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, display_name: displayName })
  if (mErr) throw mErr
}

export async function createInvite(householdId: string): Promise<string> {
  const supabase = createClient()

  const { count } = await supabase
    .from('household_invites')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())

  if ((count ?? 0) >= 1) {
    throw new Error('An active invite already exists. Wait for it to expire or be used before generating a new one.')
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('household_invites')
    .insert({ household_id: householdId, token, expires_at: expiresAt })
  if (error) throw error
  return token
}

export async function redeemInvite(token: string, displayName: string): Promise<void> {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) throw new Error('Not authenticated')

  const { data: invite, error: invErr } = await supabase
    .from('household_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (invErr) throw invErr
  if (!invite) throw new Error('Invalid invite link')
  if (invite.used_at) throw new Error('This invite has already been used')
  if (new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired')

  const { error: mErr } = await supabase
    .from('household_members')
    .insert({ household_id: invite.household_id, user_id: user.id, display_name: displayName })
  if (mErr) throw mErr

  await supabase
    .from('household_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)
}
