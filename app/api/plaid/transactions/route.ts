import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'
import { resolveCategoryId } from '@/lib/plaid/categorize'

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
  if (!member) return NextResponse.json({ synced: 0 })
  const { household_id } = member

  const { data: items } = await supabase
    .from('plaid_items')
    .select('id, access_token, transactions_cursor')
    .eq('household_id', household_id)
  if (!items || items.length === 0) return NextResponse.json({ synced: 0 })

  const { data: plaidAccounts } = await supabase
    .from('plaid_accounts')
    .select('id, account_id')
    .eq('household_id', household_id)
  const accountMap: Record<string, string> = Object.fromEntries(
    (plaidAccounts ?? []).map(a => [a.account_id, a.id]),
  )

  const [{ data: rules }, { data: categories }] = await Promise.all([
    supabase.from('merchant_rules').select('merchant_name, category_name').eq('household_id', household_id),
    supabase.from('budget_categories').select('id, name, month').eq('household_id', household_id),
  ])
  const merchantRules    = rules      ?? []
  const budgetCategories = categories ?? []

  let totalSynced = 0

  for (const item of items) {
    try {
      let cursor:  string | undefined = item.transactions_cursor ?? undefined
      let hasMore: boolean = true

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.access_token,
          ...(cursor ? { cursor } : {}),
        })
        const { added, modified, removed, next_cursor, has_more } = response.data
        cursor  = next_cursor
        hasMore = has_more

        if (removed.length > 0) {
          const removedIds = removed.map(t => t.transaction_id)
          await supabase.from('transactions').delete().in('transaction_id', removedIds)
        }

        const toUpsert = [...added, ...modified].flatMap(t => {
          const ourAccountId = accountMap[t.account_id]
          if (!ourAccountId) return []
          const txMonth    = (t.date as string).slice(0, 7)
          const categoryId = resolveCategoryId(
            t.merchant_name ?? null,
            merchantRules,
            budgetCategories,
            txMonth,
          )
          return [{
            household_id,
            account_id:     ourAccountId,
            transaction_id: t.transaction_id,
            merchant_name:  t.merchant_name ?? null,
            name:           t.name,
            amount:         t.amount,
            date:           t.date,
            category_id:    categoryId,
            is_pending:     t.pending,
          }]
        })

        if (toUpsert.length > 0) {
          const { error: upsertErr } = await supabase
            .from('transactions')
            .upsert(toUpsert, { onConflict: 'transaction_id' })
          if (upsertErr) throw upsertErr
          totalSynced += toUpsert.length
        }
      }

      await supabase
        .from('plaid_items')
        .update({ transactions_cursor: cursor })
        .eq('id', item.id)
    } catch (err) {
      console.error('[transactions] error syncing item', item.id, err)
    }
  }

  return NextResponse.json({ synced: totalSynced })
}
