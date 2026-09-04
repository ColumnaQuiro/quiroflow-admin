import type { Plan, Subscription } from '~~/server/utils/billing'

interface AccountRow {
  id: string
  name: string
  slug: string
  created_at: string
  subscriptions: Subscription | Subscription[] | null
}

export default defineEventHandler(async (event) => {
  const supabase = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Account id is required' })

  const [{ data: account, error: accountError }, { data: plans, error: plansError }] = await Promise.all([
    supabase
      .from('accounts')
      .select(
        'id, name, slug, created_at, subscriptions(id, account_id, plan_id, billing_interval, status, extra_professionals, trial_ends_at, comped, stripe_customer_id, stripe_subscription_id, created_at, updated_at)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('plans').select('id, name, monthly_price_cents, annual_price_cents, included_professionals, included_clinics, extra_professional_price_cents, sort_order').order('sort_order'),
  ])
  if (accountError) throw createError({ statusCode: 500, statusMessage: accountError.message })
  if (plansError) throw createError({ statusCode: 500, statusMessage: plansError.message })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  const row = account as AccountRow
  const subscription = Array.isArray(row.subscriptions) ? (row.subscriptions[0] ?? null) : row.subscriptions

  return {
    account: { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at },
    subscription,
    plans: (plans as Plan[] | null) ?? [],
  }
})
