import { stripeForPlatformBilling } from '~/server/utils/platformBillingStripe'

interface Body {
  accountId: string
  planId: string
  billingInterval: 'monthly' | 'annual'
  extraProfessionals?: number
}

// There's no public self-serve signup-with-payment flow yet, so this is how
// a subscription gets started: pick an account + plan here, get back a
// Stripe Checkout link, send it to the customer. Once they pay, Stripe fires
// customer.subscription.created against the main repo's
// /api/stripe/platform-billing-webhook (subscription_data.metadata.account_id
// below is what lets that webhook know which account it belongs to).
export default defineEventHandler(async (event) => {
  const supabase = await requireAdmin(event)
  const config = useRuntimeConfig()

  const body = await readBody<Partial<Body>>(event)
  const { accountId, planId, billingInterval } = body
  const extraProfessionals = body.extraProfessionals ?? 0
  if (!accountId || !planId || (billingInterval !== 'monthly' && billingInterval !== 'annual')) {
    throw createError({ statusCode: 400, statusMessage: 'accountId, planId and billingInterval (monthly|annual) are required' })
  }

  const [{ data: account }, { data: plan }, { data: existingSub }] = await Promise.all([
    supabase.from('accounts').select('id, name').eq('id', accountId).maybeSingle(),
    supabase
      .from('plans')
      .select('id, name, stripe_monthly_price_id, stripe_annual_price_id, stripe_extra_professional_monthly_price_id, stripe_extra_professional_annual_price_id')
      .eq('id', planId)
      .maybeSingle(),
    supabase.from('subscriptions').select('stripe_customer_id').eq('account_id', accountId).maybeSingle(),
  ])
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (!plan) throw createError({ statusCode: 404, statusMessage: 'Plan not found' })

  const priceId = billingInterval === 'annual' ? plan.stripe_annual_price_id : plan.stripe_monthly_price_id
  if (!priceId) throw createError({ statusCode: 500, statusMessage: `Plan "${plan.name}" has no Stripe ${billingInterval} price configured` })

  const lineItems: { price: string; quantity: number }[] = [{ price: priceId, quantity: 1 }]
  if (extraProfessionals > 0) {
    const addOnPriceId = billingInterval === 'annual' ? plan.stripe_extra_professional_annual_price_id : plan.stripe_extra_professional_monthly_price_id
    if (!addOnPriceId) throw createError({ statusCode: 500, statusMessage: `Plan "${plan.name}" has no Stripe extra-professional ${billingInterval} price configured` })
    lineItems.push({ price: addOnPriceId, quantity: extraProfessionals })
  }

  const stripe = stripeForPlatformBilling()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: lineItems,
    ...(existingSub?.stripe_customer_id ? { customer: existingSub.stripe_customer_id } : {}),
    client_reference_id: accountId,
    subscription_data: { metadata: { account_id: accountId } },
    success_url: `${config.public.mainAppUrl}/?checkout=success`,
    cancel_url: `${config.public.mainAppUrl}/?checkout=cancelled`,
  })

  if (!session.url) throw createError({ statusCode: 500, statusMessage: 'Stripe did not return a Checkout URL' })
  return { url: session.url }
})
