# Accounts: how sign-in and saved progress work

Accounts are on, in **local mode**: everything lives inside the browser it was created in,
with no server behind the site.

```js
const CLOUD = { url:'local', anonKey:'', required:true, domains:[], managerCode:'title-manager' };
```

- The first thing a new person sees is the **Create your account** pop-up (name, work email,
  password; the Sign in tab is beside it). Then a welcome by name, then step 1.
- Each person's progress and stats are kept under their account **on that computer**. Sign
  out takes it off the screen for the next person; sign back in to see it again. Several
  people can share one training computer.
- Passwords are stored hashed (SHA-256), never as typed. Forgot a password? The pop-up lets
  you set a new one right there (no email is sent, because there is no server).
- **Manager view**: in the account menu. The first time, it asks for `managerCode`; after
  that, that account can open it any time on that computer. It lists everyone who has
  studied on that computer, with steps done, cards known, best mock exam, answers, accuracy
  and last active.
- The limit: an account does not follow a person to another computer or phone. Signing in
  elsewhere says so and suggests using the computer where they signed up.
- `domains`: work-email domains allowed to sign up (empty allows any address). `required`:
  set to false to add "Continue without an account". `url:''` turns accounts off.

To make progress follow people everywhere (and give managers one view of the whole team),
switch to a free Supabase project. The site is already written for it; the setup below takes
about five minutes, then `CLOUD` gets the project URL and anon key instead of `'local'`.

## One-time setup (about 5 minutes)

1. **Create the project.** supabase.com → New project. Pick any name and region, choose a
   database password (keep it somewhere safe; the site never needs it).
2. **Run the schema.** Dashboard → SQL Editor → New query → paste all of
   `supabase/schema.sql` → Run. Before running, replace the two example rows at the bottom
   (`example.com` → the company email domain; `manager@example.com` → each manager's
   address, role `admin`).
3. **Turn off email confirmation.** Authentication → Sign In / Providers → Email →
   turn **Confirm email** off → Save. (Sign-ups are already limited to company addresses,
   and the free email service only sends a couple of messages an hour, which would hold up a
   group of new hires.)
4. **Set the site address.** Authentication → URL Configuration → Site URL = the site's
   address (for example `https://mcflymagic.github.io/co-title-exam/`, or the custom domain
   once it exists). Add the same address under Redirect URLs. Password-reset links come back
   to this address.
5. **Copy the keys.** Project Settings → API → copy the **Project URL** and the **anon
   public** key into `CLOUD` in `index.html`. The anon key is meant to be public; row-level
   security in the database is what protects people's data.

Optional but recommended: Authentication → Sign In / Providers → Email → minimum password
length **8** (the site already asks for 8).

## Day to day

- **New hires** create an account with their work email on first visit (or any time from
  the Sign in button). Progress saves automatically a second or two after every change.
- **Who can sign up** is the `allowed_signups` table: a row per company domain, plus a row
  per individual address. Add a row with role `admin` for each manager.
- **Make someone a manager later:**
  `update public.profiles set role = 'admin' where email = 'name@example.com';`
- **Forgot password:** the Sign in pop-up has a reset link. The email comes from Supabase's
  built-in mail service, which allows only a few messages per hour. If that ever becomes a
  problem, add a custom SMTP sender (Authentication → SMTP Settings; Resend or Postmark free
  tiers work).
- **Sign out clears the device**, so the next person on a shared computer starts fresh.
  Signing in again restores everything from the account.
- **Signing in on a device that already has guest progress** asks whether to keep that
  progress (add it to the account) or start from the account only.

## Free-tier notes

- Supabase pauses a free project after about a week with no traffic. Normal use keeps it
  awake, and the repository has a scheduled GitHub Action (`.github/workflows/keepalive.yml`)
  that pings the project daily as a backstop. (GitHub switches scheduled actions off after 60
  days without a commit; the repository's Actions tab shows a one-click button to turn it
  back on.) If the project is ever paused anyway, open the Supabase dashboard and click
  **Restore**; nothing is lost.
- Free projects allow 50,000 monthly active users and 500 MB of database, far more than a
  study site needs.

## What is stored

- `profiles`: id, email, display name, role, created date.
- `progress`: one row per person — the site's saved state (`data`: cards reviewed, quiz
  bests, misses, exam history, settings) and a summary (`stats`: steps done, cards known,
  best mock exam, questions answered, accuracy, days studied) for the Manager view.

Row-level security: a person can read and write only their own rows; managers can read
everyone's. Nobody can change their own role or email from the site.
