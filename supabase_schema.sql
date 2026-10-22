-- Execute no SQL Editor do projeto Supabase correto. Pode ser repetido.
-- Atenção: esta migração substitui as políticas das tabelas do aplicativo.
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date text,
  location text,
  price numeric(10,2) default 0,
  active boolean default true,
  created_at timestamptz not null default now()
);
create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.disciplers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.leaders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  event_name text not null,
  name text not null,
  birth_date date not null,
  network text not null,
  leader text,
  discipler text not null,
  payment_method text not null,
  payment_status text default 'Pendente',
  phone text,
  created_at timestamptz not null default now()
);
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.bootstrap_codes (
  id boolean primary key default true check (id),
  code text not null
);
insert into public.bootstrap_codes(id, code)
values (true, encode(gen_random_bytes(18), 'hex'))
on conflict do nothing;
alter table public.events add column if not exists share_token uuid unique default gen_random_uuid();
alter table public.events alter column share_token set default gen_random_uuid();
update public.events set share_token = gen_random_uuid() where share_token is null;
alter table public.events alter column share_token set not null;
create unique index if not exists idx_events_share_token on public.events(share_token);

create index if not exists idx_registrations_event_id on public.registrations(event_id);
create index if not exists idx_registrations_network on public.registrations(network);
create index if not exists idx_registrations_discipler on public.registrations(discipler);
create index if not exists idx_registrations_leader on public.registrations(leader);

alter table public.events enable row level security;
alter table public.networks enable row level security;
alter table public.disciplers enable row level security;
alter table public.leaders enable row level security;
alter table public.registrations enable row level security;
alter table public.admins enable row level security;
alter table public.bootstrap_codes enable row level security;

-- Remove the project's old USING (true) policies, including any policy left on these tables.
do $$
declare policy_row record;
begin
  for policy_row in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('events', 'networks', 'disciplers', 'leaders', 'registrations', 'admins', 'bootstrap_codes')
  loop
    execute format('drop policy %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy admin_events on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_networks on public.networks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_disciplers on public.disciplers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_leaders on public.leaders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_registrations on public.registrations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_users on public.admins for select to authenticated using (user_id = auth.uid());

revoke all on public.events, public.networks, public.disciplers, public.leaders, public.registrations, public.admins from anon;
revoke all on public.bootstrap_codes from anon, authenticated;
grant select, insert, update, delete on public.events, public.networks, public.disciplers, public.leaders, public.registrations to authenticated;
grant select on public.admins to authenticated;

create or replace function public.claim_first_admin(p_code text) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Faça login antes de ativar a administração'; end if;
  perform pg_catalog.pg_advisory_xact_lock(82472561);
  if exists (select 1 from public.admins) then raise exception 'A administração já foi ativada'; end if;
  if not exists (select 1 from public.bootstrap_codes where code = p_code) then raise exception 'Código inicial inválido'; end if;
  insert into public.admins(user_id) values (auth.uid());
  delete from public.bootstrap_codes;
  return true;
end $$;
revoke all on function public.claim_first_admin(text) from public, anon;
grant execute on function public.claim_first_admin(text) to authenticated;

-- Permite criar eventos antes do cadastro da equipe, usando apenas o código
-- inicial exibido no fim deste script. O código deixa de valer ao ativar o admin.
create or replace function public.create_event_with_setup_code(
  p_code text, p_name text, p_price numeric, p_date text, p_location text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare created public.events;
begin
  if not exists (select 1 from public.bootstrap_codes where code = p_code) then
    raise exception 'Código inicial inválido ou já utilizado';
  end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name)) > 150 then
    raise exception 'Nome do evento inválido';
  end if;
  if p_price is null or p_price < 0 or p_price > 99999999 then
    raise exception 'Valor inválido';
  end if;
  if length(coalesce(p_date,'')) > 150 or length(coalesce(p_location,'')) > 200 then
    raise exception 'Data ou local muito longo';
  end if;
  insert into public.events(name,price,date,location,active)
  values (trim(p_name),p_price,nullif(trim(p_date),''),nullif(trim(p_location),''),true)
  returning * into created;
  return jsonb_build_object('id',created.id,'name',created.name,'share_token',created.share_token);
end $$;
revoke all on function public.create_event_with_setup_code(text,text,numeric,text,text) from public;
grant execute on function public.create_event_with_setup_code(text,text,numeric,text,text) to anon, authenticated;

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

create or replace function public.register_for_event(
  p_token uuid, p_name text, p_birth_date date, p_network text,
  p_discipler text, p_leader text, p_payment_method text, p_phone text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare e public.events; new_id uuid;
begin
  select * into e from public.events where share_token = p_token and active = true;
  if not found then raise exception 'Link de evento inválido ou encerrado'; end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name)) > 150 then raise exception 'Nome inválido'; end if;
  if p_birth_date is null or p_birth_date > current_date or p_birth_date < date '1900-01-01' then raise exception 'Data de nascimento inválida'; end if;
  if nullif(trim(p_network),'') is null or length(trim(p_network)) > 100 then raise exception 'Rede inválida'; end if;
  if nullif(trim(p_discipler),'') is null or length(trim(p_discipler)) > 100 then raise exception 'Discipulador inválido'; end if;
  if exists (select 1 from public.networks) and not exists (select 1 from public.networks where name = p_network) then raise exception 'Rede inválida'; end if;
  if exists (select 1 from public.disciplers) and not exists (select 1 from public.disciplers where name = p_discipler) then raise exception 'Discipulador inválido'; end if;
  if nullif(trim(p_leader),'') is not null and length(trim(p_leader)) > 150 then raise exception 'Líder inválido'; end if;
  if p_payment_method not in ('PIX','Cartão de Crédito','Cartão de Débito','Dinheiro') then raise exception 'Forma de pagamento inválida'; end if;
  if length(coalesce(p_phone,'')) > 30 then raise exception 'Telefone inválido'; end if;
  insert into public.registrations(event_id,event_name,name,birth_date,network,discipler,leader,payment_method,payment_status,phone)
  values (e.id,e.name,trim(p_name),p_birth_date,p_network,p_discipler,coalesce(trim(p_leader),''),p_payment_method,'Pendente',coalesce(trim(p_phone),''))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.register_for_event(uuid,text,date,text,text,text,text,text) from public;
grant execute on function public.register_for_event(uuid,text,date,text,text,text,text,text) to anon, authenticated;
notify pgrst, 'reload schema';

-- LOTES DE INGRESSOS (mesma migração de supabase_lotes.sql)
-- Execute uma vez no SQL Editor do mesmo projeto Supabase do aplicativo.
-- Mantém eventos e inscrições existentes. Os lotes são vendidos em ordem.

begin;

create table if not exists public.ticket_lots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  quantity integer not null check (quantity between 1 and 1000000),
  sold integer not null default 0 check (sold >= 0 and sold <= quantity),
  price numeric(10,2) not null check (price >= 0),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ticket_lots_event_order on public.ticket_lots(event_id, position, created_at);
alter table public.ticket_lots enable row level security;
revoke all on public.ticket_lots from anon, authenticated;

alter table public.registrations add column if not exists ticket_lot_id uuid references public.ticket_lots(id) on delete set null;
alter table public.registrations add column if not exists ticket_lot_name text;
alter table public.registrations add column if not exists ticket_price numeric(10,2);

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
    'leaders', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.leaders),
    'has_ticket_lots', exists (select 1 from public.ticket_lots where event_id = e.id),
    'ticket_lots', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'quantity', quantity, 'sold', sold,
      'remaining', quantity - sold, 'price', price, 'position', position
    ) order by position, created_at), '[]'::jsonb)
      from public.ticket_lots where event_id = e.id and active = true)
  );
end $$;
revoke all on function public.get_shared_event(uuid) from public;
grant execute on function public.get_shared_event(uuid) to anon, authenticated;

create or replace function public.create_event_with_lots(
  p_code text, p_name text, p_price numeric, p_date text, p_location text, p_lots jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare created jsonb; lot jsonb; lot_name text; lot_quantity integer; lot_price numeric; lot_index integer := 0;
begin
  if jsonb_typeof(p_lots) is distinct from 'array' or jsonb_array_length(p_lots) not between 1 and 20 then
    raise exception 'Informe de 1 a 20 lotes';
  end if;
  -- A chamada existente confere o código e cria o evento na mesma transação.
  created := public.create_event_with_setup_code(p_code, p_name, p_price, p_date, p_location);
  for lot in select value from jsonb_array_elements(p_lots) loop
    lot_name := trim(coalesce(lot->>'name',''));
    if length(lot_name) not between 1 and 80 then raise exception 'Nome do lote inválido'; end if;
    if coalesce(lot->>'quantity','') !~ '^[0-9]{1,7}$' then raise exception 'Quantidade do lote inválida'; end if;
    lot_quantity := (lot->>'quantity')::integer;
    if lot_quantity not between 1 and 1000000 then raise exception 'Quantidade do lote inválida'; end if;
    if coalesce(lot->>'price','') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' then raise exception 'Valor do lote inválido'; end if;
    lot_price := (lot->>'price')::numeric;
    if lot_price > 99999999 then raise exception 'Valor do lote inválido'; end if;
    insert into public.ticket_lots(event_id,name,quantity,price,position)
    values ((created->>'id')::uuid,lot_name,lot_quantity,lot_price,lot_index);
    lot_index := lot_index + 1;
  end loop;
  return created;
end $$;
revoke all on function public.create_event_with_lots(text,text,numeric,text,text,jsonb) from public;
grant execute on function public.create_event_with_lots(text,text,numeric,text,text,jsonb) to anon, authenticated;

create or replace function public.save_event_lots_with_setup_code(
  p_code text, p_token uuid, p_lots jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.events; lot jsonb; lot_id uuid; lot_name text; lot_quantity integer;
        lot_price numeric; lot_index integer := 0; submitted_ids uuid[] := array[]::uuid[];
begin
  if not exists (select 1 from public.bootstrap_codes where code = p_code) then
    raise exception 'Código inicial inválido';
  end if;
  select * into e from public.events where share_token = p_token and active = true for update;
  if not found then raise exception 'Evento não encontrado'; end if;
  if jsonb_typeof(p_lots) is distinct from 'array' or jsonb_array_length(p_lots) not between 1 and 20 then
    raise exception 'Informe de 1 a 20 lotes';
  end if;
  for lot in select value from jsonb_array_elements(p_lots) loop
    lot_name := trim(coalesce(lot->>'name',''));
    if length(lot_name) not between 1 and 80 then raise exception 'Nome do lote inválido'; end if;
    if coalesce(lot->>'quantity','') !~ '^[0-9]{1,7}$' then raise exception 'Quantidade do lote inválida'; end if;
    lot_quantity := (lot->>'quantity')::integer;
    if lot_quantity not between 1 and 1000000 then raise exception 'Quantidade do lote inválida'; end if;
    if coalesce(lot->>'price','') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' then raise exception 'Valor do lote inválido'; end if;
    lot_price := (lot->>'price')::numeric;
    if lot_price > 99999999 then raise exception 'Valor do lote inválido'; end if;
    lot_id := nullif(lot->>'id','')::uuid;
    if lot_id is null then
      insert into public.ticket_lots(event_id,name,quantity,price,position)
      values (e.id,lot_name,lot_quantity,lot_price,lot_index) returning id into lot_id;
    else
      update public.ticket_lots
      set name = lot_name, quantity = lot_quantity, price = lot_price,
          position = lot_index, active = true
      where id = lot_id and event_id = e.id and sold <= lot_quantity;
      if not found then raise exception 'Lote inválido ou quantidade abaixo das inscrições existentes'; end if;
    end if;
    submitted_ids := array_append(submitted_ids, lot_id);
    lot_index := lot_index + 1;
  end loop;
  update public.ticket_lots set active = false
  where event_id = e.id and not (id = any(submitted_ids));
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'quantity',quantity,'sold',sold,'price',price,'position',position
  ) order by position), '[]'::jsonb) from public.ticket_lots where event_id=e.id and active=true);
end $$;
revoke all on function public.save_event_lots_with_setup_code(text,uuid,jsonb) from public;
grant execute on function public.save_event_lots_with_setup_code(text,uuid,jsonb) to anon, authenticated;

create or replace function public.register_for_event(
  p_token uuid, p_name text, p_birth_date date, p_network text,
  p_discipler text, p_leader text, p_payment_method text, p_phone text,
  p_lot_id uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare e public.events; current_lot public.ticket_lots; new_id uuid;
begin
  -- A linha do evento serializa inscrições simultâneas e impede exceder o estoque.
  select * into e from public.events where share_token = p_token and active = true for update;
  if not found then raise exception 'Link inválido ou encerrado'; end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name)) > 150 then raise exception 'Nome inválido'; end if;
  if p_birth_date is null or p_birth_date > current_date or p_birth_date < date '1900-01-01' then raise exception 'Nascimento inválido'; end if;
  if nullif(trim(p_network),'') is null or length(trim(p_network)) > 100 then raise exception 'Rede inválida'; end if;
  if nullif(trim(p_discipler),'') is null or length(trim(p_discipler)) > 100 then raise exception 'Discipulador inválido'; end if;
  if exists (select 1 from public.networks) and not exists (select 1 from public.networks where name = p_network) then raise exception 'Rede inválida'; end if;
  if exists (select 1 from public.disciplers) and not exists (select 1 from public.disciplers where name = p_discipler) then raise exception 'Discipulador inválido'; end if;
  if length(coalesce(p_leader,'')) > 150 or length(coalesce(p_phone,'')) > 30 then raise exception 'Campo muito longo'; end if;
  if p_payment_method not in ('PIX','Cartão de Crédito','Cartão de Débito','Dinheiro') then raise exception 'Pagamento inválido'; end if;
  if exists (select 1 from public.ticket_lots where event_id = e.id) then
    select * into current_lot from public.ticket_lots
    where event_id = e.id and active = true and sold < quantity
    order by position, created_at limit 1 for update;
    if not found then raise exception 'Ingressos esgotados'; end if;
    if p_lot_id is distinct from current_lot.id then raise exception 'O lote mudou. Atualize a página antes de concluir.'; end if;
    update public.ticket_lots set sold = sold + 1 where id = current_lot.id;
  elsif p_lot_id is not null then
    raise exception 'Lote inválido';
  end if;
  insert into public.registrations(event_id,event_name,name,birth_date,network,discipler,leader,
    payment_method,payment_status,phone,ticket_lot_id,ticket_lot_name,ticket_price)
  values (e.id,e.name,trim(p_name),p_birth_date,trim(p_network),trim(p_discipler),
    coalesce(trim(p_leader),''),p_payment_method,'Pendente',coalesce(trim(p_phone),''),
    current_lot.id,current_lot.name,coalesce(current_lot.price,e.price))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.register_for_event(uuid,text,date,text,text,text,text,text,uuid) from public;
grant execute on function public.register_for_event(uuid,text,date,text,text,text,text,text,uuid) to anon, authenticated;

-- Clientes antigos também passam pela reserva de estoque e não conseguem ignorar os lotes.
create or replace function public.register_for_event(
  p_token uuid, p_name text, p_birth_date date, p_network text,
  p_discipler text, p_leader text, p_payment_method text, p_phone text
) returns uuid
language sql security definer set search_path = ''
as $$
  select public.register_for_event(p_token,p_name,p_birth_date,p_network,
    p_discipler,p_leader,p_payment_method,p_phone,null::uuid)
$$;
revoke all on function public.register_for_event(uuid,text,date,text,text,text,text,text) from public;
grant execute on function public.register_for_event(uuid,text,date,text,text,text,text,text) to anon, authenticated;

create or replace function public.release_ticket_after_registration_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.ticket_lot_id is not null then
    update public.ticket_lots set sold = greatest(sold - 1, 0) where id = old.ticket_lot_id;
  end if;
  return old;
end $$;
drop trigger if exists registration_releases_ticket on public.registrations;
create trigger registration_releases_ticket after delete on public.registrations
for each row execute function public.release_ticket_after_registration_delete();

notify pgrst, 'reload schema';
commit;

-- FOTO HORIZONTAL DO EVENTO
-- Foto horizontal do evento. Execute uma vez no SQL Editor do mesmo projeto.
-- Mantém eventos, lotes e inscrições existentes.
begin;

alter table public.events add column if not exists banner_data text;

create or replace function public.get_event_banner(p_token uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select banner_data from public.events
  where share_token = p_token and active = true
$$;
revoke all on function public.get_event_banner(uuid) from public;
grant execute on function public.get_event_banner(uuid) to anon, authenticated;

create or replace function public.save_event_banner_with_setup_code(
  p_code text, p_token uuid, p_banner_data text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.bootstrap_codes where code = p_code) then
    raise exception 'Código inicial inválido';
  end if;
  if p_banner_data is not null and p_banner_data <> '' and
     (length(p_banner_data) > 450000 or
      p_banner_data !~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/=]+$') then
    raise exception 'Foto inválida ou muito grande';
  end if;
  update public.events set banner_data = nullif(p_banner_data, '')
  where share_token = p_token and active = true;
  if not found then raise exception 'Evento não encontrado'; end if;
  return true;
end $$;
revoke all on function public.save_event_banner_with_setup_code(text,uuid,text) from public;
grant execute on function public.save_event_banner_with_setup_code(text,uuid,text) to anon, authenticated;

create or replace function public.create_event_with_banner(
  p_code text, p_name text, p_price numeric, p_date text, p_location text,
  p_banner_data text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare created jsonb;
begin
  created := public.create_event_with_setup_code(p_code,p_name,p_price,p_date,p_location);
  perform public.save_event_banner_with_setup_code(p_code,(created->>'share_token')::uuid,p_banner_data);
  return created;
end $$;
revoke all on function public.create_event_with_banner(text,text,numeric,text,text,text) from public;
grant execute on function public.create_event_with_banner(text,text,numeric,text,text,text) to anon, authenticated;

create or replace function public.create_event_with_lots_and_banner(
  p_code text, p_name text, p_price numeric, p_date text, p_location text,
  p_lots jsonb, p_banner_data text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare created jsonb;
begin
  created := public.create_event_with_lots(p_code,p_name,p_price,p_date,p_location,p_lots);
  perform public.save_event_banner_with_setup_code(p_code,(created->>'share_token')::uuid,p_banner_data);
  return created;
end $$;
revoke all on function public.create_event_with_lots_and_banner(text,text,numeric,text,text,jsonb,text) from public;
grant execute on function public.create_event_with_lots_and_banner(text,text,numeric,text,text,jsonb,text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- O resultado abaixo é o código inicial para cadastrar o PRIMEIRO administrador
-- na própria interface do aplicativo. Guarde-o até concluir o cadastro.
select code as codigo_inicial from public.bootstrap_codes;
