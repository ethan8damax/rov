import { createHousehold } from './households'

// createHousehold must go through the create_household RPC, not two separate
// table inserts: a direct insert().select() on households fails RLS, because
// the SELECT-on-RETURNING check requires get_household_id(), which depends on
// the household_members row this same call is trying to create (chicken/egg).
// The RPC derives the user from auth.uid() server-side rather than trusting
// a client-supplied id, so no user id is passed here.
const getUser = jest.fn()
const rpc = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser }, rpc }),
}))

beforeEach(() => {
  getUser.mockReset()
  rpc.mockReset()
})

test('createHousehold calls the create_household RPC with the authenticated user', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  rpc.mockResolvedValue({ error: null })

  await createHousehold('The Levines', 'Ethan')

  expect(rpc).toHaveBeenCalledWith('create_household', {
    p_name: 'The Levines',
    p_display_name: 'Ethan',
  })
})

test('createHousehold throws "Not authenticated" without a session, before calling the RPC', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })

  await expect(createHousehold('The Levines', 'Ethan')).rejects.toThrow('Not authenticated')
  expect(rpc).not.toHaveBeenCalled()
})
