// ── Budget ────────────────────────────────────────────────────────────────────

export interface BudgetCategory {
  id: string
  household_id: string
  name: string
  month: string       // YYYY-MM
  expected: number
  actual: number
  created_at: string
}
export type BudgetCategoryInsert = Omit<BudgetCategory, 'id' | 'created_at' | 'household_id'>
export type BudgetCategoryUpdate = Partial<Pick<BudgetCategory, 'name' | 'expected' | 'actual'>>

export interface IncomeSource {
  id: string
  household_id: string
  owner: string
  name: string
  month: string
  expected: number
  actual: number
  created_at: string
}
export type IncomeSourceInsert = Omit<IncomeSource, 'id' | 'created_at' | 'household_id'>
export type IncomeSourceUpdate = Partial<Pick<IncomeSource, 'expected' | 'actual'>>

export interface RecurringPayment {
  id: string
  household_id: string
  name: string
  amount: number
  created_at: string
}
export type RecurringPaymentInsert = Omit<RecurringPayment, 'id' | 'created_at' | 'household_id'>
export type RecurringPaymentUpdate = Partial<Pick<RecurringPayment, 'name' | 'amount'>>

// ── Wealth ────────────────────────────────────────────────────────────────────

export interface SavingsPod {
  id: string
  household_id: string
  name: string
  allotted: number
  goal: number
  created_at: string
}
export type SavingsPodInsert = Omit<SavingsPod, 'id' | 'created_at' | 'household_id'>
export type SavingsPodUpdate = Partial<Pick<SavingsPod, 'name' | 'allotted' | 'goal'>>

export interface Asset {
  id: string
  household_id: string
  name: string
  type: string        // checking | savings | credit_card | investment | other
  balance: number
  plaid_account_id: string | null
  created_at: string
}
export type AssetInsert = Omit<Asset, 'id' | 'created_at' | 'household_id' | 'plaid_account_id'> & { plaid_account_id?: string | null }
export type AssetUpdate = Partial<Pick<Asset, 'name' | 'type' | 'balance'>>

export interface Debt {
  id: string
  household_id: string
  name: string
  owner: string
  amount_owed: number
  interest_rate: number
  plaid_account_id: string | null
  created_at: string
}
export type DebtInsert = Omit<Debt, 'id' | 'created_at' | 'household_id' | 'plaid_account_id'> & { plaid_account_id?: string | null }
export type DebtUpdate = Partial<Pick<Debt, 'name' | 'owner' | 'amount_owed' | 'interest_rate'>>

export interface NetWorthSnapshot {
  id: string
  household_id: string
  month: string
  total_assets: number
  total_debt: number
  net_worth: number
  created_at: string
}
export type NetWorthSnapshotInsert = Omit<NetWorthSnapshot, 'id' | 'created_at' | 'household_id'>

// ── Household ─────────────────────────────────────────────────────────────────

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  display_name: string
  created_at: string
}

export interface HouseholdInvite {
  id: string
  household_id: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}

// ── Plaid ─────────────────────────────────────────────────────────────────────

export interface PlaidItem {
  id: string
  household_id: string
  item_id: string
  access_token: string          // server-side only — never return to client
  institution_id: string
  institution_name: string
  transactions_cursor: string | null
  created_at: string
}

export interface PlaidAccount {
  id: string
  item_id: string
  household_id: string
  account_id: string            // Plaid's account ID (text)
  name: string
  type: string
  subtype: string
  mask: string
}

export interface Transaction {
  id: string
  household_id: string
  account_id: string            // our UUID → plaid_accounts.id
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number                // positive = expense, negative = income
  date: string                  // YYYY-MM-DD
  category_id: string | null
  is_pending: boolean
  created_at: string
}

export interface MerchantRule {
  id: string
  household_id: string
  merchant_name: string
  category_name: string
  created_at: string
}

// Safe account data returned from /api/plaid/accounts (no access_token)
export interface AccountWithBalance {
  account_id: string            // Plaid's ID (text)
  name: string
  type: string
  subtype: string
  mask: string
  institution_name: string
  balances: {
    current: number | null
    available: number | null
    iso_currency_code: string | null
  }
}
