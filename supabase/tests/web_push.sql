-- Transactional: test subscription ownership, validation and enqueue-once.
begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000111'),('10000000-0000-4000-8000-000000000112');
insert into public.profiles(id,username,display_name) values ('10000000-0000-4000-8000-000000000111','push_test_a_91827','A'),('10000000-0000-4000-8000-000000000112','push_test_b_91827','B');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000111',true);
select public.push_register('https://fcm.googleapis.com/fcm/send/test-token',repeat('a',87),repeat('b',22));
do $$ begin
 begin perform public.push_register('https://127.0.0.1/internal',repeat('a',87),repeat('b',22)); raise exception 'invalid endpoint accepted'; exception when raise_exception then if sqlerrm='invalid endpoint accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000112',true);
select public.push_unregister('https://fcm.googleapis.com/fcm/send/test-token');
reset role;
do $$ begin
 if (select count(*) from private.push_subscriptions where user_id='10000000-0000-4000-8000-000000000111')<>1 then raise exception 'cross-user unregister'; end if;
 if public.deliver_message('push_test_a_91827','Hello','20000000-0000-4000-8000-000000000111',repeat('a',64))<>'ok' then raise exception 'delivery failed'; end if;
 if public.deliver_message('push_test_a_91827','Hello','20000000-0000-4000-8000-000000000111',repeat('a',64))<>'ok' then raise exception 'retry failed'; end if;
 if (select count(*) from private.push_jobs j join public.messages m on m.id=j.message_id where m.request_id='20000000-0000-4000-8000-000000000111')<>1 then raise exception 'duplicate or missing job'; end if;
 if has_function_privilege('anon','public.push_register(text,text,text)','execute') or has_function_privilege('authenticated','public.push_claim()','execute') then raise exception 'worker privileges exposed'; end if;
end $$;
rollback;
