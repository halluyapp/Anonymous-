-- After Dark: private, text-only foundation. Public submissions enter through an Edge Function.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$' and username not in ('auth','inbox','admin','api','settings','login','signup','about','support','privacy','terms')),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 160),
  link_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  reply text check (char_length(reply) <= 5000),
  request_id uuid not null unique
);
create index messages_recipient_created_idx on public.messages(recipient_id, created_at desc, id desc);
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
revoke all on public.profiles, public.messages from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, delete on public.messages to authenticated;
grant update (is_read, is_pinned, is_archived, reply) on public.messages to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy messages_select_own on public.messages for select to authenticated using ((select auth.uid()) = recipient_id);
create policy messages_update_own on public.messages for update to authenticated using ((select auth.uid()) = recipient_id) with check ((select auth.uid()) = recipient_id);
create policy messages_delete_own on public.messages for delete to authenticated using ((select auth.uid()) = recipient_id);

-- Only this deliberately narrow public lookup can read another profile.
create function public.public_profile(p_username text) returns table(username text, display_name text, bio text)
language sql stable security definer set search_path = '' as $$
  select p.username, p.display_name, p.bio from public.profiles p
  where p.username = lower(p_username) and p.link_enabled = true limit 1;
$$;
revoke all on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.submission_windows (
  bucket text primary key,
  count integer not null,
  window_start timestamptz not null default now()
);
-- Transactional rate limiting and insert. Only the Edge Function's service role can call it.
create function public.deliver_message(p_username text, p_body text, p_request_id uuid, p_sender_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare target uuid; bucket text; attempts integer; existing uuid;
begin
  if p_username !~ '^[a-z0-9_]{3,24}$' or char_length(trim(p_body)) = 0 or char_length(p_body) > 5000 or p_sender_hash !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;
  select id into target from public.profiles where username = p_username and link_enabled = true;
  if target is null then return 'not_found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_sender_hash, 0));
  select recipient_id into existing from public.messages where request_id = p_request_id;
  if existing is not null then
    if existing = target then return 'ok'; else return 'invalid'; end if;
  end if;
  bucket := p_sender_hash || ':' || target::text;
  insert into private.submission_windows as w (bucket, count, window_start) values (bucket, 1, now())
  on conflict (bucket) do update set count = case when w.window_start < now() - interval '1 hour' then 1 else w.count + 1 end,
    window_start = case when w.window_start < now() - interval '1 hour' then now() else w.window_start end
  returning count into attempts;
  if attempts > 8 then return 'rate_limited'; end if;
  insert into public.messages (recipient_id, body, request_id) values (target, p_body, p_request_id);
  delete from private.submission_windows where window_start < now() - interval '24 hours';
  return 'ok';
end;
$$;
revoke all on function public.deliver_message(text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.deliver_message(text,text,uuid,text) to service_role;
