# Working on quiroflow-admin

Internal, owner-only control panel for QuiroFlow — see README.md for what it
does and how access control works.

## Security model — read this before touching auth or data access

This panel and the main `quiroflow` app share one Supabase project. Signing
in here only proves a valid Supabase Auth session for that project exists —
it does **not** prove the signed-in person is allowed to see billing data
across every clinic. That's `server/utils/adminAuth.ts`'s job: every API
route must call `requireAdmin(event)` and get its Supabase client *from that
call's return value*, never construct its own service-role client directly.
`requireAdmin` checks the caller's email against `ADMIN_ALLOWED_EMAILS`
before handing back a service-role client — skip that check and every row in
every clinic's `subscriptions`/`accounts` data is one unauthenticated-feeling
request away from anyone who can log in with any Supabase user on the shared
project.

## Git workflow

Once this is deployed with continuous deployment (see README §4), treat it
the same as the main `quiroflow` repo: never push straight to `main`, always
branch + PR + let CI (once one exists) go green before merging. The very
first scaffold commit went straight to `main` because there was no deploy
pipeline yet to protect — that exception doesn't apply again once one exists.

## Schema

This repo has no migrations of its own — `plans` and `subscriptions` are
defined in the main `quiroflow` repo
(`supabase/migrations/0132_billing_plans_and_subscriptions.sql`). Schema
changes for either table belong there, not here.
