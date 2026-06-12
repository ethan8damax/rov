import { createClient } from '@/lib/supabase/client'
import { resolveHouseholdId } from './households'
import { currentMonth, shiftMonth } from '@/lib/utils'
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

// ── Past months bulk fetch (for trend charts) ─────────────────────────────────

export async function getBudgetCategoriesPastMonths(months: string[]): Promise<BudgetCategory[]> {
  if (months.length === 0) return []
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('household_id', householdId)
    .in('month', months)
    .order('month', { ascending: true })
  if (error) throw error
  return data
}

// ── Carryover & month setup ───────────────────────────────────────────────────

export interface CarryoverResult {
  fromMonth: string
  categoryIds: string[]
  incomeIds: string[]
}

export async function carryoverBudget(fromMonth: string, toMonth: string): Promise<CarryoverResult> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()

  // Only flexible categories copy; fixed bills are regenerated by seeding.
  const [{ data: cats }, { data: incomes }] = await Promise.all([
    supabase.from('budget_categories').select('name, expected').eq('household_id', householdId).eq('month', fromMonth).is('recurring_payment_id', null),
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

  let categoryIds: string[] = []
  let incomeIds: string[] = []

  if (newCats.length > 0) {
    const { data, error } = await supabase.from('budget_categories').insert(newCats).select('id')
    if (error) throw error
    categoryIds = (data ?? []).map(r => r.id)
  }
  if (newIncs.length > 0) {
    const { data, error } = await supabase.from('income_sources').insert(newIncs).select('id')
    if (error) throw error
    incomeIds = (data ?? []).map(r => r.id)
  }
  return { fromMonth, categoryIds, incomeIds }
}

export async function undoCarryover(categoryIds: string[], incomeIds: string[]): Promise<void> {
  const supabase = createClient()
  if (categoryIds.length > 0) {
    const { error } = await supabase.from('budget_categories').delete().in('id', categoryIds)
    if (error) throw error
  }
  if (incomeIds.length > 0) {
    const { error } = await supabase.from('income_sources').delete().in('id', incomeIds)
    if (error) throw error
  }
}

/**
 * For each recurring payment without a linked category in `month`:
 * adopt a same-named flexible category if one exists, else insert a fixed row.
 * Returns true if anything changed. Idempotent.
 */
export async function seedFixedCategories(month: string): Promise<boolean> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const [recurrings, cats] = await Promise.all([getRecurringPayments(), getBudgetCategories(month)])

  const linkedIds = new Set(cats.map(c => c.recurring_payment_id).filter(Boolean))
  const adoptedIds = new Set<string>()
  let mutated = false

  for (const r of recurrings) {
    if (linkedIds.has(r.id)) continue
    const adopt = cats.find(c =>
      !c.recurring_payment_id && !adoptedIds.has(c.id) && c.name.toLowerCase() === r.name.toLowerCase(),
    )
    if (adopt) {
      const { error } = await supabase.from('budget_categories').update({ recurring_payment_id: r.id }).eq('id', adopt.id)
      if (error) throw error
      adoptedIds.add(adopt.id)
    } else {
      const { error } = await supabase.from('budget_categories').insert({
        household_id: householdId, name: r.name, month, expected: r.amount, actual: 0, recurring_payment_id: r.id,
      })
      if (error) throw error
    }
    mutated = true
  }
  return mutated
}

/**
 * Run on Budget page load. Past months are never touched.
 * Current month: auto-carryover when it has no flexible categories and no income,
 * then seed fixed bills. Future months: seeding only.
 * Returns carryover info for the undo toast, or null.
 */
export async function ensureMonthSetup(month: string, skipCarryover = false): Promise<CarryoverResult | null> {
  if (month < currentMonth()) return null

  let copied: CarryoverResult | null = null
  if (month === currentMonth() && !skipCarryover) {
    const [cats, incs] = await Promise.all([getBudgetCategories(month), getIncomeSources(month)])
    const flexibleCount = cats.filter(c => c.recurring_payment_id === null).length
    if (flexibleCount === 0 && incs.length === 0) {
      const result = await carryoverBudget(shiftMonth(month, -1), month)
      if (result.categoryIds.length > 0 || result.incomeIds.length > 0) copied = result
    }
  }
  await seedFixedCategories(month)
  return copied
}

// ── Recurring payment cascades ────────────────────────────────────────────────

/** Update a recurring payment and propagate name/amount to linked categories in the current + future months. */
export async function updateRecurringPaymentCascade(id: string, payload: RecurringPaymentUpdate): Promise<RecurringPayment> {
  const updated = await updateRecurringPayment(id, payload)
  const catPatch: { name?: string; expected?: number } = {}
  if (payload.name !== undefined) catPatch.name = payload.name
  if (payload.amount !== undefined) catPatch.expected = payload.amount
  if (Object.keys(catPatch).length > 0) {
    const supabase = createClient()
    const { error } = await supabase
      .from('budget_categories')
      .update(catPatch)
      .eq('recurring_payment_id', id)
      .gte('month', currentMonth())
    if (error) throw error
  }
  return updated
}

/**
 * Delete a recurring payment. Linked categories in the current + future months are
 * deleted when no transactions reference them; rows with transactions survive as
 * flexible categories (FK on delete set null). Past months keep their rows.
 */
export async function deleteRecurringPaymentCascade(id: string): Promise<void> {
  const supabase = createClient()
  const { data: linked, error: linkedErr } = await supabase
    .from('budget_categories').select('id').eq('recurring_payment_id', id).gte('month', currentMonth())
  if (linkedErr) throw linkedErr
  const ids = (linked ?? []).map(c => c.id)
  if (ids.length > 0) {
    const { data: used, error: usedErr } = await supabase
      .from('transactions').select('category_id').in('category_id', ids)
    if (usedErr) throw usedErr
    const usedSet = new Set((used ?? []).map(t => t.category_id))
    const deletable = ids.filter(cid => !usedSet.has(cid))
    if (deletable.length > 0) {
      const { error } = await supabase.from('budget_categories').delete().in('id', deletable)
      if (error) throw error
    }
  }
  await deleteRecurringPayment(id)
}
