-- One dated session of one program. See docs/plans/session-schedule-from-supabase.md.
--
-- Apply by hand in the Supabase SQL editor, then run `npm run check:db`, which
-- asserts every property this file is supposed to establish.

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  program       text        not null check (program in ('art', 'coop')),
  title         text        not null,
  summary       text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  location_name text,
  location_url  text,
  price_cents   integer     check (price_cents is null or price_cents >= 0),
  published     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ends_after_start check (ends_at > starts_at)
);

-- Matches the only query the site makes: one program's upcoming sessions,
-- oldest first.
create index sessions_program_starts_at on public.sessions (program, starts_at);

-- A column default fires on insert only, so without this trigger `updated_at`
-- reports a creation time under a name that promises a modification time. The
-- source build plan this schema descends from has that bug in all four of its
-- tables. Plain plpgsql rather than the moddatetime extension: nothing to get
-- wrong about which schema the extension landed in.
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;

-- The only policy. Reads are public but only for published rows; there is
-- deliberately no insert, update or delete policy, so every write must come
-- from the service role. That is what makes `published` a working kill switch:
-- unpublish a row and it leaves the site with no deploy.
create policy "public reads published sessions"
  on public.sessions for select
  using (published = true);

grant select on public.sessions to anon, authenticated;
