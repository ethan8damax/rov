import { createClient } from '@/lib/supabase/client'

export interface TransactionWithCategory {
  id: string
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number
  date: string
  is_pending: boolean
  is_ignored: boolean
  category_id: string | null
  category_name: string | null
  account_name: string | null
  account_mask: string | null
}

export async function getTransactions(
  householdId: string,
  month: string,
): Promise<TransactionWithCategory[]> {
  const supabase = createClient()
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('transactions')
    .select('id, transaction_id, merchant_name, name, amount, date, is_pending, is_ignored, category_id, budget_categories(name), plaid_accounts(name, mask)')
    .eq('household_id', householdId)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(t => ({
    id:             t.id,
    transaction_id: t.transaction_id,
    merchant_name:  t.merchant_name,
    name:           t.name,
    amount:         t.amount,
    date:           t.date,
    is_pending:     t.is_pending,
    is_ignored:     t.is_ignored,
    category_id:    t.category_id,
    category_name:  (t.budget_categories as unknown as { name: string } | null)?.name ?? null,
    account_name:   (t.plaid_accounts as unknown as { name: string; mask: string } | null)?.name ?? null,
    account_mask:   (t.plaid_accounts as unknown as { name: string; mask: string } | null)?.mask ?? null,
  }))
}

export async function getUncategorizedCount(
  householdId: string,
  month: string,
): Promise<number> {
  const supabase = createClient()
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .is('category_id', null)
    .eq('is_pending', false)
    .eq('is_ignored', false)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
  if (error) throw error
  return count ?? 0
}

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string | null,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ category_id: categoryId })
    .eq('id', transactionId)
  if (error) throw error
}

export async function markTransactionIgnored(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ is_ignored: true, category_id: null })
    .eq('id', id)
  if (error) throw error
}

export async function unignoreTransaction(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ is_ignored: false })
    .eq('id', id)
  if (error) throw error
}

export async function getMerchantRules(householdId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('merchant_rules')
    .select('id, merchant_name, category_name')
    .eq('household_id', householdId)
    .order('merchant_name')
  if (error) throw error
  return data as { id: string; merchant_name: string; category_name: string }[]
}

export async function deleteMerchantRule(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('merchant_rules').delete().eq('id', id)
  if (error) throw error
}

export async function upsertMerchantRule(
  householdId: string,
  merchantName: string,
  categoryName: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('merchant_rules')
    .upsert(
      { household_id: householdId, merchant_name: merchantName, category_name: categoryName },
      { onConflict: 'household_id,merchant_name' },
    )
  if (error) throw error
}

export async function getTransactionSumsByCategory(
  householdId: string,
  month: string,
): Promise<{ category_id: string; total: number }[]> {
  const supabase = createClient()
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('household_id', householdId)
    .eq('is_pending', false)
    .not('category_id', 'is', null)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
  if (error) throw error

  const totals: Record<string, number> = {}
  for (const t of data ?? []) {
    if (!t.category_id) continue
    totals[t.category_id] = (totals[t.category_id] ?? 0) + t.amount
  }
  return Object.entries(totals).map(([category_id, total]) => ({ category_id, total }))
}

export async function updateAccountName(plaidAccountId: string, name: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('plaid_accounts')
    .update({ name })
    .eq('account_id', plaidAccountId)
  if (error) throw error
}
