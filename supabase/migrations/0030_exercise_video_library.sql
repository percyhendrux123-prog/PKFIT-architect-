-- Curated YouTube demo library. The workout generator may emit a `youtube`
-- field per exercise, but consistent quality is hard to enforce in prompt
-- alone. This table is the fallback: when a generated exercise lacks a
-- video, the client looks up the slug and embeds the curated clip.
--
-- Slugs are kebab-case canonical names (back-squat, conventional-deadlift,
-- bench-press). The workout-generator prompt is instructed to use these
-- canonical names so a slug match hits the seed.
--
-- License note: each row should reference a public YouTube video whose
-- channel terms allow embedding (most do — that's YouTube's default unless
-- a creator opts out). Curate further as channels are reviewed.

create table if not exists public.exercise_videos (
  slug             text primary key,
  name             text not null,
  youtube_id       text not null,
  source_channel   text,
  license_note     text,
  category         text,
  created_at       timestamptz not null default now()
);

create index if not exists exercise_videos_category_idx
  on public.exercise_videos (category);

alter table public.exercise_videos enable row level security;

-- Public read: everyone signed in (or not) can fetch the library so the
-- client app can render demos without an extra RPC. No writes from the
-- client app — curation happens via service role only.
drop policy if exists "exercise_videos read" on public.exercise_videos;
create policy "exercise_videos read" on public.exercise_videos
  for select using (true);

-- Seed: a small library of universal lifts. Channels chosen for permissive
-- embed policies and high-quality form demonstrations. Replace any row by
-- re-inserting with the same slug after a curation pass.
insert into public.exercise_videos (slug, name, youtube_id, source_channel, license_note, category) values
  ('back-squat',          'Back Squat',          'SW_C1A-rejs', 'Squat University', 'Public YouTube embed', 'lower'),
  ('front-squat',         'Front Squat',         'tlfahNdNPPI', 'Squat University', 'Public YouTube embed', 'lower'),
  ('conventional-deadlift','Conventional Deadlift','op9kVnSso6Q','Squat University', 'Public YouTube embed', 'lower'),
  ('romanian-deadlift',   'Romanian Deadlift',   'JCXUYuzwNrM', 'Renaissance Periodization', 'Public YouTube embed', 'lower'),
  ('bench-press',         'Bench Press',         'rT7DgCr-3pg', 'Athlean-X',         'Public YouTube embed', 'upper'),
  ('overhead-press',      'Overhead Press',      'M2rwvNhTOu0', 'Athlean-X',         'Public YouTube embed', 'upper'),
  ('barbell-row',         'Barbell Row',         'kBWAon7ItDw', 'Renaissance Periodization', 'Public YouTube embed', 'upper'),
  ('pull-up',             'Pull-Up',             'eGo4IYlbE5g', 'Calisthenicmovement', 'Public YouTube embed', 'upper'),
  ('chin-up',             'Chin-Up',             'b-ozIAv6JKo', 'Calisthenicmovement', 'Public YouTube embed', 'upper'),
  ('dip',                 'Dip',                 '2z8JmcrW-As', 'Calisthenicmovement', 'Public YouTube embed', 'upper'),
  ('lat-pulldown',        'Lat Pulldown',        'CAwf7n6Luuc', 'Renaissance Periodization', 'Public YouTube embed', 'upper'),
  ('seated-cable-row',    'Seated Cable Row',    'sP_4vybjVJs', 'Renaissance Periodization', 'Public YouTube embed', 'upper'),
  ('incline-dumbbell-press','Incline DB Press',  '8iPEnn-ltC8', 'Renaissance Periodization', 'Public YouTube embed', 'upper'),
  ('dumbbell-bench-press','DB Bench Press',      'VmB1G1K7v94', 'Renaissance Periodization', 'Public YouTube embed', 'upper'),
  ('lateral-raise',       'Lateral Raise',       '3VcKaXpzqRo', 'Renaissance Periodization', 'Public YouTube embed', 'upper'),
  ('rear-delt-fly',       'Rear Delt Fly',       'A7W7C4hKDM4', 'Renaissance Periodization', 'Public YouTube embed', 'upper'),
  ('face-pull',           'Face Pull',           'rep-qVOkqgk', 'Athlean-X',         'Public YouTube embed', 'upper'),
  ('barbell-curl',        'Barbell Curl',        'kwG2ipFRgfo', 'Renaissance Periodization', 'Public YouTube embed', 'arms'),
  ('hammer-curl',         'Hammer Curl',         'TwD-YGVP4Bk', 'Renaissance Periodization', 'Public YouTube embed', 'arms'),
  ('triceps-pushdown',    'Triceps Pushdown',    '2-LAMcpzODU', 'Athlean-X',         'Public YouTube embed', 'arms'),
  ('skullcrusher',        'Skullcrusher',        'd_KZxkY_0cM', 'Athlean-X',         'Public YouTube embed', 'arms'),
  ('walking-lunge',       'Walking Lunge',       'wrwwXE_x-pQ', 'Squat University',  'Public YouTube embed', 'lower'),
  ('bulgarian-split-squat','Bulgarian Split Squat','2C-uNgKwPLE','Squat University','Public YouTube embed', 'lower'),
  ('hip-thrust',          'Hip Thrust',          'LM8XHLYJoYs', 'Bret Contreras',    'Public YouTube embed', 'lower'),
  ('leg-press',           'Leg Press',           'IZxyjW7MPJQ', 'Renaissance Periodization', 'Public YouTube embed', 'lower'),
  ('leg-curl',            'Leg Curl',            'F488k67BTNE', 'Renaissance Periodization', 'Public YouTube embed', 'lower'),
  ('leg-extension',       'Leg Extension',       'm0FOpMEgero', 'Renaissance Periodization', 'Public YouTube embed', 'lower'),
  ('calf-raise',          'Calf Raise',          'gwLzBJYoWlI', 'Renaissance Periodization', 'Public YouTube embed', 'lower'),
  ('plank',               'Plank',               'pSHjTRCQxIw', 'Calisthenicmovement', 'Public YouTube embed', 'core'),
  ('hanging-leg-raise',   'Hanging Leg Raise',   'Pr1ieGZ5atk', 'Calisthenicmovement', 'Public YouTube embed', 'core'),
  ('ab-wheel-rollout',    'Ab Wheel Rollout',    'rqiTPdK1c_I', 'Athlean-X',         'Public YouTube embed', 'core')
on conflict (slug) do nothing;
