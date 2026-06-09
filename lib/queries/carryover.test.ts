// Tests the pure filtering logic used in carryoverBudget
// Extracted from the DB-dependent function for unit testing

function filterNewItems<T extends { name: string }>(
  fromItems: T[],
  existingNames: string[],
): T[] {
  const existing = new Set(existingNames.map(n => n.toLowerCase()))
  return fromItems.filter(item => !existing.has(item.name.toLowerCase()))
}

describe('carryover deduplication', () => {
  it('includes items not already in the target month', () => {
    const from = [{ name: 'Groceries', expected: 400 }, { name: 'Rent', expected: 1800 }]
    const existing = ['Rent']
    const result = filterNewItems(from, existing)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Groceries')
  })

  it('is case-insensitive', () => {
    const from = [{ name: 'groceries', expected: 400 }]
    const existing = ['GROCERIES']
    expect(filterNewItems(from, existing)).toHaveLength(0)
  })

  it('includes all items when target month is empty', () => {
    const from = [{ name: 'Gas', expected: 100 }, { name: 'Coffee', expected: 60 }]
    expect(filterNewItems(from, [])).toHaveLength(2)
  })

  it('returns empty array when all items already exist', () => {
    const from = [{ name: 'Rent', expected: 1800 }]
    expect(filterNewItems(from, ['Rent'])).toHaveLength(0)
  })
})
