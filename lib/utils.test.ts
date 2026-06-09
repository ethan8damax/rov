import { pad, shiftMonth, formatMonthLabel, currentMonth, cn, fmt, fmtWhole } from './utils'

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
