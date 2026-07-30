import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from './page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

const signUp = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp } }),
}))

const createHousehold = jest.fn()
jest.mock('@/lib/queries/households', () => ({
  createHousehold: (...args: unknown[]) => createHousehold(...args),
}))

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText('Your name (e.g. Ethan)'), { target: { value: 'Sam' } })
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'sam@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
}

beforeEach(() => {
  localStorage.clear()
  signUp.mockReset()
  createHousehold.mockReset()
})

test('signup with an immediate session creates the household right away', async () => {
  signUp.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
  render(<SignupPage />)
  fillAndSubmit()

  await waitFor(() => expect(createHousehold).toHaveBeenCalledWith("Sam's Household", 'Sam'))
  expect(localStorage.getItem('rov-pending-household')).toBeNull()
})

test('signup that requires email confirmation defers household creation instead of throwing "Not authenticated"', async () => {
  // This is the bug: Supabase returns a user but no session until the email link
  // is clicked. The old code called createHousehold() immediately regardless,
  // which threw "Not authenticated" because there was no session to authorize the insert.
  signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
  render(<SignupPage />)
  fillAndSubmit()

  await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument())
  expect(createHousehold).not.toHaveBeenCalled()
  expect(JSON.parse(localStorage.getItem('rov-pending-household')!)).toEqual({
    householdName: "Sam's Household",
    displayName: 'Sam',
  })
  // Form is replaced by the confirmation panel, not left showing alongside it
  expect(screen.queryByPlaceholderText('Household name (e.g. The Levines)')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /go to sign in/i })).toBeInTheDocument()
})
