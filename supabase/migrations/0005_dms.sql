-- Direct messages between a client and the coach. A thread pairs a single
-- client with the coaching side. Messages order chronologically inside a
-- thread. RLS: client sees their own thread; coach sees all threads.

create table if not exists public.dm_threads (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (client_id)
);
create index if not exists dm_threads_last_activity_idx on public.dm_threads(last_activity_at desc);

create table if not exists public.dm_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.dm_threads(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  read_by_client boolean not null default false,
  read_by_coach  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on public.dm_messages(thread_id, created_at asc);

alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;

drop policy if exists "dm_threads client rw" on public.dm_threads;
create policy "dm_threads client rw" on public.dm_threads
  for all using (client_id = auth.uid() or public.is_coach())
         with check (client_id = auth.uid() or public.is_coach());

drop policy if exists "dm_messages client rw" on public.dm_messages;
create policy "dm_messages client rw" on public.dm_messages
  for all using (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id
        and (t.client_id = auth.uid() or public.is_coach())
    )
  )
  with check (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id
        and (t.client_id = auth.uid() or public.is_coach())
    )
  );

-- Realtime publication
do $$
declare tbl text;
begin
  foreach tbl in array array['dm_threads','dm_messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
