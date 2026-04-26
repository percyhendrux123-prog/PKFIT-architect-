-- Calendar: separate scheduling from logging.
--
-- workout_sessions.performed_at marks when a session was actually completed.
-- A planned-but-not-yet-done session has no logical home in the existing
-- schema. Adding a nullable scheduled_for lets the Apple-style calendar
-- show planned sessions, drag-to-reschedule them, and convert a planned
-- session to a logged one when performed_at is filled in.
--
-- Existing rows keep performed_at; scheduled_for is null for backfill.

alter table public.workout_sessions
  add column if not exists scheduled_for timestamptz;

comment on column public.workout_sessions.scheduled_for is
  'Planned start time. Drag-to-reschedule on the Calendar updates this. ' ||
  'A row with scheduled_for set and performed_at null is a planned session; ' ||
  'with both set it is a completed session.';

create index if not exists workout_sessions_scheduled_idx
  on public.workout_sessions (client_id, scheduled_for)
  where scheduled_for is not null;

-- Speed up date-bounded reads from the calendar.
create index if not exists meals_client_date_idx
  on public.meals (client_id, date);

create index if not exists check_ins_client_date_idx
  on public.check_ins (client_id, date);
