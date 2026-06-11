export function resolveCategoryId(
  merchantName: string | null,
  rules: { merchant_name: string; category_name: string }[],
  categories: { id: string; name: string; month: string }[],
  transactionMonth: string,
): string | null {
  if (!merchantName) return null
  const rule = rules.find(r => r.merchant_name === merchantName)
  if (!rule) return null
  const category = categories.find(
    c =>
      c.name.toLowerCase() === rule.category_name.toLowerCase() &&
      c.month === transactionMonth,
  )
  return category?.id ?? null
}
