-- Assistant conversation persistence. Each client can hold many conversations
-- with the Architect. Each conversation holds an ordered list of messages.

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists conversations_client_id_idx on public.conversations(client_id, updated_at desc);

create table if not exists public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists conversation_messages_conv_idx on public.conversation_messages(conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "conversations client rw" on public.conversations;
create policy "conversations client rw" on public.conversations
  for all using (client_id = auth.uid() or public.is_coach())
         with check (client_id = auth.uid() or public.is_coach());

drop policy if exists "messages client rw" on public.conversation_messages;
create policy "messages client rw" on public.conversation_messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.client_id = auth.uid() or public.is_coach())
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.client_id = auth.uid() or public.is_coach())
    )
  );
