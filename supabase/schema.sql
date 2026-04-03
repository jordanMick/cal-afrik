-- Extension UUID
create extension if not exists "uuid-ossp";

-- ─── Table : profils utilisateurs ──────────────────────
create table user_profiles (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id) on delete cascade not null unique,
  name                  text not null,
  age                   int check (age > 0 and age < 120),
  gender                text check (gender in ('homme', 'femme', 'autre')),
  weight_kg             numeric(5,2),
  height_cm             int,
  activity_level        text check (activity_level in ('sedentaire','leger','modere','actif','tres_actif')),
  goal                  text check (goal in ('perdre','maintenir','prendre')),
  calorie_target        int,
  protein_target_g      int,
  carbs_target_g        int,
  fat_target_g          int,
  preferred_cuisines    text[] default '{}',
  dietary_restrictions  text[] default '{}',
  language              text default 'fr',
  country               text default 'TG',
  onboarding_done       boolean default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ─── Table : aliments africains ────────────────────────
create table food_items (
  id                    uuid primary key default uuid_generate_v4(),
  name_fr               text not null,
  name_local            text,
  name_en               text,
  category              text not null,
  origin_countries      text[] default '{}',
  calories_per_100g     numeric(6,2) not null,
  protein_per_100g      numeric(5,2) default 0,
  carbs_per_100g        numeric(5,2) default 0,
  fat_per_100g          numeric(5,2) default 0,
  fiber_per_100g        numeric(5,2) default 0,
  default_portion_g     int default 250,
  image_url             text,
  verified              boolean default false,
  created_at            timestamptz default now()
);

-- ─── Table : repas ─────────────────────────────────────
create table meals (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  food_item_id          uuid references food_items(id),
  custom_name           text,
  meal_type             text check (meal_type in ('petit_dejeuner','dejeuner','diner','collation')),
  portion_g             numeric(6,2) not null,
  calories              numeric(7,2) not null,
  protein_g             numeric(6,2) default 0,
  carbs_g               numeric(6,2) default 0,
  fat_g                 numeric(6,2) default 0,
  image_url             text,
  ai_confidence         int check (ai_confidence between 0 and 100),
  logged_at             timestamptz default now(),
  notes                 text
);

-- ─── Table : logs poids ────────────────────────────────
create table weight_logs (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  weight_kg             numeric(5,2) not null,
  logged_at             timestamptz default now()
);

-- ─── Index ─────────────────────────────────────────────
create index idx_meals_user_date on meals(user_id, logged_at desc);
create index idx_meals_user_id on meals(user_id);
create index idx_food_items_category on food_items(category);
create index idx_weight_logs_user on weight_logs(user_id, logged_at desc);

-- ─── RLS ───────────────────────────────────────────────
alter table user_profiles enable row level security;
alter table meals enable row level security;
alter table weight_logs enable row level security;
alter table food_items enable row level security;

create policy "users_own_profile" on user_profiles
  for all using (auth.uid() = user_id);

create policy "users_own_meals" on meals
  for all using (auth.uid() = user_id);

create policy "users_own_weight" on weight_logs
  for all using (auth.uid() = user_id);

create policy "food_items_public_read" on food_items
  for select using (true);

-- ─── Données initiales ─────────────────────────────────
insert into food_items (name_fr, name_local, category, origin_countries, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_portion_g, verified) values
('Fufu de manioc',        'Foufou',       'tubercules',     '{"CI","GH","TG","BJ","CM"}', 158,  1.2, 38.0,  0.3, 300, true),
('Attiéké',               'Attiéké',      'cereales',       '{"CI"}',                     167,  1.5, 37.5,  1.2, 200, true),
('Igname pilée',          'Amala',        'tubercules',     '{"GH","TG","BJ","NG"}',      118,  1.5, 27.5,  0.2, 300, true),
('Banku',                 'Banku',        'tubercules',     '{"GH"}',                     162,  2.1, 35.8,  0.8, 300, true),
('Tô de mil',             'Tô',           'cereales',       '{"BF","ML","NE","TG"}',      144,  4.2, 29.8,  1.4, 300, true),
('Riz au gras',           'Jollof Rice',  'plats_composes', '{"SN","GH","NG","TG","BJ"}', 185,  5.8, 28.5,  5.6, 350, true),
('Thiéboudienne',         'Ceebu Jën',    'plats_composes', '{"SN","GM","GW"}',           210, 12.5, 26.8,  6.8, 400, true),
('Sauce arachide',        'Mafé',         'sauces',         '{"SN","ML","GH","CI","TG"}', 285, 10.2, 12.5, 22.8, 150, true),
('Sauce graine',          'Sauce palmiste','sauces',        '{"CI","GH","TG","BJ","CM"}', 320,  5.8, 10.2, 28.5, 150, true),
('Sauce gombo',           null,           'sauces',         '{"TG","BJ","GH","NG"}',       85,  3.5,  8.2,  4.8, 150, true),
('Poulet braisé',         null,           'viandes',        '{"CI","SN","TG","GH"}',      215, 28.5,  0.0, 11.5, 250, true),
('Poisson braisé',        null,           'poissons',       '{"CI","SN","GH","TG","BJ"}', 185, 26.8,  0.0,  8.5, 200, true),
('Alloco',                'Kelewele',     'snacks',         '{"CI","GH","TG"}',           220,  1.5, 32.5,  9.8, 150, true),
('Akara',                 'Koose',        'snacks',         '{"SN","NG","GH","TG"}',      265,  8.5, 22.5, 15.8, 100, true),
('Bissap',                'Wonjo',        'boissons',       '{"SN","ML","GH","TG","BJ"}',  52,  0.5, 12.8,  0.1, 250, true),
('Haricots niébé cuits',  'Lobia',        'legumineuses',   '{"NG","GH","TG","BJ","SN"}', 118,  7.8, 21.2,  0.5, 200, true),
('Arachides grillées',    null,           'legumineuses',   '{"TG","SN","ML","GH"}',      567, 25.8, 16.5, 49.2,  30, true);