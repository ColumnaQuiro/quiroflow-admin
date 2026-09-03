export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: false },
  app: {
    head: {
      title: 'QuiroFlow Admin',
      // A private, owner-only billing panel has even less reason to be
      // indexed than the main app itself (same tag there, see its own
      // nuxt.config.ts) -- this isn't the actual access control (that's
      // auth + the allowlist), just keeps it out of search results.
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate icon', href: '/favicon.ico' },
      ],
    },
  },
  nitro: {
    preset: 'netlify',
  },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  supabase: {
    // Everything in this app IS the protected admin panel -- only /login
    // itself is excluded from the module's own "redirect to login if signed
    // out" middleware. Being signed in only proves *a* Supabase user session
    // exists though -- it does NOT prove that user is an authorized admin.
    // That check happens server-side in every API route (see
    // server/utils/adminAuth.ts) against ADMIN_ALLOWED_EMAILS, which never
    // reaches the client. A signed-in-but-unauthorized user just sees every
    // dashboard fetch fail with 403.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login'],
    },
  },
  runtimeConfig: {
    // Server-only -- comma-separated emails allowed to use this panel.
    // Never exposed to the client (no `public.` prefix).
    adminAllowedEmails: '',
  },
})
