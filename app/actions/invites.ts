'use server'

import { createClient } from '@/lib/supabase/server'

export async function redeemInviteAction(
  token: string,
  displayName: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await supabase.rpc('redeem_household_invite', {
    p_token: token,
    p_user_id: user.id,
    p_display_name: displayName,
  })
  if (error) return { error: error.message }
  return {}
}
