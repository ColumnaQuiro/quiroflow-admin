// Hand-written, not generated -- this repo has no local Supabase CLI/schema
// of its own (it reads the main quiroflow project's tables directly), so
// these just describe the shape of the two queries in server/api/overview.

export interface Plan {
  id: string
  name: string
  monthly_price_cents: number
  annual_price_cents: number
  included_professionals: number | null
  included_clinics: number | null
  extra_professional_price_cents: number | null
  sort_order: number
  stripe_monthly_price_id: string | null
  stripe_annual_price_id: string | null
  stripe_extra_professional_monthly_price_id: string | null
  stripe_extra_professional_annual_price_id: string | null
}

export interface Subscription {
  id: string
  account_id: string
  plan_id: string
  billing_interval: 'monthly' | 'annual'
  status: 'trialing' | 'active' | 'past_due' | 'locked' | 'canceled'
  extra_professionals: number
  trial_ends_at: string | null
  comped: boolean
}

// annual_price_cents is already the monthly-equivalent rate under annual
// billing (see 0132_billing_plans_and_subscriptions.sql on the main repo),
// so this never multiplies it by 12 -- both fields are "per month", just at
// two different billing cadences.
export function monthlyEquivalentCents(sub: Subscription, plan: Plan): number {
  const base = sub.billing_interval === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents
  const overage = sub.extra_professionals > 0 ? sub.extra_professionals * (plan.extra_professional_price_cents ?? 0) : 0
  return base + overage
}
