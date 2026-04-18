-- =============================================================================
-- Cal-Afrik — schéma de référence (PostgreSQL / Supabase)
-- Mis à jour pour refléter les tables/colonnes attendues par l'application.
-- Si ta base diverge encore, exporte depuis Supabase (SQL Editor → DDL ou
-- `supabase db dump`) et fusionne avec ce fichier.
-- Storage : bucket public `meal-images` (hors SQL, à créer dans le dashboard).
-- =============================================================================

create extension if not exists "uuid-ossp";

-- ─── Profils utilisateurs (table centrale) ─────────────────────────────────
create table user_profiles (
  id                            uuid primary key default uuid_generate_v4(),
  user_id                       uuid not null unique references auth.users(id) on delete cascade,
  name                          text not null default 'Utilisateur',
  email                         text,
  age                           int check (age > 0 and age < 120),
  gender                        text check (gender in ('homme', 'femme', 'autre')),
  weight_kg                     numeric(5,2),
  height_cm                     int,
  activity_level                text check (activity_level in ('sedentaire','leger','modere','actif','tres_actif')),
  goal                          text check (goal in ('perdre','maintenir','prendre')),
  goal_weight_kg                numeric(5,2),
  calorie_target                int,
  protein_target_g              int,
  carbs_target_g                int,
  fat_target_g                  int,
  preferred_cuisines            text[] default '{}',
  dietary_restrictions          text[] default '{}',
  language                      text default 'fr',
  country                       text default 'TG',
  onboarding_done               boolean default false,
  subscription_tier             text default 'free' check (subscription_tier in ('free','pro','premium')),
  subscription_expires_at       timestamptz,
  chat_messages_today           int default 0,
  scan_feedbacks_today          int default 0,
  last_usage_reset_date         date,
  has_used_free_lifetime_feedback boolean default false,
  monthly_ai_bilan_used_at      timestamptz,
  notify_meals                  boolean default true,
  notify_hydration              boolean default true,
  notify_reports                boolean default true,
  notify_subscription           boolean default true,
  suggested_menus_json          jsonb,
  created_at                    timestamptz default now(),
  updated_at                    timestamptz default now()
);

-- ─── Aliments (dictionnaire + entrées utilisateur non vérifiées) ───────────
create table food_items (
  id                    uuid primary key default uuid_generate_v4(),
  name_standard         text not null,
  display_name          text,
  category              text not null,
  origin_countries      text[] default '{}',
  calories_per_100g     numeric(6,2) not null,
  proteins_100g         numeric(5,2) default 0,
  carbs_100g            numeric(5,2) default 0,
  lipids_100g           numeric(5,2) default 0,
  fiber_per_100g        numeric(5,2) default 0,
  density_g_ml          numeric(6,3) default 1.0,
  default_portion_g     int default 250,
  image_url             text,
  verified              boolean default false,
  user_id               uuid references auth.users(id) on delete cascade,
  created_at            timestamptz default now()
);

create index idx_food_items_verified_user on food_items(verified, user_id);
create index idx_food_items_name_standard on food_items(name_standard);

-- ─── Alias d’aliments (matching IA / recherche) ────────────────────────────
create table food_aliases (
  id            uuid primary key default uuid_generate_v4(),
  alias_name    text not null,
  food_item_id  uuid not null references food_items(id) on delete cascade,
  unique (alias_name, food_item_id)
);

create index idx_food_aliases_alias on food_aliases(alias_name);

-- ─── Apprentissage des détections non résolues (scan) ────────────────────────
create table unknown_logs (
  id                  uuid primary key default uuid_generate_v4(),
  detected_name       text not null,
  calories_per_100g   numeric(6,2) default 0,
  proteins_100g       numeric(5,2) default 0,
  lipids_100g         numeric(5,2) default 0,
  carbs_100g          numeric(5,2) default 0,
  density_g_ml        numeric(6,3) default 1.0,
  occurrence_count    int default 1,
  last_detected_at    timestamptz
);

create index idx_unknown_logs_detected on unknown_logs(detected_name);

-- ─── Repas (journal) ───────────────────────────────────────────────────────
create table meals (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  food_item_id    uuid references food_items(id) on delete set null,
  custom_name     text,
  meal_type       text check (meal_type in ('petit_dejeuner','dejeuner','diner','collation')),
  portion_g       numeric(6,2) not null,
  calories        numeric(7,2) not null,
  protein_g       numeric(6,2) default 0,
  carbs_g         numeric(6,2) default 0,
  fat_g           numeric(6,2) default 0,
  total_calories  numeric(7,2),
  image_url       text,
  ai_confidence   int check (ai_confidence between 0 and 100),
  coach_message   text,
  notes           text,
  logged_at       timestamptz default now(),
  created_at      timestamptz default now()
);

create index idx_meals_user_date on meals(user_id, logged_at desc);
create index idx_meals_user_id on meals(user_id);

-- ─── Historique poids ──────────────────────────────────────────────────────
create table weight_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  weight_kg   numeric(5,2) not null,
  logged_at   timestamptz default now()
);

create index idx_weight_logs_user on weight_logs(user_id, logged_at desc);

-- ─── Planning / engagements (accountability coach) ─────────────────────────
create table user_plans (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  slot         text not null check (slot in ('petit_dejeuner','dejeuner','diner','collation')),
  recipe_name  text not null,
  is_locked    boolean default false,
  created_at   timestamptz default now(),
  unique (user_id, date, slot)
);

create index idx_user_plans_user_date on user_plans(user_id, date);

-- ─── Notifications in-app ────────────────────────────────────────────────────
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text,
  title       text not null,
  message     text,
  link        text,
  created_at  timestamptz default now(),
  read_at     timestamptz
);

create index idx_notifications_user on notifications(user_id, created_at desc);

-- ─── Abonnements push Web (un enregistrement par user dans l’app actuelle) ─
create table push_subscriptions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  subscription  jsonb not null,
  created_at    timestamptz default now()
);

-- ─── Fils de chat coach (persistés par jour) ────────────────────────────────
create table coach_chat_threads (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,
  messages        jsonb not null default '[]',
  messages_used   int default 0,
  max_messages    int,
  updated_at      timestamptz default now(),
  unique (user_id, date)
);

create index idx_coach_threads_user_date on coach_chat_threads(user_id, date);

-- ─── Audit suppressions compte (écrit après suppression auth) ──────────────
create table account_deletions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  email       text,
  reason      text,
  deleted_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════

alter table user_profiles enable row level security;
alter table meals enable row level security;
alter table weight_logs enable row level security;
alter table food_items enable row level security;
alter table food_aliases enable row level security;
alter table unknown_logs enable row level security;
alter table user_plans enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table coach_chat_threads enable row level security;

-- user_profiles
create policy "users_own_profile" on user_profiles
  for all using (auth.uid() = user_id);

-- meals & weight_logs
create policy "users_own_meals" on meals
  for all using (auth.uid() = user_id);
create policy "users_own_weight" on weight_logs
  for all using (auth.uid() = user_id);

-- food_items : lecture des fiches vérifiées + des fiches perso
create policy "food_items_select" on food_items
  for select using (verified = true or auth.uid() = user_id);
create policy "food_items_insert_own" on food_items
  for insert with check (auth.uid() = user_id);
create policy "food_items_update_own" on food_items
  for update using (auth.uid() = user_id);

-- food_aliases : lecture pour utilisateurs authentifiés (ajustable selon ta politique)
create policy "food_aliases_read_auth" on food_aliases
  for select to authenticated using (true);

-- unknown_logs : aucune policy (RLS activé = refus pour JWT ; accès via service role uniquement)

-- user_plans
create policy "users_own_plans" on user_plans
  for all using (auth.uid() = user_id);

-- notifications
create policy "users_own_notifications" on notifications
  for all using (auth.uid() = user_id);

-- push_subscriptions
create policy "users_own_push" on push_subscriptions
  for all using (auth.uid() = user_id);

-- coach_chat_threads
create policy "users_own_coach_threads" on coach_chat_threads
  for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Données initiales (aliments certifiés — colonnes alignées sur l’app)
-- ═══════════════════════════════════════════════════════════════════════════

insert into food_items (
  name_standard, display_name, category, origin_countries,
  calories_per_100g, proteins_100g, carbs_100g, lipids_100g,
  default_portion_g, verified
) values
('fufu_manioc',           'Fufu de manioc',        'tubercules',     '{"CI","GH","TG","BJ","CM"}', 158,  1.2, 38.0,  0.3, 300, true),
('attieke',               'Attiéké',               'cereales',       '{"CI"}',                     167,  1.5, 37.5,  1.2, 200, true),
('igname_pilee',          'Igname pilée',          'tubercules',     '{"GH","TG","BJ","NG"}',      118,  1.5, 27.5,  0.2, 300, true),
('banku',                 'Banku',                 'tubercules',     '{"GH"}',                     162,  2.1, 35.8,  0.8, 300, true),
('to_mil',                'Tô de mil',             'cereales',       '{"BF","ML","NE","TG"}',      144,  4.2, 29.8,  1.4, 300, true),
('riz_gras',              'Riz au gras',           'plats_composes', '{"SN","GH","NG","TG","BJ"}', 185,  5.8, 28.5,  5.6, 350, true),
('thieboudienne',         'Thiéboudienne',         'plats_composes', '{"SN","GM","GW"}',           210, 12.5, 26.8,  6.8, 400, true),
('sauce_arachide',        'Sauce arachide',        'sauces',         '{"SN","ML","GH","CI","TG"}', 285, 10.2, 12.5, 22.8, 150, true),
('sauce_graine',          'Sauce graine',          'sauces',         '{"CI","GH","TG","BJ","CM"}', 320,  5.8, 10.2, 28.5, 150, true),
('sauce_gombo',           'Sauce gombo',           'sauces',         '{"TG","BJ","GH","NG"}',       85,  3.5,  8.2,  4.8, 150, true),
('poulet_braise',         'Poulet braisé',         'viandes',        '{"CI","SN","TG","GH"}',      215, 28.5,  0.0, 11.5, 250, true),
('poisson_braise',        'Poisson braisé',        'poissons',       '{"CI","SN","GH","TG","BJ"}', 185, 26.8,  0.0,  8.5, 200, true),
('alloco',                'Alloco',                'snacks',         '{"CI","GH","TG"}',           220,  1.5, 32.5,  9.8, 150, true),
('akara',                 'Akara',                 'snacks',         '{"SN","NG","GH","TG"}',      265,  8.5, 22.5, 15.8, 100, true),
('bissap',                'Bissap',                'boissons',       '{"SN","ML","GH","TG","BJ"}',  52,  0.5, 12.8,  0.1, 250, true),
('haricots_niebe_cuits',  'Haricots niébé cuits',  'legumineuses',   '{"NG","GH","TG","BJ","SN"}', 118,  7.8, 21.2,  0.5, 200, true),
('arachides_grillees',    'Arachides grillées',    'legumineuses',   '{"TG","SN","ML","GH"}',      567, 25.8, 16.5, 49.2,  30, true);
