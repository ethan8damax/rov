import { createClient } from '@/lib/supabase/client'
import { resolveHouseholdId } from './households'
import type {
  BudgetCategory, BudgetCategoryInsert, BudgetCategoryUpdate,
  IncomeSource, IncomeSourceInsert, IncomeSourceUpdate,
  RecurringPayment, RecurringPaymentInsert, RecurringPaymentUpdate,
} from '@/types'

// ── Budget categories ─────────────────────────────────────────────────────────

export async function getBudgetCategories(month: string): Promise<BudgetCategory[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('household_id', householdId)
    .eq('month', month)
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createBudgetCategory(payload: BudgetCategoryInsert): Promise<BudgetCategory> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('budget_categories')
    .insert({ ...payload, household_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBudgetCategory(id: string, payload: BudgetCategoryUpdate): Promise<BudgetCategory> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('budget_categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBudgetCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('budget_categories').delete().eq('id', id)
  if (error) throw error
}

// ── Income sources ────────────────────────────────────────────────────────────

export async function getIncomeSources(month: string): Promise<IncomeSource[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('income_sources')
    .select('*')
    .eq('household_id', householdId)
    .eq('month', month)
    .order('owner', { ascending: true })
  if (error) throw error
  return data
}

export async function createIncomeSource(payload: IncomeSourceInsert): Promise<IncomeSource> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('income_sources')
    .insert({ ...payload, household_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateIncomeSource(id: string, payload: IncomeSourceUpdate): Promise<IncomeSource> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('income_sources')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteIncomeSource(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('income_sources').delete().eq('id', id)
  if (error) throw error
}

// ── Recurring payments ────────────────────────────────────────────────────────

export async function getRecurringPayments(): Promise<RecurringPayment[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('recurring_payments')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createRecurringPayment(payload: RecurringPaymentInsert): Promise<RecurringPayment> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('recurring_payments')
    .insert({ ...payload, household_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRecurringPayment(id: string, payload: RecurringPaymentUpdate): Promise<RecurringPayment> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recurring_payments')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('recurring_payments').delete().eq('id', id)
  if (error) throw error
}

// ── Carryover ─────────────────────────────────────────────────────────────────

export async function carryoverBudget(fromMonth: string, toMonth: string): Promise<void> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()

  const [{ data: cats }, { data: incomes }] = await Promise.all([
    supabase.from('budget_categories').select('name, expected').eq('household_id', householdId).eq('month', fromMonth),
    supabase.from('income_sources').select('owner, name, expected').eq('household_id', householdId).eq('month', fromMonth),
  ])

  const [{ data: existingCats }, { data: existingInc }] = await Promise.all([
    supabase.from('budget_categories').select('name').eq('household_id', householdId).eq('month', toMonth),
    supabase.from('income_sources').select('name').eq('household_id', householdId).eq('month', toMonth),
  ])

  const existingCatNames = new Set((existingCats ?? []).map(c => c.name.toLowerCase()))
  const existingIncNames = new Set((existingInc ?? []).map(i => i.name.toLowerCase()))

  const newCats = (cats ?? [])
    .filter(c => !existingCatNames.has(c.name.toLowerCase()))
    .map(c => ({ household_id: householdId, name: c.name, month: toMonth, expected: c.expected, actual: 0 }))

  const newIncs = (incomes ?? [])
    .filter(i => !existingIncNames.has(i.name.toLowerCase()))
    .map(i => ({ household_id: householdId, owner: i.owner, name: i.name, month: toMonth, expected: i.expected, actual: 0 }))

  if (newCats.length > 0) {
    const { error: catError } = await supabase.from('budget_categories').insert(newCats)
    if (catError) throw catError
  }
  if (newIncs.length > 0) {
    const { error: incError } = await supabase.from('income_sources').insert(newIncs)
    if (incError) throw incError
  }
}
