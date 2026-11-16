-- Run against a disposable test database with sufficient privileges, never production data.
-- Everything is rolled back; fixed IDs make failures easier to inspect.
begin;
insert into auth.users (id) values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
insert into public.profiles (id, username, display_name) values ('10000000-0000-4000-8000-000000000001', 'test_alice_91827', 'Test A'), ('10000000-0000-4000-8000-000000000002', 'test_bob_91827', 'Test B');
do $$ begin
  if has_table_privilege('anon', 'public.messages', 'select') or has_table_privilege('anon', 'public.messages', 'insert') then raise exception 'anonymous messages access'; end if;
  if has_function_privilege('anon', 'public.deliver_message(text,text,uuid,text)', 'execute') then raise exception 'anonymous delivery RPC access'; end if;
  if public.deliver_message('test_alice_91827', 'test message', '20000000-0000-4000-8000-000000000001', repeat('a', 64)) <> 'ok' then raise exception 'delivery failed'; end if;
  if public.deliver_message('test_alice_91827', 'test message', '20000000-0000-4000-8000-000000000001', repeat('a', 64)) <> 'ok' then raise exception 'retry failed'; end if;
  if (select count(*) from public.messages) <> 1 then raise exception 'duplicate delivery'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$ begin if (select count(*) from public.messages) <> 0 then raise exception 'cross-account data visible'; end if; end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$ begin if (select count(*) from public.messages) <> 1 then raise exception 'owner cannot see message'; end if; end $$;
reset role;
rollback;
