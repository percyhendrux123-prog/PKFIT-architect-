-- Conversation-scoped context. Clients can pin one or more pieces of their
-- own data (a program, a check-in, a review, a habit stack) to a conversation.
-- The client-assistant function reads this and injects a compact summary into
-- the system prompt so the Architect has real data to reason over.

alter table public.conversations
  add column if not exists context jsonb not null default '[]'::jsonb;
