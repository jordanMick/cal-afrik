-- Alignement essentiel base ↔ app (colonnes attendues par /api/foods, meals, notifications, coach).
-- Idempotent : safe à rejouer sur une base déjà partiellement à jour.

-- ─── food_items : dictionnaire (POST /api/foods, GET liste, analyse IA) ───
alter table public.food_items
  add column if not exists category text not null default 'plats_composes',
  add column if not exists origin_countries text[] not null default '{}',
  add column if not exists fiber_per_100g numeric(5,2) not null default 0,
  add column if not exists default_portion_g integer not null default 250,
  add column if not exists image_url text;

comment on column public.food_items.category is 'Catégorie UI / filtrage (ex. plats_composes, snacks)';
comment on column public.food_items.origin_countries is 'Codes pays ISO associés à l''aliment';
comment on column public.food_items.default_portion_g is 'Portion par défaut (g) pour calcul macros depuis /100g';

-- ─── meals : lien optionnel vers la fiche aliment ───
alter table public.meals
  add column if not exists food_item_id uuid references public.food_items(id) on delete set null;

create index if not exists idx_meals_food_item_id on public.meals(food_item_id)
  where food_item_id is not null;

-- ─── notifications : lien in-app (NotificationCenter) ───
alter table public.notifications
  add column if not exists link text;

-- ─── coach_chat_threads.date : passer text → date si encore en text ───
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coach_chat_threads'
      and column_name = 'date'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.coach_chat_threads
      alter column "date" type date using (nullif(trim("date"::text), '')::date);
  end if;
end $$;
