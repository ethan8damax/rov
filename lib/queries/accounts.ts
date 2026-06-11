import { createClient } from '@/lib/supabase/client'

export interface TransactionWithCategory {
  id: string
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number
  date: string
  is_pending: boolean
  category_id: string | null
  category_name: string | null
}

export async function getTransactions(
  householdId: string,
  limit = 150,
): Promise<TransactionWithCategory[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('id, transaction_id, merchant_name, name, amount, date, is_pending, category_id, budget_categories(name)')
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(t => ({
    id:             t.id,
    transaction_id: t.transaction_id,
    merchant_name:  t.merchant_name,
    name:           t.name,
    amount:         t.amount,
    date:           t.date,
    is_pending:     t.is_pending,
    category_id:    t.category_id,
    category_name:  (t.budget_categories as { name: string } | null)?.name ?? null,
  }))
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
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('household_id', householdId)
    .eq('is_pending', false)
    .not('category_id', 'is', null)
    .gte('date', `${month}-01`)
    .lte('date', `${month}-31`)
  if (error) throw error

  const totals: Record<string, number> = {}
  for (const t of data ?? []) {
    if (!t.category_id) continue
    totals[t.category_id] = (totals[t.category_id] ?? 0) + t.amount
  }
  return Object.entries(totals).map(([category_id, total]) => ({ category_id, total }))
}
