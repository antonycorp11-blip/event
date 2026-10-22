-- INSCRIÇÕES URGENTES — execute TODO este texto no SQL Editor.
-- Não exige e-mail ou usuário administrador.
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), name text not null,
  date text, location text, price numeric(10,2) default 0,
  active boolean default true, created_at timestamptz not null default now()
);
create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.disciplers (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.leaders (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  event_name text not null, name text not null, birth_date date not null,
  network text not null, leader text, discipler text not null,
  payment_method text not null, payment_status text default 'Pendente',
  phone text, created_at timestamptz not null default now()
);
create table if not exists public.bootstrap_codes (
  id boolean primary key default true check (id), code text not null
);
insert into public.bootstrap_codes(id, code)
values (true, encode(gen_random_bytes(18), 'hex')) on conflict do nothing;

alter table public.events add column if not exists share_token uuid unique default gen_random_uuid();
alter table public.events alter column share_token set default gen_random_uuid();
update public.events set share_token = gen_random_uuid() where share_token is null;
alter table public.events alter column share_token set not null;
create unique index if not exists idx_events_share_token on public.events(share_token);

alter table public.events enable row level security;
alter table public.networks enable row level security;
alter table public.disciplers enable row level security;
alter table public.leaders enable row level security;
alter table public.registrations enable row level security;
alter table public.bootstrap_codes enable row level security;

do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('events','networks','disciplers','leaders','registrations','bootstrap_codes')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
revoke all on public.events, public.networks, public.disciplers,
  public.leaders, public.registrations, public.bootstrap_codes from anon;

create or replace function public.get_shared_event(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare e public.events;
begin
  select * into e from public.events where share_token = p_token and active = true;
  if not found then return null; end if;
  return jsonb_build_object(
    'event', jsonb_build_object('id',e.id,'name',e.name,'date',e.date,'location',e.location,'price',e.price),
    'networks', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.networks),
    'disciplers', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.disciplers),
    'leaders', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.leaders)
  );
end $$;
revoke all on function public.get_shared_event(uuid) from public;
grant execute on function public.get_shared_event(uuid) to anon, authenticated;

create or replace function public.create_event_with_setup_code(
  p_code text, p_name text, p_price numeric, p_date text, p_location text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.events;
begin
  if not exists (select 1 from public.bootstrap_codes where code = p_code) then
    raise exception 'Código inicial inválido';
  end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name)) > 150 then raise exception 'Nome inválido'; end if;
  if p_price is null or p_price < 0 or p_price > 99999999 then raise exception 'Valor inválido'; end if;
  if length(coalesce(p_date,'')) > 150 or length(coalesce(p_location,'')) > 200 then raise exception 'Data ou local muito longo'; end if;
  insert into public.events(name,price,date,location,active)
  values (trim(p_name),p_price,nullif(trim(p_date),''),nullif(trim(p_location),''),true)
  returning * into e;
  return jsonb_build_object('id',e.id,'name',e.name,'share_token',e.share_token);
end $$;
revoke all on function public.create_event_with_setup_code(text,text,numeric,text,text) from public;
grant execute on function public.create_event_with_setup_code(text,text,numeric,text,text) to anon, authenticated;

create or replace function public.register_for_event(
  p_token uuid, p_name text, p_birth_date date, p_network text,
  p_discipler text, p_leader text, p_payment_method text, p_phone text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare e public.events; new_id uuid;
begin
  select * into e from public.events where share_token = p_token and active = true;
  if not found then raise exception 'Link inválido ou encerrado'; end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name)) > 150 then raise exception 'Nome inválido'; end if;
  if p_birth_date is null or p_birth_date > current_date or p_birth_date < date '1900-01-01' then raise exception 'Nascimento inválido'; end if;
  if nullif(trim(p_network),'') is null or length(trim(p_network)) > 100 then raise exception 'Rede inválida'; end if;
  if nullif(trim(p_discipler),'') is null or length(trim(p_discipler)) > 100 then raise exception 'Discipulador inválido'; end if;
  if exists (select 1 from public.networks) and not exists (select 1 from public.networks where name = p_network) then raise exception 'Rede inválida'; end if;
  if exists (select 1 from public.disciplers) and not exists (select 1 from public.disciplers where name = p_discipler) then raise exception 'Discipulador inválido'; end if;
  if length(coalesce(p_leader,'')) > 150 or length(coalesce(p_phone,'')) > 30 then raise exception 'Campo muito longo'; end if;
  if p_payment_method not in ('PIX','Cartão de Crédito','Cartão de Débito','Dinheiro') then raise exception 'Pagamento inválido'; end if;
  insert into public.registrations(event_id,event_name,name,birth_date,network,discipler,leader,payment_method,payment_status,phone)
  values (e.id,e.name,trim(p_name),p_birth_date,trim(p_network),trim(p_discipler),coalesce(trim(p_leader),''),p_payment_method,'Pendente',coalesce(trim(p_phone),''))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.register_for_event(uuid,text,date,text,text,text,text,text) from public;
grant execute on function public.register_for_event(uuid,text,date,text,text,text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';
select code as codigo_inicial from public.bootstrap_codes;
