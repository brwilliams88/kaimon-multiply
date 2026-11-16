-- Ratings: a device can now rate again (after a big update, or any time from the
-- Menu), and every rating stays in public.feedback as history. The summary's
-- ratings.avg, ratings.csat and ratings.dist now count only each device's latest
-- rating, so one family that rates three times doesn't count three times.
-- ratings.count stays the number of rating rows (all of them), the new
-- ratings.raters is the number of devices that rated, and ratings.weekly, new and
-- new_avg still use every row (they show when ratings came in).
-- Only usage_summary_ changes; no tables change.

create or replace function public.usage_summary_(days integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  with p as (select greatest(1, least(coalesce(days, 30), 365)) as n),
  bounds as (select (now() at time zone 'America/Los_Angeles')::date as today, n from p),
  w as (
    select e.*, (e.t at time zone 'America/Los_Angeles')::date as day,
      coalesce(e.lday, (e.t at time zone 'America/Los_Angeles')::date) as ld
    from public.usage_events e, bounds b
    where e.t >= ((b.today - (b.n - 1)) at time zone 'America/Los_Angeles')
  ),
  firsts as (select e.device, min(e.t) as first_t, min(coalesce(e.lday, (e.t at time zone 'America/Los_Angeles')::date)) as first_ld from public.usage_events e group by e.device),
  firsts_w as (select f.*, (f.first_t at time zone 'America/Los_Angeles')::date as day from firsts f, bounds b where (f.first_t at time zone 'America/Los_Angeles')::date > b.today - b.n),
  -- Per-player days use the player's own local day (a session past local midnight
  -- counts on their day). Active-player counts below use Pacific days.
  dd as (select w.device, count(distinct w.ld) as nd from w group by w.device),
  -- New devices in the window that came back on a later (local) day.
  back as (select f.device from firsts_w f where exists (select 1 from w where w.device = f.device and w.ld > f.first_ld)),
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
  -- Daily, weekly and monthly active players for each day (rolling 1, 7 and 30 days).
  ev as (select e.device, (e.t at time zone 'America/Los_Angeles')::date as day from public.usage_events e, bounds b
         where e.t >= ((b.today - (b.n + 29)) at time zone 'America/Los_Angeles')),
  active as (
    select g::date as day,
      (select count(distinct ev.device) from ev where ev.day = g::date) as dau,
      (select count(distinct ev.device) from ev where ev.day between g::date - 6 and g::date) as wau,
      (select count(distinct ev.device) from ev where ev.day between g::date - 29 and g::date) as mau
    from bounds b cross join generate_series(b.today - (b.n - 1), b.today, interval '1 day') g
  ),
  -- Answers per times table, from the rounds (d.t = { "7": 12, ... }).
  tbl as (
    select kv.key::int as tb, sum(public.jnum_(jsonb_build_object('v', kv.value), 'v')) as answers
    from w, jsonb_each(case when jsonb_typeof(w.d -> 't') = 'object' then w.d -> 't' else '{}'::jsonb end) kv
    where w.k = 'round' and kv.key ~ '^([1-9]|10)$'
    group by kv.key
  ),
  top as (
    -- Sources: a ?ref tag or a known site by name; other sites by host.
    select 'refs' as what, case when x.ref = 'other' and x.ref_host is not null then x.ref_host else x.ref end as name, count(distinct x.device) as devices
    from w x where x.ref is not null group by 1, 2
    union all select 'os', coalesce(x.os, 'unknown'), count(distinct x.device) from w x group by 1, 2
    union all select 'browsers', coalesce(x.browser, 'unknown'), count(distinct x.device) from w x group by 1, 2
    union all select 'versions', coalesce(x.v, 'unknown'), count(distinct x.device) from w x group by 1, 2
    union all select 'countries', x.country, count(distinct x.device) from w x where x.country is not null group by 1, 2
    union all select 'timezones', x.tz, count(distinct x.device) from w x where x.tz is not null group by 1, 2
    union all select 'lands', x.land, count(distinct x.device) from w x where x.land is not null group by 1, 2
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
    'active', (select coalesce(jsonb_agg(jsonb_build_object('day', a.day, 'dau', a.dau, 'wau', a.wau, 'mau', a.mau) order by a.day), '[]'::jsonb) from active a),
    -- When kids play, by the player's own local hour.
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', h.lhour, 'minutes', h.minutes, 'opens', h.opens, 'devices', h.devices) order by h.lhour), '[]'::jsonb) from (
      select w.lhour, coalesce(sum(w.n) filter (where w.k = 'minutes'), 0) as minutes, count(*) filter (where w.k = 'open') as opens, count(distinct w.device) as devices
      from w where w.lhour is not null group by w.lhour) h),
    'timezones', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'devices', t.devices) order by t.devices desc, t.name), '[]'::jsonb) from (select * from top where what = 'timezones' order by devices desc, name limit 10) t),
    'lands', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'devices', t.devices) order by t.devices desc, t.name), '[]'::jsonb) from (select * from top where what = 'lands' order by devices desc, name limit 8) t),
    'tables', (select coalesce(jsonb_agg(jsonb_build_object('table', t.tb, 'answers', t.answers) order by t.answers desc, t.tb), '[]'::jsonb) from tbl t),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'stars', c.stars, 'text', left(c.text, 300), 'name', c.name, 'created_at', c.created_at, 'country', c.country, 'city', c.city) order by c.created_at desc), '[]'::jsonb)
      from (select * from public.feedback f where f.text is not null order by f.created_at desc limit 5) c),
    'news', jsonb_build_object('list', (select count(*) from public.updates_list)),
    'ratings', (
      -- r: every rating ever sent (a device that rates again adds a row, so this is
      -- the history). l: only each device's latest rating, so a family that rated
      -- twice counts once in the average, the 4-or-5-star share and the bars.
      with r as (select f.id, f.device, f.stars, f.created_at from public.feedback f where f.kind = 'rating' and f.stars is not null),
      l as (select distinct on (r.device) r.stars from r order by r.device, r.created_at desc, r.id desc)
      select jsonb_build_object(
        'count', (select count(*) from r),
        'raters', (select count(*) from l),
        'avg', (select round(avg(l.stars)::numeric, 2) from l),
        'csat', (select round(100.0 * count(*) filter (where l.stars >= 4) / nullif(count(*), 0), 0) from l),
        'dist', (select jsonb_build_array(
          count(*) filter (where l.stars = 1), count(*) filter (where l.stars = 2), count(*) filter (where l.stars = 3),
          count(*) filter (where l.stars = 4), count(*) filter (where l.stars = 5)) from l),
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
