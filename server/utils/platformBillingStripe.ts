import Stripe from 'stripe'

const API_VERSION = '2026-07-29.dahlia'

// Same Stripe account as the main quiroflow repo's
// server/utils/platformBillingStripe.ts -- that repo's webhook and this
// panel's Checkout Session creation are two halves of one integration, so
// they must share an account (though deliberately not a client instance;
// each app configures its own secret key).
export function stripeForPlatformBilling(): Stripe {
  const config = useRuntimeConfig()
  if (!config.stripePlatformBillingSecretKey) {
    throw createError({ statusCode: 500, statusMessage: 'Platform billing Stripe is not configured on this deployment' })
  }
  return new Stripe(config.stripePlatformBillingSecretKey, { apiVersion: API_VERSION })
}
