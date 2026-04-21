-- Lock privileged columns on `profiles` so a client cannot self-promote.
-- `role`, `plan`, `loop_stage`, and `start_date` are set by the server
-- (billing webhook, loop derivation, onboarding). A client UPDATE that
-- attempts to change any of them is rejected at the trigger level before
-- RLS has a chance to let it through.

create or replace function public.prevent_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Coaches (and the service role, which bypasses triggers' SECURITY DEFINER
  -- context only via auth.uid() checks) can change anything.
  if public.is_coach() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role cannot be changed by client';
  end if;
  if new.plan is distinct from old.plan then
    raise exception 'plan is set by the billing webhook';
  end if;
  if new.loop_stage is distinct from old.loop_stage then
    raise exception 'loop_stage is derived server-side';
  end if;
  if new.start_date is distinct from old.start_date then
    raise exception 'start_date is set at onboarding only';
  end if;

  return new;
end $$;

drop trigger if exists profiles_lock_privileged on public.profiles;
create trigger profiles_lock_privileged
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_change();
