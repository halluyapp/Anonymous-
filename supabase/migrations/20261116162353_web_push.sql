-- Private durable outbox, subscription endpoints and push credentials never exposed to browsers.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create table private.push_config (id boolean primary key default true check(id), worker_secret text not null, vapid_public text, vapid_private text);
insert into private.push_config(id,worker_secret) values (true, encode(extensions.gen_random_bytes(32),'hex'));
create table private.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text unique not null, p256dh text not null, auth text not null, updated_at timestamptz not null default now()
);
create index push_subscription_user on private.push_subscriptions(user_id);
create table private.push_jobs (
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id) on delete cascade,
 subscription_id uuid not null references private.push_subscriptions(id) on delete cascade,
 attempts int not null default 0, next_attempt timestamptz not null default now(), lease_until timestamptz,
 created_at timestamptz not null default now(), unique(message_id,subscription_id)
);
create index push_jobs_due on private.push_jobs(next_attempt);
create function public.push_public_key() returns text language sql stable security definer set search_path='' as $$ select vapid_public from private.push_config where id $$;
revoke all on function public.push_public_key() from public,anon;
grant execute on function public.push_public_key() to authenticated;
create function public.push_register(p_endpoint text,p_p256dh text,p_auth text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid) then raise exception 'Sign in first'; end if;
 -- Only known browser push services; never allow arbitrary internal HTTP targets.
 if p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]]+$' or length(p_endpoint)>2048
 or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'Invalid push subscription'; end if;
 -- Serialise registration per account; also limit storage and queue amplification.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 173));
 if (select count(*) from private.push_subscriptions where user_id=uid and endpoint<>p_endpoint)>=10 then raise exception 'Too many devices registered'; end if;
 delete from private.push_jobs where subscription_id in (select id from private.push_subscriptions where endpoint=p_endpoint and user_id<>uid);
 insert into private.push_subscriptions(user_id,endpoint,p256dh,auth) values(uid,p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now();
end $$;
revoke all on function public.push_register(text,text,text) from public,anon;
grant execute on function public.push_register(text,text,text) to authenticated;
create function public.push_unregister(p_endpoint text) returns void language sql security definer set search_path='' as $$
 delete from private.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint;
$$;
revoke all on function public.push_unregister(text) from public,anon;
grant execute on function public.push_unregister(text) to authenticated;
create function public.push_worker_config() returns table(worker_secret text,vapid_public text,vapid_private text) language sql security definer set search_path='' as $$ select c.worker_secret,c.vapid_public,c.vapid_private from private.push_config c where id $$;
create function public.push_init_keys(p_public text,p_private text) returns void language sql security definer set search_path='' as $$ update private.push_config set vapid_public=p_public,vapid_private=p_private where id and vapid_public is null $$;
create function public.push_claim() returns table(id uuid,endpoint text,p256dh text,auth text) language plpgsql security definer set search_path='' as $$
begin
 delete from private.push_jobs where created_at < now()-interval '24 hours' or attempts>=8;
 return query with picked as (select j.id from private.push_jobs j where j.next_attempt<=now() and (j.lease_until is null or j.lease_until<now()) order by j.next_attempt for update skip locked limit 50),
 updated as (update private.push_jobs j set attempts=j.attempts+1,lease_until=now()+interval '2 minutes' from picked where j.id=picked.id returning j.id,j.subscription_id)
 select updated.id,s.endpoint,s.p256dh,s.auth from updated join private.push_subscriptions s on s.id=updated.subscription_id;
end $$;
create function public.push_finish(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status='gone' then delete from private.push_subscriptions where id=(select subscription_id from private.push_jobs where id=p_id);
 elsif p_status='sent' then delete from private.push_jobs where id=p_id;
 elsif p_status='retry' then update private.push_jobs set lease_until=null,next_attempt=now()+least(interval '30 minutes', interval '1 minute' * power(2,least(attempts,5))) where id=p_id;
 end if;
end $$;
revoke all on function public.push_worker_config(), public.push_init_keys(text,text),public.push_claim(),public.push_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.push_worker_config(), public.push_init_keys(text,text),public.push_claim(),public.push_finish(uuid,text) to service_role;
create function private.push_wake() returns void language plpgsql security definer set search_path='' as $$
begin
 perform net.http_post(url:='https://bkhldfjqxarnqmcidwog.supabase.co/functions/v1/push-worker',headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',(select worker_secret from private.push_config where id)),body:='{}'::jsonb,timeout_milliseconds:=15000);
end $$;
create function private.push_enqueue() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.push_jobs(message_id,subscription_id) select new.id,s.id from private.push_subscriptions s where s.user_id=new.recipient_id on conflict do nothing;
 if found then begin perform private.push_wake(); exception when others then null; end; end if;
 return new;
end $$;
create trigger message_push after insert on public.messages for each row execute function private.push_enqueue();
select cron.schedule('after-dark-push-retry','* * * * *', 'select private.push_wake()');
