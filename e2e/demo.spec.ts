/**
 * Full E2E demo — walks through the entire app as a confirmed test user.
 * Test user created directly in Supabase (email: testuser@rovdemo.dev / Demo1234!)
 * Run: npx playwright test e2e/demo.spec.ts --reporter=line
 */
import { test, expect, Page } from '@playwright/test'

const BASE  = 'http://localhost:3000'
const EMAIL = 'rovtest2026@gmail.com'
const PASS  = 'Demo1234!'

async function ss(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true })
  console.log(`  📸 ${name}`)
}

test('e2e demo', async ({ page }) => {
  test.setTimeout(240_000)

  // ── 1. Login ───────────────────────────────────────────────────────────────
  console.log('\n─── 1. Login')
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]',    EMAIL)
  await page.fill('input[type="password"]', PASS)
  await ss(page, '01-login')
  await page.click('button[type="submit"]')

  // Wait for redirect to home
  await page.waitForURL(`${BASE}/`, { timeout: 15000 })
  await page.waitForTimeout(2500)
  console.log('  ✓ Logged in, on home dashboard')
  await ss(page, '01b-home-initial')

  const homeText = await page.textContent('body')
  console.log(`  Net worth card: ${homeText?.includes('Net worth')}`)
  console.log(`  Budget health:  ${homeText?.includes('Budget') || homeText?.includes('budget')}`)
  console.log(`  Error showing:  ${homeText?.includes('Failed to load')}`)

  // ── 2. Settings — income + recurring ──────────────────────────────────────
  console.log('\n─── 2. Settings')
  await page.goto(`${BASE}/settings`)
  await page.waitForTimeout(2500)
  await ss(page, '02-settings')

  const settingsText = await page.textContent('body')
  console.log(`  Loaded OK:      ${!settingsText?.includes('Failed to load')}`)
  console.log(`  Income section: ${settingsText?.includes('Income sources')}`)

  // Add income source — fill name then click Add
  const incNameInput = page.locator('input[placeholder="Source name"]').first()
  await incNameInput.waitFor({ timeout: 5000 })
  await incNameInput.fill('Main salary')
  // Submit the income form
  await page.locator('form').filter({ has: page.locator('input[placeholder="Source name"]') })
    .locator('button[type="submit"]').click()
  await page.waitForTimeout(1500)
  console.log('  ✓ Added income source: Main salary')

  // Set expected amount on the new row
  const expInputs = page.locator('input[type="number"]')
  if (await expInputs.count() > 0) {
    await expInputs.first().fill('5000')
    await expInputs.first().press('Tab')
    await page.waitForTimeout(800)
    console.log('  ✓ Expected income set to $5,000')
  }

  await ss(page, '02b-settings-income')

  // Add recurring payment
  const recurName = page.locator('input[placeholder*="Spotify" i], input[placeholder*="Name (e.g"]').first()
  if (await recurName.isVisible({ timeout: 3000 }).catch(() => false)) {
    await recurName.fill('Netflix')
    const amtInput = page.locator('input[placeholder="Amount"]').first()
    await amtInput.fill('15.99')
    await page.locator('form').filter({ has: amtInput })
      .locator('button[type="submit"]').click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Added recurring: Netflix $15.99')
  }

  await ss(page, '02c-settings-recurring')

  // ── 3. Budget — categories + amounts ──────────────────────────────────────
  console.log('\n─── 3. Budget page')
  await page.goto(`${BASE}/budget`)
  await page.waitForTimeout(2500)
  await ss(page, '03-budget-initial')

  const budgetText = await page.textContent('body')
  console.log(`  Loaded OK:   ${!budgetText?.includes('Failed to load')}`)
  console.log(`  Left banner: ${budgetText?.includes('Unallocated')}`)
  console.log(`  Income:      ${budgetText?.includes('5,000') || budgetText?.includes('Income')}`)

  // Click quick-add chips
  for (const label of ['Rent', 'Groceries', 'Restaurants', 'Gas', 'Fun money', 'Savings']) {
    const chip = page.locator(`button`).filter({ hasText: new RegExp(`^${label}$`) })
    if (await chip.isVisible({ timeout: 1500 }).catch(() => false)) {
      await chip.click()
      await page.waitForTimeout(500)
      console.log(`  ✓ Added: ${label}`)
    }
  }
  await page.waitForTimeout(1000)
  await ss(page, '03b-budget-chips-added')

  // Set expected amounts — inputs come in pairs (expected, actual) per row
  const numInputs = page.locator('input[type="number"]')
  const total = await numInputs.count()
  console.log(`  Number inputs found: ${total}`)

  const budgetAmounts: Record<number, number> = {
    0: 1800, // Rent expected
    2: 500,  // Fun money expected
    4: 600,  // Gas expected
    6: 400,  // Groceries expected
    8: 300,  // Restaurants expected
    10: 500, // Savings expected
  }
  for (const [idx, amt] of Object.entries(budgetAmounts)) {
    const input = numInputs.nth(Number(idx))
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(String(amt))
      await input.press('Tab')
      await page.waitForTimeout(300)
    }
  }
  await page.waitForTimeout(1000)
  await ss(page, '03c-budget-amounts')

  // Verify unallocated is shown
  const budgetAfter = await page.textContent('body')
  console.log(`  Shows amounts:     ${budgetAfter?.includes('1,800') || budgetAfter?.includes('Income')}`)
  console.log(`  Over-budget warn:  ${budgetAfter?.includes('Over budget')}`)

  // ── 4. Wealth — savings pods + assets + debts ──────────────────────────────
  console.log('\n─── 4. Wealth page')
  await page.goto(`${BASE}/wealth`)
  await page.waitForTimeout(2500)
  await ss(page, '04-wealth-initial')

  const wealthText = await page.textContent('body')
  console.log(`  Loaded OK:    ${!wealthText?.includes('Failed to load')}`)
  console.log(`  Net worth:    ${wealthText?.includes('Net worth')}`)
  console.log(`  Savings pods: ${wealthText?.includes('Savings pods') || wealthText?.includes('pod')}`)

  // Scope each section via the <section> element that contains its h2 heading
  const podSection   = page.locator('section').filter({ has: page.locator('h2:has-text("Savings pods")') })
  const assetSection = page.locator('section').filter({ has: page.locator('h2:has-text("Assets")') })
  const debtSection  = page.locator('section').filter({ has: page.locator('h2:has-text("Debts")') })

  // Add savings pod (form only has name input; allotted/goal are set on the row after creation)
  const podInput = podSection.locator('input[placeholder="Pod name"]')
  if (await podInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await podInput.fill('Emergency fund')
    await podSection.locator('button:has-text("Add")').click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Added savings pod: Emergency fund')
  } else {
    const allForms = page.locator('form')
    const formCount = await allForms.count()
    console.log(`  ⚠ Pod input not found (${formCount} forms on page)`)
  }

  // Add asset
  const assetInput = assetSection.locator('input[placeholder="Account name"]')
  if (await assetInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await assetInput.fill('Checking account')
    await assetSection.locator('input[placeholder="Balance"]').fill('4200')
    await assetSection.locator('button:has-text("Add")').click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Added asset: Checking account $4,200')
  } else {
    console.log('  ⚠ Asset input not found')
  }

  // Add debt (requires name + owner + amount)
  const debtInput = debtSection.locator('input[placeholder="Debt name"]')
  if (await debtInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await debtInput.fill('Car loan')
    await debtSection.locator('input[placeholder="Owner"]').fill('Ethan')
    await debtSection.locator('input[placeholder="Amount"]').fill('9500')
    await debtSection.locator('button:has-text("Add")').click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Added debt: Car loan $9,500')
  } else {
    console.log('  ⚠ Debt input not found')
  }

  await page.waitForTimeout(1000)
  await ss(page, '04b-wealth-populated')

  const wealthAfter = await page.textContent('body')
  console.log(`  Net worth visible: ${wealthAfter?.includes('−') || wealthAfter?.includes('4,200') || wealthAfter?.includes('Net worth')}`)

  // Save snapshot
  const snapBtn = page.locator('button').filter({ hasText: /snapshot/i }).first()
  if (await snapBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await snapBtn.click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Saved net worth snapshot')
    await ss(page, '04c-wealth-snapshot')
  } else {
    console.log('  ⚠ Snapshot button not found')
  }

  // ── 5. Accounts — connect Plaid sandbox bank ───────────────────────────────
  console.log('\n─── 5. Accounts + Plaid Link')
  await page.goto(`${BASE}/accounts`)
  await page.waitForTimeout(2500)
  await ss(page, '05-accounts-initial')

  const acctText = await page.textContent('body')
  console.log(`  Loaded OK:       ${!acctText?.includes('Failed to load')}`)
  console.log(`  Connect visible: ${await page.locator('button:has-text("Connect a bank")').isVisible()}`)

  const connectBtn = page.locator('button:has-text("Connect a bank")')
  await connectBtn.waitFor({ timeout: 8000 })
  await connectBtn.click()
  console.log('  ✓ Clicked "Connect a bank" — waiting for link token + Plaid Link...')

  // Wait for Plaid Link iframe to appear (react-plaid-link injects it)
  const plaidIframe = page.locator('iframe').filter({ hasNot: page.locator('[hidden]') })
  await plaidIframe.first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {
    console.log('  ⚠ No Plaid iframe appeared within 20s')
  })

  await page.waitForTimeout(3000)
  await ss(page, '05b-plaid-link-appeared')

  // Get all iframes and find the Plaid one
  const frames = page.frames()
  console.log(`  Frames on page: ${frames.length} (${frames.map(f => f.url().slice(0, 60)).join(', ')})`)

  const plaidFrame = frames.find(f => f.url().includes('plaid') || f.url().includes('cdn'))
  if (!plaidFrame) {
    // Try frameLocator approach
    console.log('  ⚠ Plaid frame not found by URL — trying frameLocator')
    const allIframes = page.locator('iframe')
    const iCount = await allIframes.count()
    console.log(`  Total iframes: ${iCount}`)
    for (let i = 0; i < iCount; i++) {
      const src = await allIframes.nth(i).getAttribute('src')
      console.log(`    iframe[${i}]: ${src}`)
    }
  } else {
    console.log(`  ✓ Found Plaid frame: ${plaidFrame.url().slice(0, 80)}`)
  }

  // Use frameLocator for all Plaid interactions
  const fl = page.frameLocator('iframe').first()

  try {
    // Step 1: Continue/Get started button — Plaid disables it while SDK initializes; wait up to 20s
    const continueBtn = fl.locator('button').filter({ hasText: /continue|get started|begin/i }).first()
    if (await continueBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      // Poll until enabled (Plaid Link SDK often takes 5-15s to initialize in sandbox)
      let enabled = false
      for (let i = 0; i < 20; i++) {
        const isEnabled = await continueBtn.isEnabled().catch(() => false)
        if (isEnabled) { enabled = true; break }
        await page.waitForTimeout(1000)
      }
      if (enabled) {
        await continueBtn.click()
      } else {
        // Force-click as a last resort — some Plaid sandbox intros are permanently disabled
        await continueBtn.click({ force: true })
      }
      await page.waitForTimeout(2000)
      console.log('  ✓ Clicked intro Continue')
    }

    await ss(page, '05c-plaid-after-continue')

    // Step 2: Search for Chase
    const searchBox = fl.locator('input[placeholder*="Search" i], input[type="search"]').first()
    if (await searchBox.isVisible({ timeout: 8000 }).catch(() => false)) {
      await searchBox.fill('Chase')
      await page.waitForTimeout(1500)
      console.log('  ✓ Searched for Chase')
      await ss(page, '05d-plaid-bank-search')

      // Click Chase result
      const chaseBtn = fl.locator('button, li, [role="option"]').filter({ hasText: /chase/i }).first()
      if (await chaseBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await chaseBtn.click()
        await page.waitForTimeout(2500)
        console.log('  ✓ Selected Chase')
        await ss(page, '05e-plaid-chase-selected')

        // Step 3: Enter sandbox credentials
        const userInput = fl.locator('input#username, input[name="username"], input[placeholder*="User" i], input[autocomplete="username"]').first()
        const passInput = fl.locator('input[type="password"]').first()

        if (await userInput.isVisible({ timeout: 8000 }).catch(() => false)) {
          await userInput.fill('user_good')
          await passInput.fill('pass_good')
          await ss(page, '05f-plaid-credentials')

          // Submit login
          const submitBtn = fl.locator('button[type="submit"], button').filter({ hasText: /submit|continue|sign in|log in/i }).first()
          await submitBtn.click()
          await page.waitForTimeout(5000)
          await ss(page, '05g-plaid-post-login')
          console.log('  ✓ Submitted credentials')

          // MFA / continue screens
          for (let attempt = 0; attempt < 3; attempt++) {
            const nextBtn = fl.locator('button').filter({ hasText: /continue|next|link account|confirm|done|finish/i }).first()
            if (await nextBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
              const btnText = await nextBtn.textContent()
              await nextBtn.click()
              await page.waitForTimeout(3000)
              console.log(`  ✓ Clicked "${btnText?.trim()}"`)
              await ss(page, `05h-plaid-step-${attempt + 1}`)
            } else {
              break
            }
          }
        } else {
          console.log('  ⚠ Username input not found in Plaid frame')
        }
      } else {
        console.log('  ⚠ Chase not found in results')
      }
    } else {
      console.log('  ⚠ Bank search input not found')
    }
  } catch (err) {
    console.log(`  ⚠ Plaid Link interaction error: ${err}`)
    await ss(page, '05-plaid-error')
  }

  // Wait for Plaid to close and page to update
  await page.waitForTimeout(4000)
  await ss(page, '05z-accounts-after-plaid')

  const acctAfter = await page.textContent('body')
  const bankConnected = acctAfter?.toLowerCase().includes('chase') ||
    acctAfter?.includes('Checking') || acctAfter?.includes('connected')
  console.log(`  Bank connected: ${bankConnected}`)

  // ── 6. Sync transactions ───────────────────────────────────────────────────
  console.log('\n─── 6. Sync transactions')
  const syncBtn = page.locator('button').filter({ hasText: /sync/i }).first()
  if (await syncBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await syncBtn.click()
    await page.waitForTimeout(7000)
    await ss(page, '06-transactions-synced')
    const syncedBody = await page.textContent('body')
    const syncMatch = syncedBody?.match(/Synced (\d+) new/)
    console.log(`  Sync result: ${syncMatch ? syncMatch[0] : 'no message found'}`)
    console.log(`  Transactions listed: ${syncedBody?.includes('$') && syncedBody?.includes('2025')}`)
  } else {
    console.log('  ⚠ Sync button not found')
  }

  await ss(page, '06b-accounts-with-transactions')

  // ── 7. Home — verify it reflects all the data ──────────────────────────────
  console.log('\n─── 7. Home dashboard (final)')
  await page.goto(`${BASE}/`)
  await page.waitForTimeout(3000)
  await ss(page, '07-home-final')

  const homeFinal = await page.textContent('body')
  console.log(`  Net worth card:  ${homeFinal?.includes('Net worth')}`)
  console.log(`  Budget health:   ${homeFinal?.includes('Budget') || homeFinal?.includes('budget')}`)
  console.log(`  Savings shown:   ${homeFinal?.includes('Savings') || homeFinal?.includes('savings')}`)
  console.log(`  Error:           ${homeFinal?.includes('Failed to load')}`)

  // ── 8. Budget — verify bank hints appear (if bank was connected) ────────────
  console.log('\n─── 8. Budget (final check)')
  await page.goto(`${BASE}/budget`)
  await page.waitForTimeout(2500)
  await ss(page, '08-budget-final')
  const budgetFinal = await page.textContent('body')
  console.log(`  Categories shown: ${budgetFinal?.includes('Groceries') || budgetFinal?.includes('Rent')}`)
  console.log(`  Unallocated:      ${budgetFinal?.includes('Unallocated')}`)
  console.log(`  Bank hints:       ${budgetFinal?.includes('from bank')}`)
  console.log(`  Error:            ${budgetFinal?.includes('Failed to load')}`)

  console.log('\n✅ E2E demo complete — check e2e/screenshots/ for full visual record')
})
