import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

// The Supabase login screen only proves the request carries *some* valid
// session for this Supabase project -- it says nothing about whether that
// person is allowed to see every clinic's billing data. This is the actual
// gate: every API route must call this before doing anything with the
// service-role client (which bypasses RLS entirely, same as
// server/utils/apiTokens.ts's requireApiToken does in the main app -- that
// pattern exists precisely because forgetting an equivalent check there is
// what caused a real production incident, so this repo starts with it built
// in rather than added after the fact).
export async function requireAdmin(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const allowed = (useRuntimeConfig().adminAllowedEmails || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!allowed.includes(user.email.trim().toLowerCase())) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized for the admin panel' })
  }

  return serverSupabaseServiceRole(event)
}
