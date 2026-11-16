create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);
alter table public.message_reports enable row level security;
revoke all on public.message_reports from anon, authenticated;
grant insert (reporter_id, message_id, reason) on public.message_reports to authenticated;
create policy reports_create_own on public.message_reports for insert to authenticated with check (
  reporter_id = (select auth.uid()) and exists (
    select 1 from public.messages m where m.id = message_id and m.recipient_id = (select auth.uid())
  )
);
