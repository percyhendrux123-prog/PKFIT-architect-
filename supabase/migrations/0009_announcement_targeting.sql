-- Target an announcement at a subset of clients by plan tier. Null means
-- "visible to everyone authenticated" (current behaviour for regular posts).

alter table public.community_posts
  add column if not exists target_plan text;

-- Drop and replace the read policy so clients only see announcements
-- whose target_plan is null, matches their plan, or they authored.
drop policy if exists "posts read authenticated" on public.community_posts;
create policy "posts read targeted" on public.community_posts
  for select using (
    auth.role() = 'authenticated'
    and (
      target_plan is null
      or author_id = auth.uid()
      or public.is_coach()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.plan = community_posts.target_plan
      )
    )
  );
