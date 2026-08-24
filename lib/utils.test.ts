import { pad, shiftMonth, formatMonthLabel, currentMonth, cn, fmt, fmtWhole, getPastMonths, categoriesWithBankSums } from './utils'

describe('pad', () => {
  it('pads single digits', () => expect(pad(3)).toBe('03'))
  it('leaves double digits alone', () => expect(pad(12)).toBe('12'))
})

describe('shiftMonth', () => {
  it('increments month', () => expect(shiftMonth('2026-01', 1)).toBe('2026-02'))
  it('rolls over December to January', () => expect(shiftMonth('2026-12', 1)).toBe('2027-01'))
  it('decrements month', () => expect(shiftMonth('2026-03', -1)).toBe('2026-02'))
  it('rolls back January to December', () => expect(shiftMonth('2026-01', -1)).toBe('2025-12'))
})

describe('formatMonthLabel', () => {
  it('formats month string to readable label', () => {
    expect(formatMonthLabel('2026-06')).toBe('June 2026')
  })
})

describe('currentMonth', () => {
  it('returns YYYY-MM format', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('cn', () => {
  it('joins class names', () => expect(cn('a', 'b')).toBe('a b'))
  it('filters falsy values', () => expect(cn('a', false && 'b', undefined, 'c')).toBe('a c'))
})

describe('fmt', () => {
  it('formats number as currency with cents', () => expect(fmt(1234.5)).toBe('$1,234.50'))
  it('uses absolute value', () => expect(fmt(-500)).toBe('$500.00'))
})

describe('fmtWhole', () => {
  it('formats number as whole dollar amount', () => expect(fmtWhole(42810)).toBe('$42,810'))
  it('uses absolute value', () => expect(fmtWhole(-100)).toBe('$100'))
})

describe('categoriesWithBankSums', () => {
  const cats = [
    { id: 'flex-1' },
    { id: 'fixed-1' }, // e.g. a recurring-linked category
  ]

  it('includes fixed (recurring-linked) categories with a positive bank sum, not just flexible ones', () => {
    const sums = [{ category_id: 'flex-1', total: 20 }, { category_id: 'fixed-1', total: 50 }]
    expect(categoriesWithBankSums(cats, sums).map(c => c.id)).toEqual(['flex-1', 'fixed-1'])
  })

  it('excludes categories with no bank sum or a zero total', () => {
    const sums = [{ category_id: 'flex-1', total: 0 }]
    expect(categoriesWithBankSums(cats, sums)).toEqual([])
  })
})

describe('getPastMonths', () => {
  it('returns a single-element array when count is 1', () => {
    expect(getPastMonths('2026-06', 1)).toEqual(['2026-06'])
  })

  it('returns 3 months ending in the given month, oldest first', () => {
    expect(getPastMonths('2026-06', 3)).toEqual(['2026-04', '2026-05', '2026-06'])
  })

  it('rolls back correctly across a year boundary', () => {
    expect(getPastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})
