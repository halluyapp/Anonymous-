alter table public.message_reports add column body_snapshot text not null default '';
create function public.capture_report_body() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  select body into new.body_snapshot from public.messages where id = new.message_id and recipient_id = (select auth.uid());
  if new.body_snapshot is null then raise exception 'Message unavailable'; end if;
  return new;
end;
$$;
revoke all on function public.capture_report_body() from public, anon, authenticated;
create trigger capture_report_body before insert on public.message_reports for each row execute function public.capture_report_body();
