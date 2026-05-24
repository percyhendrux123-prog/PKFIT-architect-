-- ════════════════════════════════════════════════════════════════════════════
-- 0057_assistant_conversations_rls.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Tighten conversations + conversation_messages RLS to the three-tier scope
-- model introduced in 0054_rls_three_tier_scope.sql.
--
-- BEFORE (0004_conversations.sql):
--   "conversations client rw" — client_id = auth.uid() OR is_coach()
--   "messages client rw"      — same, scoped via conversation join
-- This allowed ANY coach to see every client's Architect conversations.
--
-- AFTER (this migration):
--   OWNER (Percy) — full RW on every row.
--   COACH         — RW only on conversations whose client_id matches a row in
--                   coach_client_assignments (active) where coach_id = auth.uid().
--   CLIENT        — RW only on their own conversations and the messages within.
--
-- The /assistant page already filters by client_id at the query layer, so this
-- migration closes the back-door (RLS-level) leak without changing app behavior
-- for the legitimate cases.
--
-- DEPENDS ON
-- ──────────
-- - 0004_conversations.sql (table definitions)
-- - 0054_rls_three_tier_scope.sql (is_owner, is_coach_for helpers)
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "conversations client rw" on public.conversations;
drop policy if exists "messages client rw"      on public.conversation_messages;
drop policy if exists "conversations tier rw"   on public.conversations;
drop policy if exists "messages tier rw"        on public.conversation_messages;

create policy "conversations tier rw" on public.conversations
  for all
  using (
       public.is_owner()
    or client_id = auth.uid()
    or public.is_coach_for(client_id)
  )
  with check (
       public.is_owner()
    or client_id = auth.uid()
    or public.is_coach_for(client_id)
  );

create policy "messages tier rw" on public.conversation_messages
  for all
  using (
    exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (
              public.is_owner()
           or c.client_id = auth.uid()
           or public.is_coach_for(c.client_id)
         )
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (
              public.is_owner()
           or c.client_id = auth.uid()
           or public.is_coach_for(c.client_id)
         )
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- DOWN (rollback) — restore the previous "any coach sees all" policies.
-- ════════════════════════════════════════════════════════════════════════════
-- drop policy if exists "conversations tier rw" on public.conversations;
-- drop policy if exists "messages tier rw"      on public.conversation_messages;
-- create policy "conversations client rw" on public.conversations
--   for all using (client_id = auth.uid() or public.is_coach())
--          with check (client_id = auth.uid() or public.is_coach());
-- create policy "messages client rw" on public.conversation_messages
--   for all using (
--     exists (
--       select 1 from public.conversations c
--        where c.id = conversation_id
--          and (c.client_id = auth.uid() or public.is_coach())
--     )
--   ) with check (
--     exists (
--       select 1 from public.conversations c
--        where c.id = conversation_id
--          and (c.client_id = auth.uid() or public.is_coach())
--     )
--   );
