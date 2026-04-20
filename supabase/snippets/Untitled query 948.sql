-- 1. Użytkownicy - Supabase ma wbudowany auth.users, ale dorzucimy profil
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company text,
  created_at timestamptz default now()
);

-- 2. Audyty BHP
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  image_url text,
  norm text default 'PN-ISO 45001:2018',
  compliance_score int,
  status text, -- Zgodne | Częściowo zgodne | Niezgodne
  risk_level text, -- niskie | średnie | wysokie | krytyczne
  hazards jsonb,
  non_compliances jsonb,
  recommendations jsonb,
  iso_clauses jsonb
);

-- 3. Błędy BHP - słownik typowych niezgodności
create table public.bhp_errors (
  id uuid primary key default gen_random_uuid(),
  code text unique, -- np. BHP-001
  title text,
  description text,
  norm_clause text, -- np. ISO 45001:2018 8.1.2
  severity text,
  category text -- Ochrony osobiste | Maszyny | Organizacja | etc
);

-- 4. Ustawienia użytkownika
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_norm text default 'PN-ISO 45001:2018',
  notifications_enabled boolean default true,
  theme text default 'dark'
);

-- RLS - żeby user widział tylko swoje
alter table profiles enable row level security;
alter table audits enable row level security;
alter table user_settings enable row level security;

create policy "Users see own profile" on profiles for all using (auth.uid() = id);
create policy "Users see own audits" on audits for all using (auth.uid() = user_id);
create policy "Users see own settings" on user_settings for all using (auth.uid() = user_id);
create policy "Everyone can read bhp_errors" on bhp_errors for select using (true);