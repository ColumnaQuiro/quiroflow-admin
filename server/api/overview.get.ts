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

  const [{ data: accounts, error: accountsError }, { data: plans, error: plansError }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, slug, created_at, subscriptions(id, account_id, plan_id, billing_interval, status, extra_professionals, trial_ends_at, comped)')
      .order('created_at', { ascending: false }),
    supabase.from('plans').select('id, name, monthly_price_cents, annual_price_cents, included_professionals, included_clinics, extra_professional_price_cents, sort_order').order('sort_order'),
  ])
  if (accountsError) throw createError({ statusCode: 500, statusMessage: accountsError.message })
  if (plansError) throw createError({ statusCode: 500, statusMessage: plansError.message })

  const planById = new Map((plans as Plan[] | null ?? []).map((p) => [p.id, p]))

  const rows = ((accounts as AccountRow[] | null) ?? []).map((a) => {
    const sub = Array.isArray(a.subscriptions) ? (a.subscriptions[0] ?? null) : a.subscriptions
    const plan = sub ? (planById.get(sub.plan_id) ?? null) : null
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      createdAt: a.created_at,
      planId: sub?.plan_id ?? null,
      planName: plan?.name ?? null,
      status: sub?.status ?? null,
      billingInterval: sub?.billing_interval ?? null,
      trialEndsAt: sub?.trial_ends_at ?? null,
      comped: sub?.comped ?? false,
      extraProfessionals: sub?.extra_professionals ?? 0,
      monthlyCents: sub && plan ? monthlyEquivalentCents(sub, plan) : null,
    }
  })

  const byPlan: Record<string, number> = {}
  let mrrCents = 0
  for (const r of rows) {
    if (r.planId) byPlan[r.planId] = (byPlan[r.planId] ?? 0) + 1
    // Comped accounts (QuiroFlow's own) are real subscription rows on
    // purpose -- see 0132_billing_plans_and_subscriptions.sql -- but they're
    // priced at 0 and shouldn't inflate the revenue number.
    if (r.status === 'active' && !r.comped && r.monthlyCents) mrrCents += r.monthlyCents
  }

  return {
    totalAccounts: rows.length,
    withSubscription: rows.filter((r) => r.planId).length,
    byPlan,
    mrrCents,
    plans: (plans as Plan[] | null) ?? [],
    accounts: rows,
  }
})
