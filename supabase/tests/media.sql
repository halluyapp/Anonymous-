-- Transactional tests; never leaves test users or fake Storage metadata behind.
begin;
insert into auth.users (id) values ('10000000-0000-4000-8000-000000000101'), ('10000000-0000-4000-8000-000000000102');
insert into public.profiles (id,username,display_name) values ('10000000-0000-4000-8000-000000000101','media_test_a_91827','A'),('10000000-0000-4000-8000-000000000102','media_test_b_91827','B');
do $$ begin
 if has_function_privilege('anon','public.deliver_media(text,text,uuid,text,text,text)','execute') or has_function_privilege('anon','public.reserve_media_upload(text,uuid,text,text)','execute') then raise exception 'anonymous RPC access'; end if;
 if public.reserve_media_upload('media_test_a_91827','20000000-0000-4000-8000-000000000101',repeat('a',64),'voice') <> 'ok' then raise exception 'reservation failed'; end if;
 if public.deliver_media('media_test_a_91827','','20000000-0000-4000-8000-000000000101',repeat('a',64),'voice','20000000-0000-4000-8000-000000000101/30000000-0000-4000-8000-000000000101.webm') <> 'ok' then raise exception 'delivery failed'; end if;
 if public.deliver_media('media_test_a_91827','','20000000-0000-4000-8000-000000000101',repeat('a',64),'voice','20000000-0000-4000-8000-000000000101/30000000-0000-4000-8000-000000000102.webm') <> 'duplicate' then raise exception 'retry failed'; end if;
 if public.reserve_media_upload('media_test_a_91827','20000000-0000-4000-8000-000000000101',repeat('a',64),'voice') <> 'duplicate' then raise exception 'reservation retry failed'; end if;
end $$;
insert into storage.objects(bucket_id,name) values('message-media','20000000-0000-4000-8000-000000000101/30000000-0000-4000-8000-000000000101.webm');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000102',true);
do $$ begin if exists (select 1 from storage.objects where bucket_id='message-media') then raise exception 'cross account media leak'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000101',true);
do $$ begin if (select count(*) from storage.objects where bucket_id='message-media')<>1 then raise exception 'owner cannot read media'; end if; end $$;
reset role;
rollback;
