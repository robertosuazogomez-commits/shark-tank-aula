-- Persistencia permanente para Shark Tank Aula.
-- Ejecuta esto una sola vez en Supabase > SQL Editor.
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- La aplicación usa SUPABASE_SERVICE_ROLE_KEY en el servidor, por lo que no
-- necesita exponer esta tabla al navegador.
alter table public.app_state enable row level security;
