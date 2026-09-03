# QuiroFlow Admin

Internal control panel — customer count, plan mix, and billing status across
every clinic account on QuiroFlow. Not part of the main app; reads the same
Supabase project's data but lives at its own domain with its own login,
restricted to a hardcoded email allowlist.

## How access control works

Signing in only proves you have *a* valid Supabase Auth user for the shared
project — it does not by itself grant access to this panel. Every API route
separately checks the signed-in user's email against `ADMIN_ALLOWED_EMAILS`
(server-side only, never sent to the browser) before using the service-role
key to read any data. See `server/utils/adminAuth.ts`.

There's no sign-up page on purpose. To grant someone access:

1. Create their Supabase Auth user directly in the Supabase dashboard
   (Authentication → Users → Add user) on the **quiroflow** project — this
   panel doesn't have its own database, it reads that one.
2. Add their email to `ADMIN_ALLOWED_EMAILS` (comma-separated) and redeploy.

## 1. Install

```bash
npm install
```

## 2. Environment

```bash
cp .env.example .env
```

- `NUXT_PUBLIC_SUPABASE_URL` / `NUXT_PUBLIC_SUPABASE_KEY` — same values as the
  main `quiroflow` repo's `.env` (Project Settings → API).
- `NUXT_SUPABASE_SECRET_KEY` — the `service_role` secret (same project).
- `NUXT_ADMIN_ALLOWED_EMAILS` — your own login email(s), comma-separated.

## 3. Run it

```bash
npm run dev
```

Visit http://localhost:3000 and sign in with a user you created in step 1
above.

## 4. Deploying

Deployed separately from the main app, on its own Netlify site pointed at
`admin.quiroflow.com`:

1. Netlify → Add new site → import this repo.
2. Build command `npm run build`, publish directory left to the Nuxt Netlify
   preset's default (same as the main repo's `netlify.toml` approach).
3. Site configuration → Environment variables: the four vars from
   `.env.example` above.
4. Site configuration → Domain management → add `admin.quiroflow.com` as a
   custom domain, and point its DNS (CNAME) at this site's
   `<name>.netlify.app` default domain.

## What this reads (and doesn't write)

`plans` and `subscriptions` live in the main `quiroflow` repo's migrations
(`supabase/migrations/0132_billing_plans_and_subscriptions.sql`) — this repo
has no migrations of its own. Today this panel is **read-only**: it shows the
current state, it doesn't yet create/edit subscriptions or talk to Stripe.
That's a deliberate next step, not an oversight.
