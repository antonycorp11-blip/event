-- VÁRIAS IGREJAS (ORGANIZAÇÕES) NO MESMO SISTEMA
-- Cada igreja/rede só enxerga os próprios eventos, inscritos e listas.
-- O dono do sistema (super admin) cria os acessos dos pastores.
-- Execute depois de supabase_pix.sql. Pode ser repetido. Os dados atuais viram
-- a primeira organização e o administrador atual vira o dono do sistema.
begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  infinitepay_handle text,
  customer_email text,
  pix_minutes integer not null default 60 check (pix_minutes between 10 and 1440),
  pix_key text,
  receipt_whatsapp text,
  access_until date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Um login pertence a uma única organização.
create table if not exists public.org_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.super_admins enable row level security;
revoke all on public.organizations, public.org_members, public.super_admins from anon;
revoke all on public.org_members, public.super_admins from authenticated;
grant select on public.organizations to authenticated;

-- Organização do login atual, só enquanto o acesso estiver valendo.
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.org_id from public.org_members m join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid() and o.active and (o.access_until is null or o.access_until >= current_date)
$$;
revoke all on function public.current_org_id() from public, anon;
grant execute on function public.current_org_id() to authenticated;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.super_admins where user_id = auth.uid()) $$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- Administrador = membro de uma organização com acesso válido.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_org_id() is not null $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select to authenticated
  using (id = public.current_org_id() or public.is_super_admin());

-- Dados atuais -> primeira organização; administrador atual -> dono do sistema.
do $$
declare first_org uuid;
begin
  select id into first_org from public.organizations order by created_at limit 1;
  if first_org is null then
    insert into public.organizations(name, infinitepay_handle, customer_email, pix_minutes, pix_key, receipt_whatsapp)
    select 'Minha igreja', s.infinitepay_handle, s.customer_email, s.pix_minutes, '05902198127', '5565992786131'
    from public.payment_settings s where s.id
    returning id into first_org;
    if first_org is null then
      insert into public.organizations(name, pix_key, receipt_whatsapp)
      values ('Minha igreja', '05902198127', '5565992786131') returning id into first_org;
    end if;
    insert into public.org_members(user_id, org_id) select user_id, first_org from public.admins on conflict do nothing;
    insert into public.super_admins(user_id) select user_id from public.admins on conflict do nothing;
  end if;

  alter table public.events add column if not exists org_id uuid references public.organizations(id) on delete cascade;
  alter table public.networks add column if not exists org_id uuid references public.organizations(id) on delete cascade;
  alter table public.disciplers add column if not exists org_id uuid references public.organizations(id) on delete cascade;
  alter table public.leaders add column if not exists org_id uuid references public.organizations(id) on delete cascade;
  alter table public.registrations add column if not exists org_id uuid references public.organizations(id) on delete cascade;
  update public.events set org_id = first_org where org_id is null;
  update public.networks set org_id = first_org where org_id is null;
  update public.disciplers set org_id = first_org where org_id is null;
  update public.leaders set org_id = first_org where org_id is null;
  update public.registrations r set org_id = coalesce(e.org_id, first_org)
  from public.events e where r.org_id is null and e.id = r.event_id;
  update public.registrations set org_id = first_org where org_id is null;
end $$;

-- Novos registros entram na organização de quem está logado.
alter table public.events alter column org_id set default public.current_org_id();
alter table public.networks alter column org_id set default public.current_org_id();
alter table public.disciplers alter column org_id set default public.current_org_id();
alter table public.leaders alter column org_id set default public.current_org_id();
alter table public.registrations alter column org_id set default public.current_org_id();
alter table public.events alter column org_id set not null;
alter table public.networks alter column org_id set not null;
alter table public.disciplers alter column org_id set not null;
alter table public.leaders alter column org_id set not null;

-- Inscrição herda sempre a organização do evento (inclusive as feitas pelo link público).
create or replace function public.registration_org_from_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.event_id is not null then
    select org_id into new.org_id from public.events where id = new.event_id;
  end if;
  if new.org_id is null then raise exception 'Inscrição sem organização'; end if;
  return new;
end $$;
drop trigger if exists registration_org on public.registrations;
create trigger registration_org before insert or update of event_id on public.registrations
for each row execute function public.registration_org_from_event();
alter table public.registrations alter column org_id set not null;

create index if not exists events_org on public.events(org_id);
create index if not exists registrations_org on public.registrations(org_id);

-- Nomes de rede/discipulador/líder são únicos dentro de cada organização.
alter table public.networks drop constraint if exists networks_name_key;
alter table public.disciplers drop constraint if exists disciplers_name_key;
alter table public.leaders drop constraint if exists leaders_name_key;
create unique index if not exists networks_org_name on public.networks(org_id, name);
create unique index if not exists disciplers_org_name on public.disciplers(org_id, name);
create unique index if not exists leaders_org_name on public.leaders(org_id, name);

-- Cada organização só lê e altera o que é dela.
do $$
declare t text;
begin
  foreach t in array array['events', 'networks', 'disciplers', 'leaders', 'registrations'] loop
    execute format('drop policy if exists admin_full_access on public.%I', t);
    execute format('drop policy if exists admin_%s on public.%I', t, t);
    execute format('drop policy if exists org_access on public.%I', t);
    execute format('create policy org_access on public.%I for all to authenticated using (org_id = public.current_org_id()) with check (org_id = public.current_org_id())', t);
  end loop;
end $$;
drop policy if exists admin_read_lots on public.ticket_lots;
create policy admin_read_lots on public.ticket_lots for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.org_id = public.current_org_id()));

-- Ninguém mais "reivindica" a administração: os acessos são criados pelo dono.
create or replace function public.claim_first_admin(p_code text default '') returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Este e-mail não tem acesso ao painel'; end if;
  return true;
end $$;

-- Situação do login atual para a tela: organização, validade e se é o dono.
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'super', public.is_super_admin(),
    'org_id', o.id, 'org_name', o.name, 'access_until', o.access_until,
    'blocked', o.id is not null and (not o.active or (o.access_until is not null and o.access_until < current_date)),
    'pix_key', o.pix_key, 'receipt_whatsapp', o.receipt_whatsapp,
    'auto_payment', nullif(trim(coalesce(o.infinitepay_handle, '')), '') is not null)
  from (select 1) one
  left join public.org_members m on m.user_id = auth.uid()
  left join public.organizations o on o.id = m.org_id
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- Criar evento: só administrador com acesso válido; o evento nasce na organização dele.
create or replace function public.create_event_with_setup_code(p_code text, p_name text, p_price numeric, p_date text, p_location text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.events;
begin
  if not public.is_admin() then raise exception 'Entre como administrador'; end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name)) > 150 then raise exception 'Nome inválido'; end if;
  if p_price is null or p_price < 0 or p_price > 99999999 then raise exception 'Valor inválido'; end if;
  if length(coalesce(p_date,'')) > 150 or length(coalesce(p_location,'')) > 200 then raise exception 'Data ou local muito longo'; end if;
  insert into public.events(name,price,date,location,active,org_id)
  values (trim(p_name),p_price,nullif(trim(p_date),''),nullif(trim(p_location),''),true,public.current_org_id())
  returning * into e;
  return jsonb_build_object('id',e.id,'name',e.name,'share_token',e.share_token);
end $$;
revoke all on function public.create_event_with_setup_code(text,text,numeric,text,text) from public, anon;
grant execute on function public.create_event_with_setup_code(text,text,numeric,text,text) to authenticated;

-- Lotes e foto: só do evento da própria organização.
create or replace function public.save_event_lots_with_setup_code(p_code text, p_token uuid, p_lots jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.events; lot jsonb; lot_id uuid; lot_name text; lot_quantity integer;
        lot_price numeric; lot_index integer := 0; submitted_ids uuid[] := array[]::uuid[];
begin
  if not public.is_admin() then raise exception 'Entre como administrador'; end if;
  select * into e from public.events where share_token = p_token and active = true
    and org_id = public.current_org_id() for update;
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
      set name = lot_name, quantity = lot_quantity, price = lot_price, position = lot_index, active = true
      where id = lot_id and event_id = e.id and sold <= lot_quantity;
      if not found then raise exception 'Lote inválido ou quantidade abaixo das inscrições existentes'; end if;
    end if;
    submitted_ids := array_append(submitted_ids, lot_id);
    lot_index := lot_index + 1;
  end loop;
  update public.ticket_lots set active = false where event_id = e.id and not (id = any(submitted_ids));
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'quantity',quantity,'sold',sold,'price',price,'position',position
  ) order by position), '[]'::jsonb) from public.ticket_lots where event_id=e.id and active=true);
end $$;

create or replace function public.save_event_banner_with_setup_code(p_code text, p_token uuid, p_banner_data text) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Entre como administrador'; end if;
  if p_banner_data is not null and p_banner_data <> '' and
     (length(p_banner_data) > 450000 or p_banner_data !~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/=]+$') then
    raise exception 'Foto inválida ou muito grande';
  end if;
  update public.events set banner_data = nullif(p_banner_data, '')
  where share_token = p_token and active = true and org_id = public.current_org_id();
  if not found then raise exception 'Evento não encontrado'; end if;
  return true;
end $$;

-- Link público: listas e dados de pagamento da organização dona do evento.
create or replace function public.get_shared_event(p_token uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.events; o public.organizations;
begin
  select * into e from public.events where share_token = p_token and active = true;
  if not found then return null; end if;
  select * into o from public.organizations where id = e.org_id;
  perform public.expire_unpaid_pix(e.id);
  return jsonb_build_object(
    'event', jsonb_build_object('id',e.id,'name',e.name,'date',e.date,'location',e.location,'price',e.price),
    'organization', jsonb_build_object('name', o.name, 'pix_key', o.pix_key, 'receipt_whatsapp', o.receipt_whatsapp),
    'networks', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.networks where org_id = e.org_id),
    'disciplers', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.disciplers where org_id = e.org_id),
    'leaders', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.leaders where org_id = e.org_id),
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
  if exists (select 1 from public.networks where org_id = e.org_id)
     and not exists (select 1 from public.networks where org_id = e.org_id and name = p_network) then raise exception 'Rede inválida'; end if;
  if exists (select 1 from public.disciplers where org_id = e.org_id)
     and not exists (select 1 from public.disciplers where org_id = e.org_id and name = p_discipler) then raise exception 'Discipulador inválido'; end if;
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

create or replace function public.register_for_event_public(
  p_token uuid, p_name text, p_birth_date date, p_network text,
  p_discipler text, p_leader text, p_payment_method text, p_phone text,
  p_lot_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_event_id uuid; new_id uuid; reg public.registrations;
begin
  select id into v_event_id from public.events where share_token = p_token and active = true;
  if found then perform public.expire_unpaid_pix(v_event_id); end if;
  new_id := public.register_for_event(p_token,p_name,p_birth_date,p_network,
    p_discipler,p_leader,p_payment_method,p_phone,p_lot_id);
  update public.registrations set payment_status = 'Confirmado'
  where id = new_id and coalesce(ticket_price, 0) = 0;
  -- Com o Pix automático da organização ligado, o prazo para pagar conta desde a inscrição.
  update public.registrations r set pix_expires_at = now() + make_interval(mins => o.pix_minutes)
  from public.organizations o
  where r.id = new_id and o.id = r.org_id and r.payment_method = 'PIX' and coalesce(r.ticket_price, 0) > 0
    and nullif(trim(coalesce(o.infinitepay_handle, '')), '') is not null;
  select * into reg from public.registrations where id = new_id;
  return jsonb_build_object('id', reg.id, 'access_token', reg.access_token);
end $$;

-- O link de pagamento antigo (uma inscrição por vez) foi substituído pelo de grupo.
drop function if exists public.start_registration_payment(uuid, text);

create or replace function public.start_group_payment(p_access_tokens uuid[], p_origin text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.organizations; first_reg public.registrations; e public.events;
        group_id uuid := gen_random_uuid(); items jsonb; total integer; link jsonb;
        checkout_url text; expires timestamptz; phone_digits text; reg_count integer; ids uuid[];
begin
  if coalesce(array_length(p_access_tokens, 1), 0) not between 1 and 20 then raise exception 'Informe de 1 a 20 inscrições'; end if;
  perform 1 from public.registrations where access_token = any(p_access_tokens) for update;
  select array_agg(id order by created_at), count(*), sum(round(ticket_price * 100))::integer,
    jsonb_agg(jsonb_build_object('quantity', 1, 'price', round(ticket_price * 100)::integer,
      'description', left(event_name || ' - ' || name, 120)) order by created_at)
  into ids, reg_count, total, items
  from public.registrations
  where access_token = any(p_access_tokens) and payment_status = 'Pendente' and payment_method = 'PIX'
    and coalesce(ticket_price, 0) > 0 and payment_url is null;
  if reg_count = 0 then
    select * into first_reg from public.registrations
    where access_token = any(p_access_tokens) and payment_status = 'Pendente' and payment_url is not null
    order by created_at limit 1;
    if not found then return jsonb_build_object('status', 'Nada pendente'); end if;
    return jsonb_build_object('status', 'Pendente', 'url', first_reg.payment_url, 'expires_at', first_reg.pix_expires_at);
  end if;
  select * into first_reg from public.registrations where id = ids[1];
  if exists (select 1 from public.registrations where id = any(ids) and org_id <> first_reg.org_id) then
    raise exception 'Inscrições de igrejas diferentes não podem ser pagas juntas';
  end if;
  select * into s from public.organizations where id = first_reg.org_id;
  if nullif(trim(coalesce(s.infinitepay_handle, '')), '') is null then
    return jsonb_build_object('status', 'Pendente', 'configured', false);
  end if;
  if coalesce(p_origin, '') !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'Endereço do site inválido'; end if;
  select * into e from public.events where id = first_reg.event_id;
  phone_digits := regexp_replace(coalesce(first_reg.phone, ''), '\D', '', 'g');
  link := public.infinitepay_post('links', jsonb_build_object(
    'customer', jsonb_strip_nulls(jsonb_build_object(
      'name', first_reg.name,
      'email', nullif(trim(coalesce(s.customer_email, '')), ''),
      'phone_number', case when length(phone_digits) between 10 and 11 then '+55' || phone_digits end)),
    'handle', trim(leading '$' from trim(s.infinitepay_handle)),
    'order_nsu', group_id::text,
    'items', items,
    'redirect_url', p_origin || '/e/' || e.share_token::text,
    'webhook_url', p_origin || '/api/pix-webhook'));
  checkout_url := coalesce(link->>'url', link->>'link', link->>'checkout_url');
  if checkout_url is null then raise exception 'A InfinitePay não devolveu o link de pagamento'; end if;
  expires := now() + make_interval(mins => s.pix_minutes);
  update public.registrations set payment_group = group_id, payment_url = checkout_url, pix_expires_at = expires
  where id = any(ids);
  return jsonb_build_object('status', 'Pendente', 'url', checkout_url, 'expires_at', expires,
    'count', reg_count, 'total', total);
end $$;
revoke all on function public.start_group_payment(uuid[],text) from public;
grant execute on function public.start_group_payment(uuid[],text) to anon, authenticated;

create or replace function public.confirm_registration_payment(
  p_order_nsu text, p_transaction_nsu text, p_slug text, p_receipt_url text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.organizations; result jsonb; order_id uuid; total integer; tokens uuid[];
        r public.registrations; any_status text; org uuid;
begin
  if coalesce(p_order_nsu, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or length(coalesce(p_transaction_nsu, '')) not between 1 and 100
     or length(coalesce(p_slug, '')) not between 1 and 100 then
    raise exception 'Pagamento inválido';
  end if;
  order_id := p_order_nsu::uuid;
  perform 1 from public.registrations where payment_group = order_id or id = order_id for update;
  select array_agg(access_token order by created_at), sum(round(coalesce(ticket_price, 0) * 100))::integer, min(org_id::text)::uuid
  into tokens, total, org
  from public.registrations where payment_group = order_id or id = order_id;
  if tokens is null then raise exception 'Inscrição não encontrada'; end if;
  if exists (select 1 from public.registrations where (payment_group = order_id or id = order_id)
             and payment_transaction_nsu = p_transaction_nsu) then
    return jsonb_build_object('status', 'Confirmado', 'access_token', tokens[1], 'access_tokens', to_jsonb(tokens));
  end if;
  if not exists (select 1 from public.registrations where (payment_group = order_id or id = order_id)
                 and payment_transaction_nsu is null and coalesce(payment_status, '') not in ('Confirmado', 'Pago')) then
    select payment_status into any_status from public.registrations where payment_group = order_id or id = order_id limit 1;
    return jsonb_build_object('status', any_status);
  end if;
  if exists (select 1 from public.registrations where payment_transaction_nsu = p_transaction_nsu) then
    raise exception 'Este pagamento já confirmou outra inscrição';
  end if;
  -- A consulta usa a InfiniteTag da igreja dona das inscrições.
  select * into s from public.organizations where id = org;
  result := public.infinitepay_post('payment_check', jsonb_build_object(
    'handle', trim(leading '$' from trim(s.infinitepay_handle)),
    'order_nsu', p_order_nsu, 'transaction_nsu', p_transaction_nsu, 'slug', p_slug));
  if lower(coalesce(result->>'paid', 'false')) <> 'true' or coalesce((result->>'amount')::numeric, 0) < total then
    return jsonb_build_object('status', 'Pendente');
  end if;
  update public.registrations set payment_transaction_nsu = p_transaction_nsu,
    payment_capture_method = left(result->>'capture_method', 40), paid_at = now(),
    payment_receipt_url = case when p_receipt_url ~ '^https://' then left(p_receipt_url, 500) end
  where (payment_group = order_id or id = order_id) and payment_transaction_nsu is null;
  for r in select * from public.registrations where payment_group = order_id or id = order_id loop
    begin
      update public.registrations set payment_status = 'Confirmado' where id = r.id and payment_status <> 'Confirmado';
    exception when others then
      null; -- pagou depois de a vaga expirar e o lote esgotou: fica com paid_at para a equipe resolver
    end;
  end loop;
  return jsonb_build_object('status', 'Confirmado', 'access_token', tokens[1], 'access_tokens', to_jsonb(tokens));
end $$;
revoke all on function public.confirm_registration_payment(text,text,text,text) from public;
grant execute on function public.confirm_registration_payment(text,text,text,text) to anon, authenticated;

-- ===== Área do dono do sistema =====

create or replace function public.owner_list_orgs() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then raise exception 'Somente o dono do sistema'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'name', o.name, 'infinitepay_handle', o.infinitepay_handle, 'customer_email', o.customer_email,
    'pix_minutes', o.pix_minutes, 'pix_key', o.pix_key, 'receipt_whatsapp', o.receipt_whatsapp,
    'access_until', o.access_until, 'active', o.active, 'created_at', o.created_at,
    'admins', (select coalesce(jsonb_agg(u.email order by u.email), '[]'::jsonb)
               from public.org_members m join auth.users u on u.id = m.user_id where m.org_id = o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'date', e.date, 'active', e.active, 'created_at', e.created_at,
        'registrations', (select count(*) from public.registrations r where r.event_id = e.id and coalesce(r.payment_status, '') <> 'Expirado'),
        'paid', (select count(*) from public.registrations r where r.event_id = e.id and r.payment_status in ('Confirmado', 'Pago'))
      ) order by e.created_at desc), '[]'::jsonb) from public.events e where e.org_id = o.id)
  ) order by o.created_at), '[]'::jsonb) from public.organizations o);
end $$;
revoke all on function public.owner_list_orgs() from public, anon;
grant execute on function public.owner_list_orgs() to authenticated;

-- Cria a organização e liga o login (criado antes pelo app) do pastor a ela.
create or replace function public.owner_create_org(p_name text, p_admin_email text, p_access_until date) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid; org uuid; other text;
begin
  if not public.is_super_admin() then raise exception 'Somente o dono do sistema'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'Informe o nome da igreja ou rede'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_admin_email));
  if uid is null then raise exception 'Login não encontrado para este e-mail'; end if;
  select o.name into other from public.org_members m join public.organizations o on o.id = m.org_id where m.user_id = uid;
  if other is not null then raise exception 'Este e-mail já é administrador de "%"', other; end if;
  insert into public.organizations(name, access_until) values (trim(p_name), p_access_until) returning id into org;
  insert into public.org_members(user_id, org_id) values (uid, org);
  return org;
end $$;
revoke all on function public.owner_create_org(text,text,date) from public, anon;
grant execute on function public.owner_create_org(text,text,date) to authenticated;

create or replace function public.owner_update_org(
  p_org uuid, p_name text, p_infinitepay_handle text, p_customer_email text, p_pix_minutes integer,
  p_pix_key text, p_receipt_whatsapp text, p_access_until date, p_active boolean
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then raise exception 'Somente o dono do sistema'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'Informe o nome da igreja ou rede'; end if;
  update public.organizations set
    name = trim(p_name),
    infinitepay_handle = nullif(trim(leading '$' from trim(coalesce(p_infinitepay_handle, ''))), ''),
    customer_email = nullif(trim(coalesce(p_customer_email, '')), ''),
    pix_minutes = coalesce(p_pix_minutes, 60),
    pix_key = nullif(trim(coalesce(p_pix_key, '')), ''),
    receipt_whatsapp = nullif(regexp_replace(coalesce(p_receipt_whatsapp, ''), '\D', '', 'g'), ''),
    access_until = p_access_until,
    active = coalesce(p_active, true)
  where id = p_org;
  if not found then raise exception 'Organização não encontrada'; end if;
  return true;
end $$;
revoke all on function public.owner_update_org(uuid,text,text,text,integer,text,text,date,boolean) from public, anon;
grant execute on function public.owner_update_org(uuid,text,text,text,integer,text,text,date,boolean) to authenticated;

-- Testa a InfiniteTag criando um link de R$ 1,00 (nada é cobrado).
create or replace function public.owner_test_infinitepay(p_handle text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare link jsonb;
begin
  if not public.is_super_admin() then raise exception 'Somente o dono do sistema'; end if;
  link := public.infinitepay_post('links', jsonb_build_object(
    'handle', trim(leading '$' from trim(coalesce(p_handle, ''))),
    'order_nsu', gen_random_uuid()::text,
    'items', jsonb_build_array(jsonb_build_object('quantity', 1, 'price', 100, 'description', 'Teste de configuração'))));
  return jsonb_build_object('ok', true, 'url', coalesce(link->>'url', link->>'link'));
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end $$;
revoke all on function public.owner_test_infinitepay(text) from public, anon;
grant execute on function public.owner_test_infinitepay(text) to authenticated;

notify pgrst, 'reload schema';
commit;
select 'Pronto! Várias igrejas ativadas' as resultado;
