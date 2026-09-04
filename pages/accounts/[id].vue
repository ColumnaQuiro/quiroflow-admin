<script setup lang="ts">
interface Plan {
  id: string
  name: string
  monthly_price_cents: number
  annual_price_cents: number
  extra_professional_price_cents: number | null
}
interface Subscription {
  id: string
  account_id: string
  plan_id: string
  billing_interval: 'monthly' | 'annual'
  status: 'trialing' | 'active' | 'past_due' | 'locked' | 'canceled'
  extra_professionals: number
  trial_ends_at: string | null
  comped: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}
interface Detail {
  account: { id: string; name: string; slug: string; createdAt: string }
  subscription: Subscription | null
  plans: Plan[]
}

const route = useRoute()
const supabase = useSupabaseClient()
const accountId = route.params.id as string

const detail = ref<Detail | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await $fetch<Detail>(`/api/accounts/${accountId}`)
    resetForm()
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? err?.message ?? 'Failed to load.'
  }
  loading.value = false
}
onMounted(load)

function dateStr(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : '—'
}
function dateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : ''
}
// Manual override form -- prefilled from the current row, only sent fields
// that actually changed.
const formPlanId = ref('')
const formInterval = ref<'monthly' | 'annual'>('monthly')
const formStatus = ref<Subscription['status']>('trialing')
const formExtra = ref(0)
const formTrialEndsAt = ref('')
const formComped = ref(false)
const savingOverride = ref(false)
const overrideError = ref('')
const overrideSaved = ref(false)

function resetForm() {
  const sub = detail.value?.subscription
  formPlanId.value = sub?.plan_id ?? detail.value?.plans[0]?.id ?? ''
  formInterval.value = sub?.billing_interval ?? 'monthly'
  formStatus.value = sub?.status ?? 'trialing'
  formExtra.value = sub?.extra_professionals ?? 0
  formTrialEndsAt.value = dateInputValue(sub?.trial_ends_at ?? null)
  formComped.value = sub?.comped ?? false
}

async function saveOverride() {
  savingOverride.value = true
  overrideError.value = ''
  overrideSaved.value = false
  try {
    await $fetch(`/api/accounts/${accountId}/subscription`, {
      method: 'PATCH',
      body: {
        planId: formPlanId.value,
        billingInterval: formInterval.value,
        status: formStatus.value,
        extraProfessionals: formExtra.value,
        trialEndsAt: formTrialEndsAt.value ? new Date(formTrialEndsAt.value).toISOString() : null,
        comped: formComped.value,
      },
    })
    overrideSaved.value = true
    await load()
  } catch (err: any) {
    overrideError.value = err?.data?.statusMessage ?? err?.message ?? 'Failed to save.'
  }
  savingOverride.value = false
}

const stripeCustomerUrl = computed(() => {
  const id = detail.value?.subscription?.stripe_customer_id
  return id ? `https://dashboard.stripe.com/test/customers/${id}` : null
})

// Same "Start subscription" flow as the dashboard table.
const checkoutOpen = ref(false)
const checkoutPlanId = ref('')
const checkoutInterval = ref<'monthly' | 'annual'>('monthly')
const checkoutExtra = ref(0)
const checkoutUrl = ref('')
const checkoutError = ref('')
const checkoutLoading = ref(false)

function openCheckout() {
  const sub = detail.value?.subscription
  checkoutPlanId.value = sub?.plan_id ?? detail.value?.plans[0]?.id ?? ''
  checkoutInterval.value = sub?.billing_interval ?? 'monthly'
  checkoutExtra.value = sub?.extra_professionals ?? 0
  checkoutUrl.value = ''
  checkoutError.value = ''
  checkoutOpen.value = true
}
async function createCheckoutLink() {
  checkoutLoading.value = true
  checkoutError.value = ''
  try {
    const res = await $fetch<{ url: string }>('/api/create-checkout', {
      method: 'POST',
      body: { accountId, planId: checkoutPlanId.value, billingInterval: checkoutInterval.value, extraProfessionals: checkoutExtra.value },
    })
    checkoutUrl.value = res.url
  } catch (err: any) {
    checkoutError.value = err?.data?.statusMessage ?? err?.message ?? 'Failed to create the Checkout link.'
  }
  checkoutLoading.value = false
}
const copied = ref(false)
async function copyCheckoutUrl() {
  await navigator.clipboard.writeText(checkoutUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function signOut() {
  await supabase.auth.signOut()
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div class="flex items-center gap-2">
        <img src="/logo/quiroflow-mark.svg" alt="" class="h-6 w-6" />
        <h1 class="text-base font-semibold text-gray-900">QuiroFlow Admin</h1>
      </div>
      <button type="button" class="text-sm text-gray-500 hover:text-gray-700" @click="signOut">Sign out</button>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-8">
      <NuxtLink to="/" class="text-xs font-medium text-indigo-600 hover:text-indigo-800">&larr; All accounts</NuxtLink>

      <div v-if="loading" class="mt-4 text-sm text-gray-500">Loading…</div>
      <div v-else-if="error" class="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ error }}</div>

      <template v-else-if="detail">
        <div class="mt-3 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{{ detail.account.name }}</h2>
            <p class="text-xs text-gray-400">{{ detail.account.slug }} &middot; customer since {{ dateStr(detail.account.createdAt) }}</p>
          </div>
          <a v-if="stripeCustomerUrl" :href="stripeCustomerUrl" target="_blank" rel="noopener" class="text-xs font-medium text-indigo-600 hover:text-indigo-800">View in Stripe &rarr;</a>
        </div>

        <div class="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <h3 class="text-sm font-semibold text-gray-900">Current standing</h3>
          <dl v-if="detail.subscription" class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-gray-400">Status</dt>
            <dd class="text-gray-900">{{ detail.subscription.status }}<span v-if="detail.subscription.comped" class="ml-1 text-xs text-gray-400">(comped)</span></dd>
            <dt class="text-gray-400">Plan</dt>
            <dd class="text-gray-900">{{ detail.plans.find((p) => p.id === detail!.subscription!.plan_id)?.name ?? detail.subscription.plan_id }} ({{ detail.subscription.billing_interval }})</dd>
            <dt class="text-gray-400">Extra professionals</dt>
            <dd class="text-gray-900">{{ detail.subscription.extra_professionals }}</dd>
            <dt class="text-gray-400">Trial ends</dt>
            <dd class="text-gray-900">{{ dateStr(detail.subscription.trial_ends_at) }}</dd>
            <dt class="text-gray-400">Stripe customer</dt>
            <dd class="text-gray-900">{{ detail.subscription.stripe_customer_id ?? '—' }}</dd>
            <dt class="text-gray-400">Stripe subscription</dt>
            <dd class="text-gray-900">{{ detail.subscription.stripe_subscription_id ?? '—' }}</dd>
            <dt class="text-gray-400">Last synced</dt>
            <dd class="text-gray-900">{{ dateStr(detail.subscription.updated_at) }}</dd>
          </dl>
          <p v-else class="mt-3 text-sm text-gray-400">No subscription row yet.</p>

          <button type="button" class="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-800" @click="openCheckout">Start subscription (Checkout link)</button>
        </div>

        <form class="mt-6 rounded-lg border border-gray-200 bg-white p-4" @submit.prevent="saveOverride">
          <h3 class="text-sm font-semibold text-gray-900">Manual override</h3>
          <p class="mt-1 text-xs text-gray-500">Edits QuiroFlow's own record directly -- doesn't touch the Stripe subscription, if any. Use this to comp an account, extend a trial, or fix a row that's out of sync.</p>

          <div class="mt-4 grid grid-cols-2 gap-3">
            <label class="block text-xs font-medium text-gray-700">
              Plan
              <select v-model="formPlanId" class="mt-1 block w-full rounded-md border-gray-300 text-sm">
                <option v-for="p in detail.plans" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-gray-700">
              Billing interval
              <select v-model="formInterval" class="mt-1 block w-full rounded-md border-gray-300 text-sm">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-gray-700">
              Status
              <select v-model="formStatus" class="mt-1 block w-full rounded-md border-gray-300 text-sm">
                <option value="trialing">Trialing</option>
                <option value="active">Active</option>
                <option value="past_due">Past due</option>
                <option value="locked">Locked</option>
                <option value="canceled">Canceled</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-gray-700">
              Extra professionals
              <input v-model.number="formExtra" type="number" min="0" class="mt-1 block w-full rounded-md border-gray-300 text-sm" />
            </label>
            <label class="block text-xs font-medium text-gray-700">
              Trial ends
              <input v-model="formTrialEndsAt" type="date" class="mt-1 block w-full rounded-md border-gray-300 text-sm" />
            </label>
            <label class="mt-5 flex items-center gap-2 text-xs font-medium text-gray-700">
              <input v-model="formComped" type="checkbox" class="rounded border-gray-300" />
              Comped (no charge)
            </label>
          </div>

          <div v-if="overrideError" class="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{{ overrideError }}</div>
          <div v-if="overrideSaved" class="mt-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-700">Saved.</div>

          <button type="submit" class="mt-4 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50" :disabled="savingOverride">
            {{ savingOverride ? 'Saving…' : 'Save override' }}
          </button>
        </form>
      </template>
    </main>

    <div v-if="checkoutOpen" class="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4" @click.self="checkoutOpen = false">
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-sm font-semibold text-gray-900">Start subscription</h2>
        <p class="mt-1 text-xs text-gray-500">Creates a Stripe Checkout link. Send it to the customer; once they pay, the subscription syncs here automatically.</p>

        <div class="mt-4 space-y-3">
          <label class="block text-xs font-medium text-gray-700">
            Plan
            <select v-model="checkoutPlanId" class="mt-1 block w-full rounded-md border-gray-300 text-sm">
              <option v-for="p in detail?.plans ?? []" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label class="block text-xs font-medium text-gray-700">
            Billing interval
            <select v-model="checkoutInterval" class="mt-1 block w-full rounded-md border-gray-300 text-sm">
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </label>
          <label class="block text-xs font-medium text-gray-700">
            Extra professionals (beyond the plan's included seats)
            <input v-model.number="checkoutExtra" type="number" min="0" class="mt-1 block w-full rounded-md border-gray-300 text-sm" />
          </label>
        </div>

        <div v-if="checkoutError" class="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{{ checkoutError }}</div>

        <div v-if="checkoutUrl" class="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2">
          <p class="break-all text-xs text-gray-700">{{ checkoutUrl }}</p>
          <button type="button" class="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800" @click="copyCheckoutUrl">{{ copied ? 'Copied!' : 'Copy link' }}</button>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100" @click="checkoutOpen = false">Close</button>
          <button
            type="button"
            class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="checkoutLoading || !checkoutPlanId"
            @click="createCheckoutLink"
          >
            {{ checkoutLoading ? 'Creating…' : 'Create link' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
