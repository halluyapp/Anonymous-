create or replace function public.deliver_message(p_username text, p_body text, p_request_id uuid, p_sender_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare target uuid; bucket_key text; attempts integer; existing uuid;
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
  bucket_key := p_sender_hash || ':' || target::text;
  insert into private.submission_windows as w (bucket, count, window_start) values (bucket_key, 1, now())
  on conflict (bucket) do update set count = case when w.window_start < now() - interval '1 hour' then 1 else w.count + 1 end,
    window_start = case when w.window_start < now() - interval '1 hour' then now() else w.window_start end
  returning count into attempts;
  if attempts > 8 then return 'rate_limited'; end if;
  insert into public.messages (recipient_id, body, request_id) values (target, p_body, p_request_id);
  delete from private.submission_windows where window_start < now() - interval '24 hours';
  return 'ok';
end;
$$;
