-- Media is private: only a recipient with a matching message can read an object.
alter table public.messages add column media_kind text check (media_kind in ('image','voice'));
alter table public.messages add column media_path text unique;
alter table public.messages add constraint media_pair check ((media_kind is null) = (media_path is null));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('message-media','message-media',false,2097152,array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4'])
on conflict (id) do nothing;
create policy media_recipient_read on storage.objects for select to authenticated using (
  bucket_id = 'message-media' and exists (select 1 from public.messages m where m.media_path = name and m.recipient_id = (select auth.uid()))
);
create policy media_recipient_delete on storage.objects for delete to authenticated using (
  bucket_id = 'message-media' and exists (select 1 from public.messages m where m.media_path = name and m.recipient_id = (select auth.uid()))
);
create function public.deliver_media(p_username text, p_body text, p_request_id uuid, p_sender_hash text, p_media_kind text, p_media_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare result text; target uuid; existing public.messages%rowtype;
begin
 if p_media_kind not in ('image','voice') or p_media_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp|webm|ogg|m4a)$' or p_body is null or char_length(p_body)>5000 then return 'invalid'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('request:' || p_request_id::text, 0));
 select id into target from public.profiles where username = p_username and link_enabled = true;
 if target is null then return 'not_found'; end if;
 select * into existing from public.messages where request_id = p_request_id;
 if found then
   if existing.recipient_id = target and existing.media_kind = p_media_kind then return 'duplicate'; else return 'invalid'; end if;
 end if;
 result := public.deliver_message(p_username, case when length(trim(p_body))=0 then case when p_media_kind='voice' then 'Voice message' else 'Photo attached' end else p_body end, p_request_id, p_sender_hash);
 if result <> 'ok' then return result; end if;
 update public.messages set media_kind=p_media_kind, media_path=p_media_path where request_id=p_request_id;
 return 'ok';
end;
$$;
revoke all on function public.deliver_media(text,text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.deliver_media(text,text,uuid,text,text,text) to service_role;
