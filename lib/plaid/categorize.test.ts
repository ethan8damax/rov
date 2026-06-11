import { resolveCategoryId } from './categorize'

const rules = [
  { merchant_name: "Trader Joe's", category_name: 'Groceries' },
  { merchant_name: 'Starbucks',    category_name: 'Coffee' },
]

const categories = [
  { id: 'cat-g-jun', name: 'Groceries', month: '2026-06' },
  { id: 'cat-c-jun', name: 'Coffee',    month: '2026-06' },
  { id: 'cat-g-may', name: 'Groceries', month: '2026-05' },
]

describe('resolveCategoryId', () => {
  it('returns null when merchant_name is null', () => {
    expect(resolveCategoryId(null, rules, categories, '2026-06')).toBeNull()
  })

  it('returns null when no rule matches the merchant', () => {
    expect(resolveCategoryId('Amazon', rules, categories, '2026-06')).toBeNull()
  })

  it('resolves merchant to category_id in the correct month', () => {
    expect(resolveCategoryId("Trader Joe's", rules, categories, '2026-06')).toBe('cat-g-jun')
  })

  it('returns null when rule exists but no matching category this month', () => {
    expect(resolveCategoryId('Starbucks', rules, categories, '2026-07')).toBeNull()
  })

  it('resolves to the correct month when multiple months share the same category name', () => {
    expect(resolveCategoryId("Trader Joe's", rules, categories, '2026-05')).toBe('cat-g-may')
  })

  it('is case-insensitive when matching category_name to rule category_name', () => {
    const mixedRules = [{ merchant_name: 'Shell', category_name: 'gas' }]
    const mixedCats  = [{ id: 'cat-gas', name: 'Gas', month: '2026-06' }]
    expect(resolveCategoryId('Shell', mixedRules, mixedCats, '2026-06')).toBe('cat-gas')
  })
})
