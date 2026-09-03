<script setup lang="ts">
// No sign-up flow on purpose -- this panel is for a fixed, small allowlist
// of people (see server/utils/adminAuth.ts). Create the Supabase Auth user
// directly in the Supabase dashboard (Authentication -> Users -> Add user),
// then add their email to ADMIN_ALLOWED_EMAILS.
const supabase = useSupabaseClient()
const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)

// ?error=unauthorized|signed-out arrives from pages/index.vue's load()
// bouncing a signed-in-but-not-allowlisted (or session-expired) user back
// here. A fresh sign-in attempt below overwrites this the moment the user
// tries again, same as any other login error.
const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "You're signed in, but this account isn't authorized for the admin panel.",
  'signed-out': 'Your session expired. Please sign in again.',
}
const error = ref(typeof route.query.error === 'string' ? (ERROR_MESSAGES[route.query.error] ?? '') : '')

async function signIn() {
  error.value = ''
  loading.value = true
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  loading.value = false
  if (signInError) {
    error.value = signInError.message
    return
  }
  navigateTo('/')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <form class="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" @submit.prevent="signIn">
      <h1 class="text-lg font-semibold text-gray-900">QuiroFlow Admin</h1>
      <div>
        <label class="block text-sm font-medium text-gray-600">Email</label>
        <input v-model="email" type="email" required autocomplete="username" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-600">Password</label>
        <input v-model="password" type="password" required autocomplete="current-password" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button type="submit" :disabled="loading" class="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>
