import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import JoinPage from './page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams('token=abc123'),
}))

const signUp = jest.fn()
const signInWithPassword = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp, signInWithPassword } }),
}))

const redeemInviteAction = jest.fn()
jest.mock('@/app/actions/invites', () => ({
  redeemInviteAction: (...args: unknown[]) => redeemInviteAction(...args),
}))

beforeEach(() => {
  localStorage.clear()
  signUp.mockReset()
  signInWithPassword.mockReset()
  redeemInviteAction.mockReset()
  redeemInviteAction.mockResolvedValue({})
})

test('name typed on the signup tab survives the confirm-email round trip to the sign-in tab', async () => {
  // First visit: signup tab, confirmation required (no session yet)
  signUp.mockResolvedValue({ data: { session: null }, error: null })
  const { unmount } = render(<JoinPage />)
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Jess' } })
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'jess@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: /join household/i }))
  await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument())
  expect(localStorage.getItem('rov-pending-join-name')).toBe('Jess')
  unmount()

  // Second visit (fresh page load, e.g. after clicking the email link): sign-in tab,
  // which never asks for a name again.
  signInWithPassword.mockResolvedValue({ error: null })
  render(<JoinPage />)
  fireEvent.click(screen.getByText('Sign in'))
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'jess@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: /join household/i }))

  await waitFor(() => expect(redeemInviteAction).toHaveBeenCalledWith('abc123', 'Jess'))
  expect(localStorage.getItem('rov-pending-join-name')).toBeNull()
})
