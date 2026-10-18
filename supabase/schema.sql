-- Colorado Title Insurance Exam Prep — account tables.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- It is safe to run again: every statement is "create if not exists" or "create or replace".

-- ---------------------------------------------------------------------
-- Who may create an account.
-- A row is either a whole email domain ('example.com') or one exact
-- address ('someone@gmail.com'). `role` is what the new account becomes:
-- 'learner' (normal) or 'admin' (sees the Manager view).
-- ---------------------------------------------------------------------
create table if not exists public.allowed_signups (
  pattern    text primary key,                 -- lowercase domain or full address
  role       text not null default 'learner' check (role in ('learner','admin')),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.allowed_signups enable row level security;
revoke all on public.allowed_signups from anon, authenticated;
-- (no policies on purpose: only the SQL editor / service role can read or change this list)

-- ---------------------------------------------------------------------
-- One profile per account (created automatically on sign-up).
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'learner' check (role in ('learner','admin')),
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------
-- Study progress: the site's full saved state (`data`) plus a small
-- summary (`stats`) that the Manager view reads.
-- ---------------------------------------------------------------------
create table if not exists public.progress (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  stats      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
-- The role an email address would get, or null when it may not sign up.
-- An exact address wins over its domain.
create or replace function public.signup_role(p_email text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.allowed_signups where pattern = lower(trim(p_email))),
    (select role from public.allowed_signups where pattern = split_part(lower(trim(p_email)), '@', 2))
  );
$$;
revoke execute on function public.signup_role(text) from public, anon, authenticated;

-- Called by the site before it tries to create an account, so people get
-- a clear message instead of a generic error.
create or replace function public.signup_allowed(email text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.signup_role(email) is not null;
$$;
grant execute on function public.signup_allowed(text) to anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Triggers on auth.users
-- ---------------------------------------------------------------------
-- Hard stop for anyone outside the allowed list (the site checks first,
-- this makes sure nothing slips past it).
create or replace function public.check_signup_allowed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.signup_role(new.email) is null then
    raise exception 'signup_not_allowed: only company email addresses can create an account';
  end if;
  return new;
end $$;
drop trigger if exists before_auth_user_created on auth.users;
create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.check_signup_allowed();

-- Create the profile row for every new account.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    lower(new.email),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), 60), ''),
    coalesce(public.signup_role(new.email), 'learner')
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Guards on the tables
-- ---------------------------------------------------------------------
-- People may change their own name, never their own role or email.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only a manager can change roles';
  end if;
  new.email := old.email;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile();

-- Server-side timestamp so "last active" cannot be faked by a client.
create or replace function public.touch_progress() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists touch_progress on public.progress;
create trigger touch_progress
  before insert or update on public.progress
  for each row execute function public.touch_progress();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "progress: read own or admin" on public.progress;
create policy "progress: read own or admin" on public.progress
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "progress: insert own" on public.progress;
create policy "progress: insert own" on public.progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "progress: update own" on public.progress;
create policy "progress: update own" on public.progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Who may sign up.  [FILL IN] — replace the two example rows.
-- Add one row per company domain, and one per individual address.
-- Managers get role 'admin'. Running this again just updates the rows.
-- ---------------------------------------------------------------------
insert into public.allowed_signups (pattern, role, note) values
  ('example.com',        'learner', 'company email domain'),
  ('manager@example.com','admin',   'sees the Manager view')
on conflict (pattern) do update set role = excluded.role, note = excluded.note;

-- To make someone who already has an account a manager:
--   update public.profiles set role = 'admin' where email = 'name@example.com';
