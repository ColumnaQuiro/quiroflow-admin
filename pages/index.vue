<script setup lang="ts">
interface OverviewAccount {
  id: string
  name: string
  slug: string
  createdAt: string
  planId: string | null
  planName: string | null
  status: string | null
  billingInterval: string | null
  trialEndsAt: string | null
  comped: boolean
  extraProfessionals: number
  monthlyCents: number | null
}
interface Overview {
  totalAccounts: number
  withSubscription: number
  byPlan: Record<string, number>
  mrrCents: number
  plans: { id: string; name: string }[]
  accounts: OverviewAccount[]
}

const supabase = useSupabaseClient()
const overview = ref<Overview | null>(null)
const error = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  error.value = ''
  try {
    overview.value = await $fetch<Overview>('/api/overview')
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode
    // A signed-in-but-not-allowlisted user has no reason to sit on a
    // half-loaded dashboard staring at an inline error -- bounce them back
    // to the login screen (signed out, so a stale session doesn't just
    // 403 again on every reload) with the reason attached.
    if (status === 401 || status === 403) {
      await supabase.auth.signOut()
      await navigateTo(`/login?error=${status === 401 ? 'signed-out' : 'unauthorized'}`)
      return
    }
    error.value = err?.data?.statusMessage ?? err?.message ?? 'Failed to load.'
  }
  loading.value = false
}
onMounted(load)

function eur(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })
}
function dateStr(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : '—'
}

const STATUS_TONE: Record<string, string> = {
  trialing: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  locked: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-500',
}

async function signOut() {
  await supabase.auth.signOut()
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 class="text-base font-semibold text-gray-900">QuiroFlow Admin</h1>
      <button type="button" class="text-sm text-gray-500 hover:text-gray-700" @click="signOut">Sign out</button>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-8">
      <div v-if="loading" class="text-sm text-gray-500">Loading…</div>

      <div v-else-if="error" class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ error }}
      </div>

      <template v-else-if="overview">
        <div class="grid grid-cols-3 gap-4">
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-400">Customers</p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.totalAccounts }}</p>
            <p class="mt-1 text-xs text-gray-400">{{ overview.withSubscription }} with a plan assigned</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-400">MRR</p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">{{ eur(overview.mrrCents) }}</p>
            <p class="mt-1 text-xs text-gray-400">Active, non-comped subscriptions only</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-400">By plan</p>
            <p class="mt-1 space-y-0.5 text-sm text-gray-700">
              <span v-for="plan in overview.plans" :key="plan.id" class="block">
                {{ plan.name }}: <span class="font-medium">{{ overview.byPlan[plan.id] ?? 0 }}</span>
              </span>
            </p>
          </div>
        </div>

        <div class="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th class="px-4 py-2 font-medium">Account</th>
                <th class="px-4 py-2 font-medium">Plan</th>
                <th class="px-4 py-2 font-medium">Status</th>
                <th class="px-4 py-2 font-medium">Billing</th>
                <th class="px-4 py-2 font-medium">Trial ends</th>
                <th class="px-4 py-2 font-medium">Since</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="a in overview.accounts" :key="a.id">
                <td class="px-4 py-2.5">
                  <p class="font-medium text-gray-900">{{ a.name }}</p>
                  <p class="text-xs text-gray-400">{{ a.slug }}</p>
                </td>
                <td class="px-4 py-2.5 text-gray-700">
                  {{ a.planName ?? '—' }}
                  <span v-if="a.comped" class="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">comped</span>
                  <span v-if="a.extraProfessionals > 0" class="ml-1 text-xs text-gray-400">+{{ a.extraProfessionals }} seat(s)</span>
                </td>
                <td class="px-4 py-2.5">
                  <span v-if="a.status" class="rounded-full px-2 py-0.5 text-xs font-medium" :class="STATUS_TONE[a.status] ?? 'bg-gray-100 text-gray-500'">{{ a.status }}</span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="px-4 py-2.5 text-gray-700">{{ a.billingInterval ?? '—' }}</td>
                <td class="px-4 py-2.5 text-gray-700">{{ dateStr(a.trialEndsAt) }}</td>
                <td class="px-4 py-2.5 text-gray-700">{{ dateStr(a.createdAt) }}</td>
              </tr>
              <tr v-if="overview.accounts.length === 0">
                <td colspan="6" class="px-4 py-6 text-center text-gray-400">No accounts yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </main>
  </div>
</template>
