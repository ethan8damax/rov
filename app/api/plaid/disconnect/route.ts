import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'

// Removes a bank connection: revokes the Plaid item, deletes all related
// accounts and transactions for that item.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { account_id } = await req.json() as { account_id: string }
  if (!account_id) {
    return NextResponse.json({ error: 'account_id required' }, { status: 400 })
  }

  // Look up which item owns this account
  const { data: acct } = await supabase
    .from('plaid_accounts')
    .select('item_id')
    .eq('account_id', account_id)
    .maybeSingle()
  if (!acct) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Get the access token for the item
  const { data: item } = await supabase
    .from('plaid_items')
    .select('id, access_token')
    .eq('id', acct.item_id)
    .maybeSingle()
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // Revoke on Plaid's side (best-effort — don't fail if Plaid errors)
  try {
    await plaidClient.itemRemove({ access_token: item.access_token })
  } catch (err) {
    console.error('[disconnect] itemRemove failed (continuing):', err)
  }

  // Delete transactions for all accounts under this item
  const { data: itemAccounts } = await supabase
    .from('plaid_accounts')
    .select('id')
    .eq('item_id', item.id)
  const accountIds = (itemAccounts ?? []).map(a => a.id)
  if (accountIds.length > 0) {
    await supabase.from('transactions').delete().in('account_id', accountIds)
  }

  // Delete accounts then item
  await supabase.from('plaid_accounts').delete().eq('item_id', item.id)
  await supabase.from('plaid_items').delete().eq('id', item.id)

  return NextResponse.json({ ok: true })
}
