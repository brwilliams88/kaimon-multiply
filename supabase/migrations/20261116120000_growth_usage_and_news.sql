-- v0.6 growth: anonymous usage analytics, ratings and feedback, the news list
-- for the Apps Script mailer, and an admin-only usage dashboard.
--
-- Nothing secret is in this file. After applying it, run these two lines by
-- hand in the Supabase SQL editor (not saved in the repo):
--
--   insert into public.admins (email) values ('<your sign-in email>');
--   select public.rotate_secret('news');   -- copy the result into the Apps
--                                          -- Script Property NEWS_KEY
--
-- Privacy (see CLAUDE.md): usage rows hold a random device id made only for
-- analytics (not the sync device id), trainer names, device and browser type,
-- the app version, a share-link tag, play counts and a rough place (city,
-- region, country) that the device looks up once a day. No emails, real names,
-- photos or IP addresses are stored.

-- ------------------------------------------------------------------ secrets

-- Keys the Apps Script proves it knows. Only a SHA-256 hash is kept here.
create table if not exists public.app_secrets (
  name text primary key,
  hash text not null,
  rotated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from public, anon, authenticated;

-- Makes a new random key, keeps its hash, and returns the key once.
-- Only the database owner can run it (from the SQL editor).
create or replace function public.rotate_secret(secret_name text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare k text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.app_secrets (name, hash, rotated_at)
  values (secret_name, encode(sha256(convert_to(k, 'UTF8')), 'hex'), now())
  on conflict (name) do update set hash = excluded.hash, rotated_at = now();
  return k;
end $$;
revoke all on function public.rotate_secret(text) from public, anon, authenticated;

create or replace function public.secret_ok_(secret_name text, key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(length(key) >= 32 and exists (
    select 1 from public.app_secrets s
    where s.name = secret_name and s.hash = encode(sha256(convert_to(key, 'UTF8')), 'hex')
  ), false)
$$;
revoke all on function public.secret_ok_(text, text) from public, anon, authenticated;

-- ------------------------------------------------------------------ news list

-- Everyone on the news list, for the Apps Script "What's new" email.
-- Returns nothing unless key matches the 'news' secret.
create or replace function public.news_recipients(key text)
returns table (email text, token uuid, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.secret_ok_('news', key) then return; end if;
  return query select u.email, u.token, u.joined_at from public.updates_list u order by u.joined_at, u.token;
end $$;
revoke all on function public.news_recipients(text) from public, anon, authenticated;
grant execute on function public.news_recipients(text) to anon;

-- ------------------------------------------------------------------ usage

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  device text not null check (device ~ '^a[0-9a-z]{10,30}$'),
  k text not null check (k in ('open', 'round', 'battle', 'catch', 'minutes')),
  t timestamptz not null default now(),
  received_at timestamptz not null default now(),
  trainer text check (trainer is null or char_length(trainer) between 1 and 24),
  n integer not null default 1 check (n between 0 and 10000),
  d jsonb not null default '{}'::jsonb check (jsonb_typeof(d) = 'object' and pg_column_size(d) <= 400),
  ref text check (ref is null or ref ~ '^[a-z0-9_-]{1,24}$'),
  v text check (v is null or v ~ '^[0-9.]{1,12}$'),
  os text check (os is null or os in ('iphone', 'ipad', 'android', 'chromebook', 'mac', 'windows', 'linux', 'computer')),
  browser text check (browser is null or browser in ('safari', 'chrome', 'edge', 'firefox', 'samsung', 'other')),
  installed boolean not null default false,
  city text check (city is null or char_length(city) between 1 and 60),
  region text check (region is null or char_length(region) between 1 and 60),
  country text check (country is null or country ~ '^[A-Z]{2}$')
);
create index if not exists usage_events_t on public.usage_events (t);
create index if not exists usage_events_device on public.usage_events (device, received_at);

alter table public.usage_events enable row level security;
revoke all on public.usage_events from public, anon, authenticated;
grant insert on public.usage_events to anon, authenticated;
drop policy if exists "anyone can add usage" on public.usage_events;
create policy "anyone can add usage" on public.usage_events for insert to anon, authenticated with check (true);
-- No select, update or delete policies: rows can only be read through the
-- summary functions below.

-- Keeps times sane and quietly drops floods from one device (over 2000 rows a day).
create or replace function public.usage_guard_()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.received_at := now();
  if new.t is null or new.t > now() + interval '1 day' or new.t < now() - interval '60 days' then new.t := now(); end if;
  if (select count(*) from public.usage_events e where e.device = new.device and e.received_at > now() - interval '1 day') >= 2000 then
    return null;
  end if;
  return new;
end $$;
revoke all on function public.usage_guard_() from public, anon, authenticated;
drop trigger if exists usage_guard on public.usage_events;
create trigger usage_guard before insert on public.usage_events for each row execute function public.usage_guard_();

-- A whole number from a jsonb field, or 0 for anything odd.
create or replace function public.jnum_(d jsonb, key text)
returns integer language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(d -> key) = 'number' then greatest(0, least((d ->> key)::numeric, 10000))::integer else 0 end
$$;

-- ------------------------------------------------------------------ ratings and feedback

-- Star ratings and notes from the game's Rate and Feedback sheets. Anyone can
-- add one; only the admin functions below can read them.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('rating', 'love', 'idea', 'bug')),
  stars smallint check (stars is null or stars between 1 and 5),
  text text check (text is null or char_length(text) <= 2000),
  name text check (name is null or char_length(name) between 1 and 40),
  reply_email text check (reply_email is null or (char_length(reply_email) <= 254 and reply_email ~* '^[^[:space:]@,;:<>()"\\]+@[^[:space:]@,;:<>()"\\]+\.[a-z]{2,}$')),
  version text check (version is null or version ~ '^[0-9.]{1,12}$'),
  device text not null check (device ~ '^[A-Za-z0-9_-]{4,40}$'),
  place text check (place is null or place ~ '^[a-z0-9_-]{1,20}$'),
  created_at timestamptz not null default now(),
  constraint feedback_rating_has_stars check (kind <> 'rating' or stars is not null),
  constraint feedback_note_has_text check (kind = 'rating' or char_length(btrim(coalesce(text, ''))) > 0)
);
create index if not exists feedback_created on public.feedback (created_at);
create index if not exists feedback_device on public.feedback (device, created_at);

alter table public.feedback enable row level security;
revoke all on public.feedback from public, anon, authenticated;
grant insert on public.feedback to anon, authenticated;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated with check (true);

-- Simple rate limit: 10 a day per device and 300 a day in all. Extra rows are
-- quietly dropped, so a stuck device can't flood the table.
create or replace function public.feedback_guard_()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  new.text := nullif(btrim(new.text), '');
  new.name := nullif(btrim(new.name), '');
  new.reply_email := nullif(lower(btrim(new.reply_email)), '');
  if (select count(*) from public.feedback f where f.device = new.device and f.created_at > now() - interval '1 day') >= 10
     or (select count(*) from public.feedback f where f.created_at > now() - interval '1 day') >= 300 then
    return null;
  end if;
  return new;
end $$;
revoke all on function public.feedback_guard_() from public, anon, authenticated;
drop trigger if exists feedback_guard on public.feedback;
create trigger feedback_guard before insert on public.feedback for each row execute function public.feedback_guard_();

-- ------------------------------------------------------------------ admin summary

create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from public, anon, authenticated;

-- Aggregates only. Days are counted in California time.
create or replace function public.usage_summary_(days integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  with p as (select greatest(1, least(coalesce(days, 30), 365)) as n),
  bounds as (select (now() at time zone 'America/Los_Angeles')::date as today, n from p),
  w as (
    select e.*, (e.t at time zone 'America/Los_Angeles')::date as day
    from public.usage_events e, bounds b
    where e.t >= ((b.today - (b.n - 1)) at time zone 'America/Los_Angeles')
  ),
  firsts as (select e.device, min(e.t) as first_t from public.usage_events e group by e.device),
  firsts_w as (select f.*, (f.first_t at time zone 'America/Los_Angeles')::date as day from firsts f, bounds b where (f.first_t at time zone 'America/Los_Angeles')::date > b.today - b.n),
  dd as (select w.device, count(distinct w.day) as nd from w group by w.device),
  -- New devices in the window that came back on a later day.
  back as (select f.device from firsts_w f where exists (select 1 from w where w.device = f.device and w.day > f.day)),
  daily as (
    select g::date as day,
      count(distinct w.device) as players,
      count(*) filter (where w.k = 'open') as opens,
      coalesce(sum(w.n) filter (where w.k = 'minutes'), 0) as minutes,
      coalesce(sum(w.n) filter (where w.k = 'round'), 0) as rounds,
      coalesce(sum(public.jnum_(w.d, 'cards')) filter (where w.k = 'round'), 0) as cards,
      (select count(*) from firsts_w f where f.day = g::date) as new_devices
    from bounds b
    cross join generate_series(b.today - (b.n - 1), b.today, interval '1 day') g
    left join w on w.day = g::date
    group by g order by g
  ),
  top as (
    select 'refs' as what, x.ref as name, count(distinct x.device) as devices from w x where x.ref is not null group by x.ref
    union all select 'os', coalesce(x.os, 'unknown'), count(distinct x.device) from w x group by 1, 2
    union all select 'browsers', coalesce(x.browser, 'unknown'), count(distinct x.device) from w x group by 1, 2
    union all select 'versions', coalesce(x.v, 'unknown'), count(distinct x.device) from w x group by 1, 2
    union all select 'countries', x.country, count(distinct x.device) from w x where x.country is not null group by 1, 2
  ),
  -- Devices seen in each place (a device that travels counts in each place).
  places as (
    select x.city, x.region, x.country, count(distinct x.device) as devices
    from w x where x.country is not null
    group by x.city, x.region, x.country
  )
  select jsonb_build_object(
    'days', (select n from p),
    'generated_at', now(),
    'totals', jsonb_build_object(
      'devices_all', (select count(*) from firsts),
      'installed_all', (select count(distinct e.device) from public.usage_events e where e.installed),
      'devices', (select count(*) from dd),
      'installed', (select count(distinct w.device) from w where w.installed),
      'new_devices', (select count(*) from firsts_w),
      'came_back', (select count(*) from back),
      'returning', (select count(*) from dd where dd.nd >= 2),
      'trainers', (select count(distinct (w.device, w.trainer)) from w where w.trainer is not null),
      'opens', (select count(*) from w where w.k = 'open'),
      'rounds', (select coalesce(sum(w.n), 0) from w where w.k = 'round'),
      'cards', (select coalesce(sum(public.jnum_(w.d, 'cards')), 0) from w where w.k = 'round'),
      'right', (select coalesce(sum(public.jnum_(w.d, 'right')), 0) from w where w.k = 'round'),
      'battles', (select coalesce(sum(w.n), 0) from w where w.k = 'battle'),
      'wins', (select coalesce(sum(public.jnum_(w.d, 'wins')), 0) from w where w.k = 'battle'),
      'catches', (select coalesce(sum(w.n), 0) from w where w.k = 'catch'),
      'minutes', (select coalesce(sum(w.n), 0) from w where w.k = 'minutes'),
      'active_days', (select coalesce(sum(dd.nd), 0) from dd)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'players', d.players, 'opens', d.opens, 'minutes', d.minutes, 'rounds', d.rounds, 'cards', d.cards, 'new_devices', d.new_devices) order by d.day), '[]'::jsonb) from daily d),
    'refs', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'devices', t.devices) order by t.devices desc, t.name), '[]'::jsonb) from (select * from top where what = 'refs' order by devices desc, name limit 10) t),
    'os', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'devices', t.devices) order by t.devices desc, t.name), '[]'::jsonb) from (select * from top where what = 'os' order by devices desc, name limit 10) t),
    'browsers', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'devices', t.devices) order by t.devices desc, t.name), '[]'::jsonb) from (select * from top where what = 'browsers' order by devices desc, name limit 10) t),
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'devices', t.devices) order by t.devices desc, t.name), '[]'::jsonb) from (select * from top where what = 'versions' order by devices desc, name limit 8) t),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'devices', t.devices) order by t.devices desc, t.name), '[]'::jsonb) from (select * from top where what = 'countries' order by devices desc, name limit 12) t),
    'places', (select coalesce(jsonb_agg(jsonb_build_object('city', pl.city, 'region', pl.region, 'country', pl.country, 'devices', pl.devices) order by pl.devices desc, pl.country, pl.region, pl.city), '[]'::jsonb)
      from (select * from places order by devices desc, country, region nulls last, city nulls last limit 15) pl),
    'news', jsonb_build_object('list', (select count(*) from public.updates_list)),
    'ratings', (
      with r as (select f.stars, f.created_at from public.feedback f where f.kind = 'rating' and f.stars is not null)
      select jsonb_build_object(
        'count', (select count(*) from r),
        'avg', (select round(avg(r.stars)::numeric, 2) from r),
        'csat', (select round(100.0 * count(*) filter (where r.stars >= 4) / nullif(count(*), 0), 0) from r),
        'dist', (select jsonb_build_array(
          count(*) filter (where r.stars = 1), count(*) filter (where r.stars = 2), count(*) filter (where r.stars = 3),
          count(*) filter (where r.stars = 4), count(*) filter (where r.stars = 5)) from r),
        'new', (select count(*) from r, bounds b where (r.created_at at time zone 'America/Los_Angeles')::date > b.today - b.n),
        'new_avg', (select round(avg(r.stars)::numeric, 2) from r, bounds b where (r.created_at at time zone 'America/Los_Angeles')::date > b.today - b.n),
        'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', x.week, 'count', x.c, 'avg', x.a) order by x.week), '[]'::jsonb) from (
          select date_trunc('week', r.created_at at time zone 'America/Los_Angeles')::date as week, count(*) as c, round(avg(r.stars)::numeric, 2) as a
          from r where r.created_at > now() - interval '12 weeks' group by 1) x)
      )
    ),
    'feedback', jsonb_build_object(
      'new_comments', (select count(*) from public.feedback f, bounds b where f.text is not null and (f.created_at at time zone 'America/Los_Angeles')::date > b.today - b.n),
      'total', (select count(*) from public.feedback f)
    )
  )
$$;
revoke all on function public.usage_summary_(integer) from public, anon, authenticated;

-- For admin.html: only signed-in admins get numbers.
create or replace function public.usage_summary(days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare e text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if (select auth.uid()) is null or e = '' or not exists (select 1 from public.admins a where a.email = e) then
    raise exception 'not-admin' using errcode = '42501';
  end if;
  return public.usage_summary_(days);
end $$;
revoke all on function public.usage_summary(integer) from public, anon, authenticated;
grant execute on function public.usage_summary(integer) to authenticated;

-- Is this signed-in person an admin? (admin.html uses it to pick the right message.)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (select 1 from public.admins a where a.email = lower(coalesce((select auth.jwt()) ->> 'email', '')))
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- For the weekly summary email from the Apps Script (key = the 'news' secret).
create or replace function public.usage_summary_key(key text, days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.secret_ok_('news', key) then return null; end if;
  return public.usage_summary_(days);
end $$;
revoke all on function public.usage_summary_key(text, integer) from public, anon, authenticated;
grant execute on function public.usage_summary_key(text, integer) to anon;

-- For admin.html: ratings and notes, newest first. kind: null for all.
create or replace function public.feedback_list(kind_filter text default null, max_rows integer default 200)
returns table (id bigint, kind text, stars smallint, text text, name text, reply_email text, version text, place text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not-admin' using errcode = '42501'; end if;
  return query select f.id, f.kind, f.stars, f.text, f.name, f.reply_email, f.version, f.place, f.created_at
    from public.feedback f
    where kind_filter is null or f.kind = kind_filter
    order by f.created_at desc, f.id desc
    limit greatest(1, least(coalesce(max_rows, 200), 1000));
end $$;
revoke all on function public.feedback_list(text, integer) from public, anon, authenticated;
grant execute on function public.feedback_list(text, integer) to authenticated;
