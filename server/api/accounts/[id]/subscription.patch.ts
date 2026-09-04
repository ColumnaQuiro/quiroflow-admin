interface Body {
  planId?: string
  billingInterval?: 'monthly' | 'annual'
  status?: 'trialing' | 'active' | 'past_due' | 'locked' | 'canceled'
  extraProfessionals?: number
  trialEndsAt?: string | null
  comped?: boolean
}

const STATUSES = ['trialing', 'active', 'past_due', 'locked', 'canceled']
const INTERVALS = ['monthly', 'annual']

// A manual escape hatch for the cases Stripe doesn't cover by itself: comping
// an account outside the signup-backfill/"Start subscription" paths,
// extending a trial, fixing a subscription that's out of sync, or locking/
// unlocking by hand. Writes straight to `subscriptions` -- there's no Stripe
// call here on purpose (this only edits QuiroFlow's own record of the
// account's standing, not the underlying Stripe subscription, if any).
export default defineEventHandler(async (event) => {
  const supabase = await requireAdmin(event)
  const accountId = getRouterParam(event, 'id')
  if (!accountId) throw createError({ statusCode: 400, statusMessage: 'Account id is required' })

  const body = await readBody<Body>(event)
  const patch: Record<string, unknown> = {}
  if (body.planId !== undefined) patch.plan_id = body.planId
  if (body.billingInterval !== undefined) {
    if (!INTERVALS.includes(body.billingInterval)) throw createError({ statusCode: 400, statusMessage: 'Invalid billingInterval' })
    patch.billing_interval = body.billingInterval
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    patch.status = body.status
  }
  if (body.extraProfessionals !== undefined) patch.extra_professionals = body.extraProfessionals
  if (body.trialEndsAt !== undefined) patch.trial_ends_at = body.trialEndsAt
  if (body.comped !== undefined) patch.comped = body.comped

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }
  patch.updated_at = new Date().toISOString()

  const { data: existing } = await supabase.from('subscriptions').select('id').eq('account_id', accountId).maybeSingle()
  if (!existing) {
    // No row yet (shouldn't happen post-backfill/signup, but an override
    // should still work for e.g. a hand-created account) -- plan_id is
    // required for a fresh insert.
    if (!patch.plan_id) throw createError({ statusCode: 400, statusMessage: 'planId is required to create a new subscription row' })
    const { error } = await supabase.from('subscriptions').insert({ account_id: accountId, ...patch })
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true }
  }

  const { error } = await supabase.from('subscriptions').update(patch).eq('account_id', accountId)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
