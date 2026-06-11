import { createClient } from '@/lib/supabase/client'
import { resolveHouseholdId } from './households'
import type {
  SavingsPod, SavingsPodInsert, SavingsPodUpdate,
  Asset, AssetInsert, AssetUpdate,
  Debt, DebtInsert, DebtUpdate,
  NetWorthSnapshot, NetWorthSnapshotInsert,
  AccountWithBalance,
} from '@/types'

// ── Savings pods ──────────────────────────────────────────────────────────────

export async function getSavingsPods(): Promise<SavingsPod[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('savings_pods').select('*')
    .eq('household_id', householdId).order('name')
  if (error) throw error
  return data
}

export async function createSavingsPod(payload: SavingsPodInsert): Promise<SavingsPod> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('savings_pods').insert({ ...payload, household_id }).select().single()
  if (error) throw error
  return data
}

export async function updateSavingsPod(id: string, payload: SavingsPodUpdate): Promise<SavingsPod> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('savings_pods').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteSavingsPod(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('savings_pods').delete().eq('id', id)
  if (error) throw error
}

// ── Assets ────────────────────────────────────────────────────────────────────

export async function getAssets(): Promise<Asset[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('assets').select('*').eq('household_id', householdId).order('name')
  if (error) throw error
  return data
}

export async function createAsset(payload: AssetInsert): Promise<Asset> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('assets').insert({ ...payload, household_id }).select().single()
  if (error) throw error
  return data
}

export async function updateAsset(id: string, payload: AssetUpdate): Promise<Asset> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('assets').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteAsset(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('assets').delete().eq('id', id)
  if (error) throw error
}

// ── Debts ─────────────────────────────────────────────────────────────────────

export async function getDebts(): Promise<Debt[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('debts').select('*').eq('household_id', householdId).order('owner')
  if (error) throw error
  return data
}

export async function createDebt(payload: DebtInsert): Promise<Debt> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('debts').insert({ ...payload, household_id }).select().single()
  if (error) throw error
  return data
}

export async function updateDebt(id: string, payload: DebtUpdate): Promise<Debt> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('debts').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteDebt(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) throw error
}

// ── Net worth snapshots ───────────────────────────────────────────────────────

export async function getNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('net_worth_snapshots').select('*')
    .eq('household_id', householdId).order('month')
  if (error) throw error
  return data
}

export async function createNetWorthSnapshot(payload: NetWorthSnapshotInsert): Promise<NetWorthSnapshot> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .upsert({ ...payload, household_id }, { onConflict: 'household_id,month' })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteNetWorthSnapshot(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('net_worth_snapshots').delete().eq('id', id)
  if (error) throw error
}

// ── Plaid balance sync ────────────────────────────────────────────────────────

// Upserts assets (depository/investment) and debts (credit) from live Plaid
// account balances. Matches on plaid_account_id so re-running is safe.
export async function syncPlaidBalances(
  accounts: AccountWithBalance[],
): Promise<{ assets: Asset[]; debts: Debt[] }> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()

  const syncedAssets: Asset[] = []
  const syncedDebts:  Debt[]  = []

  for (const acct of accounts) {
    const balance = acct.balances.current ?? acct.balances.available ?? 0
    const name    = `${acct.name}${acct.mask ? ` ···${acct.mask}` : ''}`

    if (acct.type === 'credit') {
      const { data, error } = await supabase
        .from('debts')
        .upsert(
          {
            household_id,
            name,
            owner:            acct.institution_name,
            amount_owed:      Math.max(0, balance),
            interest_rate:    0,
            plaid_account_id: acct.account_id,
          },
          { onConflict: 'plaid_account_id' },
        )
        .select()
        .single()
      if (!error && data) syncedDebts.push(data)
    } else if (acct.type === 'depository' || acct.type === 'investment') {
      const typeMap: Record<string, string> = {
        checking:   'checking',
        savings:    'savings',
        investment: 'investment',
        cd:         'savings',
        'money market': 'savings',
      }
      const assetType = typeMap[acct.subtype] ?? (acct.type === 'investment' ? 'investment' : 'checking')

      const { data, error } = await supabase
        .from('assets')
        .upsert(
          {
            household_id,
            name,
            type:             assetType,
            balance:          Math.max(0, balance),
            plaid_account_id: acct.account_id,
          },
          { onConflict: 'plaid_account_id' },
        )
        .select()
        .single()
      if (!error && data) syncedAssets.push(data)
    }
  }

  return { assets: syncedAssets, debts: syncedDebts }
}
