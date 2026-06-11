import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    public_token: string
    institution: { institution_id: string; name: string }
  }
  if (!body.public_token || !body.institution?.institution_id) {
    return NextResponse.json({ error: 'Missing public_token or institution' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'No household found' }, { status: 400 })
  const { household_id } = member

  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({
      public_token: body.public_token,
    })
    const { access_token, item_id } = exchangeRes.data

    const { data: plaidItem, error: itemErr } = await supabase
      .from('plaid_items')
      .upsert({
        household_id,
        item_id,
        access_token,
        institution_id:   body.institution.institution_id,
        institution_name: body.institution.name,
      }, { onConflict: 'item_id' })
      .select('id')
      .single()
    if (itemErr) throw itemErr

    const accountsRes = await plaidClient.accountsGet({ access_token })
    const rows = accountsRes.data.accounts.map(acct => ({
      item_id:      plaidItem.id,
      household_id,
      account_id:   acct.account_id,
      name:         acct.name,
      type:         acct.type,
      subtype:      acct.subtype ?? '',
      mask:         acct.mask ?? '',
    }))
    if (rows.length > 0) {
      const { error: acctErr } = await supabase
        .from('plaid_accounts')
        .upsert(rows, { onConflict: 'account_id' })
      if (acctErr) throw acctErr
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[exchange]', err)
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 })
  }
}
