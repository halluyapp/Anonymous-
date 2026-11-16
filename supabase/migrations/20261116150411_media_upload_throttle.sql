create function public.reserve_media_upload(p_username text,p_request_id uuid,p_sender_hash text,p_kind text) returns text language plpgsql security definer set search_path='' as $$
declare target uuid; existing public.messages%rowtype; key text; attempts integer;
begin
 if p_username !~ '^[a-z0-9_]{3,24}$' or p_sender_hash !~ '^[0-9a-f]{64}$' or p_kind not in ('voice','image') then return 'invalid'; end if;
 select id into target from public.profiles where username=p_username and link_enabled=true;
 if target is null then return 'not_found'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('media-reserve:'||target::text,0));
 select * into existing from public.messages where request_id=p_request_id;
 if found then if existing.recipient_id=target and existing.media_kind=p_kind then return 'duplicate'; else return 'invalid'; end if; end if;
 delete from private.submission_windows where window_start < now() - interval '24 hours';
 key := 'media-recipient:'||target::text;
 insert into private.submission_windows as w(bucket,count,window_start) values(key,1,now()) on conflict(bucket) do update set count=case when w.window_start < now()-interval '1 hour' then 1 else w.count+1 end, window_start=case when w.window_start < now()-interval '1 hour' then now() else w.window_start end returning count into attempts;
 if attempts>120 then return 'rate_limited'; end if;
 key := 'media-sender:'||p_sender_hash||':'||target::text;
 insert into private.submission_windows as w(bucket,count,window_start) values(key,1,now()) on conflict(bucket) do update set count=case when w.window_start < now()-interval '1 hour' then 1 else w.count+1 end, window_start=case when w.window_start < now()-interval '1 hour' then now() else w.window_start end returning count into attempts;
 if attempts>8 then return 'rate_limited'; end if;
 return 'ok';
end $$;
revoke all on function public.reserve_media_upload(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_media_upload(text,uuid,text,text) to service_role;
