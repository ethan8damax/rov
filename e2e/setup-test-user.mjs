/**
 * Creates a confirmed test user for E2E tests.
 * Run once before: node e2e/setup-test-user.mjs
 * Requires dev server running on localhost:3000 (for Supabase env vars).
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL    = 'https://lxdfsglbndzbvnmdrzgk.supabase.co'
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZGZzZ2xibmR6YnZubWRyemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTM1MTksImV4cCI6MjA5NjUyOTUxOX0.3rVQajpX2ed9REYjCCRvv4uVpKUIbtjRWTddD5pi0R4'

const EMAIL = 'testuser@rovdemo.dev'
const PASS  = 'Demo1234!'
const NAME  = 'Demo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// 1. Sign up — Supabase creates the user with a properly hashed password.
//    It will send a confirmation email but we ignore that.
console.log('Signing up test user...')
const { data, error } = await supabase.auth.signUp({ email: EMAIL, password: PASS })

if (error && !error.message.includes('already registered')) {
  console.error('signUp error:', error.message)
  process.exit(1)
}

const userId = data?.user?.id
console.log(`User created/exists: ${userId ?? 'already existed'}`)

// 2. Print the user ID for manual SQL confirmation step
console.log(`
Next: run this SQL in Supabase MCP to confirm + create household:

UPDATE auth.users SET email_confirmed_at = now() WHERE email = '${EMAIL}' AND email_confirmed_at IS NULL;

DO $$
DECLARE
  v_uid uuid;
  v_hid uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = '${EMAIL}';
  IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE user_id = v_uid) THEN
    INSERT INTO public.households (id, name) VALUES (v_hid, 'Demo Household');
    INSERT INTO public.household_members (household_id, user_id, display_name) VALUES (v_hid, v_uid, '${NAME}');
  END IF;
END $$;

SELECT u.id, u.email, u.email_confirmed_at IS NOT NULL AS confirmed, m.household_id
FROM auth.users u JOIN public.household_members m ON m.user_id = u.id
WHERE u.email = '${EMAIL}';
`)
