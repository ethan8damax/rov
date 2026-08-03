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

  // Two separate inserts (households, then household_members) can't be done directly
  // from the client: RLS's SELECT-on-RETURNING check for the households insert requires
  // get_household_id(), which depends on the household_members row that doesn't exist
  // yet. An atomic RPC (same pattern as redeem_household_invite) sidesteps that.
  const { error } = await supabase.rpc('create_household', {
    p_name: name,
    p_user_id: user.id,
    p_display_name: displayName,
  })
  if (error) throw error
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
