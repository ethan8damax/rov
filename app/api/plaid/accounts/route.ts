import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'
import type { AccountWithBalance } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ accounts: [] })

  const { data: items } = await supabase
    .from('plaid_items')
    .select('access_token, institution_name')
    .eq('household_id', member.household_id)
  if (!items || items.length === 0) return NextResponse.json({ accounts: [] })

  // Load any custom names the user has saved — prefer these over Plaid's names
  const { data: localAccounts } = await supabase
    .from('plaid_accounts')
    .select('account_id, name')
    .eq('household_id', member.household_id)
  const nameOverrides = new Map((localAccounts ?? []).map(a => [a.account_id, a.name]))

  const allAccounts: AccountWithBalance[] = []
  for (const item of items) {
    try {
      const res = await plaidClient.accountsBalanceGet({ access_token: item.access_token })
      for (const acct of res.data.accounts) {
        allAccounts.push({
          account_id:       acct.account_id,
          name:             nameOverrides.get(acct.account_id) ?? acct.name,
          type:             acct.type,
          subtype:          acct.subtype ?? '',
          mask:             acct.mask ?? '',
          institution_name: item.institution_name,
          balances: {
            current:           acct.balances.current        ?? null,
            available:         acct.balances.available      ?? null,
            iso_currency_code: acct.balances.iso_currency_code ?? null,
          },
        })
      }
    } catch (err) {
      console.error('[accounts] failed to fetch item', err)
    }
  }

  return NextResponse.json({ accounts: allAccounts })
}
