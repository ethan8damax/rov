'use server'

import { createClient } from '@/lib/supabase/server'

export async function redeemInviteAction(token: string, displayName: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) throw new Error('Not authenticated')

  const { error } = await supabase.rpc('redeem_household_invite', {
    p_token: token,
    p_user_id: user.id,
    p_display_name: displayName,
  })
  if (error) throw new Error(error.message)
}
