-- Exercise library. A curated, coach-managed catalogue the workout builder
-- autocompletes against. Seeded with canonical compound and accessory lifts.

create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,
  primary_muscle text,
  equipment    text,
  youtube_id   text,
  cues         text,
  created_at   timestamptz not null default now()
);
create unique index if not exists exercises_name_idx on public.exercises (lower(name));

alter table public.exercises enable row level security;

drop policy if exists "exercises read authenticated" on public.exercises;
create policy "exercises read authenticated" on public.exercises
  for select using (auth.role() = 'authenticated');

drop policy if exists "exercises coach write" on public.exercises;
create policy "exercises coach write" on public.exercises
  for all using (public.is_coach()) with check (public.is_coach());

-- ─── SEED ────────────────────────────────────────────────────────────────
insert into public.exercises (name, category, primary_muscle, equipment, cues) values
  -- Squat
  ('Back Squat', 'squat', 'quads', 'barbell', 'Bar high on traps. Brace. Break hips and knees together. Knees track toes.'),
  ('Front Squat', 'squat', 'quads', 'barbell', 'Elbows up. Bar shelves on front delts. Vertical torso through the lift.'),
  ('Bulgarian Split Squat', 'squat', 'quads', 'dumbbell', 'Rear foot elevated. Drop the back knee straight down. Drive through front heel.'),
  ('Goblet Squat', 'squat', 'quads', 'dumbbell', 'Hold dumbbell at chest. Elbows inside knees in the hole.'),
  ('Hack Squat', 'squat', 'quads', 'machine', 'Feet shoulder-width, slight outward turn. Full depth. Control the descent.'),
  -- Hinge
  ('Conventional Deadlift', 'hinge', 'posterior chain', 'barbell', 'Bar over mid-foot. Shoulders just ahead of bar. Push the floor away.'),
  ('Romanian Deadlift', 'hinge', 'hamstrings', 'barbell', 'Soft knees. Hinge at the hip. Bar stays close. Stretch in the hamstring, not the low back.'),
  ('Sumo Deadlift', 'hinge', 'posterior chain', 'barbell', 'Wide stance, hands inside knees. Torso more vertical than conventional.'),
  ('Hip Thrust', 'hinge', 'glutes', 'barbell', 'Shoulder blades on bench, ribs down, drive through heels, full glute lockout.'),
  ('Kettlebell Swing', 'hinge', 'posterior chain', 'kettlebell', 'Hinge, not a squat. Snap the hips. Bell is weightless at the top.'),
  -- Press
  ('Bench Press', 'horizontal push', 'chest', 'barbell', 'Upper back tight. Bar to lower sternum. Drive heels. Wrists stacked.'),
  ('Incline Bench Press', 'horizontal push', 'upper chest', 'barbell', 'Bench 30 degrees. Bar to upper chest. Elbows ~45 degrees from torso.'),
  ('Dumbbell Bench Press', 'horizontal push', 'chest', 'dumbbell', 'Dumbbells track wider than bar. Squeeze at lockout. Slow eccentric.'),
  ('Overhead Press', 'vertical push', 'delts', 'barbell', 'Glutes tight. Bar stacked over mid-foot at lockout. No layback.'),
  ('Seated Dumbbell Shoulder Press', 'vertical push', 'delts', 'dumbbell', 'Neutral or slight external rotation. Elbows under wrists throughout.'),
  ('Push-Up', 'horizontal push', 'chest', 'bodyweight', 'Plank line from head to heels. Elbows 45 degrees. Full lockout.'),
  ('Dip', 'horizontal push', 'chest', 'bodyweight', 'Slight forward lean for chest bias. Full range. Control the descent.'),
  -- Pull
  ('Pull-Up', 'vertical pull', 'lats', 'bodyweight', 'Chin over the bar. Pull elbows down and back. No kip.'),
  ('Lat Pulldown', 'vertical pull', 'lats', 'cable', 'Chest up. Drive elbows down toward pockets. Squeeze at the bottom.'),
  ('Barbell Row', 'horizontal pull', 'mid-back', 'barbell', 'Hip hinge to ~45 degrees. Bar to lower sternum. Control the eccentric.'),
  ('Chest-Supported Row', 'horizontal pull', 'mid-back', 'machine', 'Chest pinned. Pull to lower ribs. Pause one second at peak contraction.'),
  ('Seated Cable Row', 'horizontal pull', 'mid-back', 'cable', 'Tall torso. Pull handle to navel. No torso swing.'),
  ('Face Pull', 'horizontal pull', 'rear delts', 'cable', 'High elbows. Pull rope to forehead. External rotation at peak.'),
  -- Accessories
  ('Romanian Deadlift (Dumbbell)', 'hinge', 'hamstrings', 'dumbbell', 'Same cue as barbell RDL. Dumbbells stay just outside the thighs.'),
  ('Walking Lunge', 'unilateral', 'quads', 'dumbbell', 'Long stride. Back knee lightly taps the floor. Drive through front heel.'),
  ('Leg Press', 'squat', 'quads', 'machine', 'Feet mid-platform. Full range. Do not let low back round off the pad.'),
  ('Leg Extension', 'isolation', 'quads', 'machine', 'Pause one second at lockout. Controlled eccentric.'),
  ('Lying Hamstring Curl', 'isolation', 'hamstrings', 'machine', 'Full range. No hip flexion. Pause at peak contraction.'),
  ('Standing Calf Raise', 'isolation', 'calves', 'machine', 'Full stretch at the bottom. Pause one count at the top.'),
  ('Seated Calf Raise', 'isolation', 'calves', 'machine', 'Targets soleus. Slower tempo than standing raise.'),
  ('Lateral Raise', 'isolation', 'side delts', 'dumbbell', 'Lead with the elbows. Stop at shoulder height. No momentum.'),
  ('Rear Delt Fly', 'isolation', 'rear delts', 'dumbbell', 'Chest on an incline bench. Drive the dumbbells out and back. Squeeze.'),
  ('EZ-Bar Curl', 'isolation', 'biceps', 'barbell', 'Elbows pinned. Full range. Control the eccentric.'),
  ('Incline Dumbbell Curl', 'isolation', 'biceps', 'dumbbell', 'Bench 45-60 degrees. Elbows stay under the shoulder. Stretched position.'),
  ('Rope Tricep Pushdown', 'isolation', 'triceps', 'cable', 'Elbows tight to sides. Separate the rope at the bottom.'),
  ('Overhead Tricep Extension', 'isolation', 'triceps', 'dumbbell', 'Elbows pinned, tight to the ears. Full stretch. Lockout every rep.'),
  ('Cable Crunch', 'isolation', 'abs', 'cable', 'Hip hinge off the knees. Curl the spine, not the hips. Pause at max flexion.'),
  ('Plank', 'isolation', 'abs', 'bodyweight', 'Posterior pelvic tilt. Ribs pulled down. Breathe through the nose.'),
  ('Hanging Leg Raise', 'isolation', 'abs', 'bodyweight', 'No swing. Curl the pelvis toward the ribs at the top.'),
  ('Farmer Carry', 'carry', 'grip / core', 'dumbbell', 'Tall posture. Slow steps. Breathe through the nose. Do not shrug.'),
  ('Treadmill Walk (Incline)', 'cardio', 'conditioning', 'machine', 'Incline 10-12 percent. Speed 3-3.5 mph. Zone 2, no holding rails.')
on conflict do nothing;
