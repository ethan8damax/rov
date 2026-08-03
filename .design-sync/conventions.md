## Rov design system — conventions

Rov is a dark-first household budgeting app. Sentence case everywhere — never
title case or ALL CAPS. Font weights are 400 and 500 only, never 600/700.

### Wrapping

Wrap any composition in `ThemeProvider > ToastProvider` (matches the app's
real root layout, minus auth):

```jsx
<ThemeProvider>
  <ToastProvider>
    {/* your composition */}
  </ToastProvider>
</ThemeProvider>
```

`ThemeProvider` toggles a `.light` class on `<html>` (dark is the default —
no class needed for dark). `ToastProvider` supplies `useToast()` — call
`toast(message, 'success' | 'error' | 'info', { action?, duration? })` from
inside it to show a toast; nothing renders without an active call.

### Styling idiom: CSS custom properties, not a utility-class scale

Components style via inline `style={{ color: 'var(--color-x)' }}`, not
Tailwind color/spacing utility classes (Tailwind is used only for layout:
flex, gap, padding, rounding). Always reach for a token below — never a
literal hex or an arbitrary Tailwind color class.

| Token | Use |
|---|---|
| `--color-primary` | brand blue, primary actions, links |
| `--color-positive` | green — savings, "on track", success |
| `--color-negative` | red — over budget, debt, errors |
| `--color-foreground` | primary text |
| `--color-muted` | secondary/label text |
| `--color-surface` | card backgrounds |
| `--color-background` | page background |
| `--color-border` | 0.5px borders, track backgrounds |
| `--color-primary-subtle` / `-positive-subtle` / `-negative-subtle` | tinted badge backgrounds, paired with the non-subtle color for text |

Standard card: `background: var(--color-surface)`, `0.5px solid
var(--color-border)`, `12px` radius, `1rem` padding. Metric card: same
surface, no border, `8px` radius. Progress bars: `6px` tall, `99px` radius.
No gradients, shadows, or blur anywhere.

### Where the truth lives

Read `styles.css` (the token/font closure) and each component's own
`.prompt.md` before composing. `Button`/`Badge`/`ProgressBar` take an
`intent` prop (`primary | positive | negative | neutral`) that maps directly
to the token table above — reuse that prop instead of ad-hoc coloring.

### Example

```jsx
<Card className="w-[280px]">
  <p style={{ color: 'var(--color-foreground)' }}>Groceries</p>
  <ProgressBar value={85} intent="negative" />
  <div className="flex items-center justify-between mt-2">
    <Badge intent="negative">$60 over</Badge>
    <Button size="sm" variant="ghost">Edit</Button>
  </div>
</Card>
```

### Known gaps (this sync)

`Sidebar`, `MobileNav`, `AppShell` are not in this sync (they depend on
Next.js routing internals that don't run outside a real Next.js app).
Everything else outside the 7 authored components above (`AccountCard`,
`TransactionList`, `IncomeTab`, etc.) ships fully functional but without a
curated preview yet — real components, just not yet demonstrated with
realistic composition.
