-- PIX AUTOMÁTICO (INFINITEPAY), INGRESSO COM QR CODE E CHECK-IN
-- Execute uma vez no SQL Editor do mesmo projeto Supabase. Pode ser repetido.
-- Mantém eventos, lotes e inscrições existentes.
begin;

-- O banco fala direto com a API de checkout da InfinitePay.
create extension if not exists http with schema extensions;

-- access_token: segredo que fica só no aparelho de quem se inscreveu pelo link.
-- ticket_code: código do ingresso (vai no QR Code apresentado no check-in).
alter table public.registrations add column if not exists access_token uuid not null default gen_random_uuid();
alter table public.registrations add column if not exists ticket_code text not null default upper(substr(md5(gen_random_uuid()::text), 1, 10));
alter table public.registrations add column if not exists payment_url text;
alter table public.registrations add column if not exists pix_expires_at timestamptz;
alter table public.registrations add column if not exists paid_at timestamptz;
alter table public.registrations add column if not exists payment_transaction_nsu text;
alter table public.registrations add column if not exists payment_capture_method text;
alter table public.registrations add column if not exists payment_receipt_url text;
alter table public.registrations add column if not exists checked_in_at timestamptz;
create unique index if not exists registrations_access_token on public.registrations(access_token);
create unique index if not exists registrations_ticket_code on public.registrations(ticket_code);
-- payment_group: inscrições pagas juntas num único Pix (a família toda de uma vez).
alter table public.registrations add column if not exists payment_group uuid;
create index if not exists registrations_payment_group on public.registrations(payment_group);
-- Um mesmo pagamento confirma todas as inscrições do grupo, então a transação não é mais única por linha.
drop index if exists public.registrations_payment_transaction;
create index if not exists registrations_payment_transaction_nsu on public.registrations(payment_transaction_nsu);
create index if not exists registrations_pix_pending on public.registrations(event_id, pix_expires_at) where payment_status = 'Pendente';

-- InfiniteTag (sem o $) que recebe os pagamentos, prazo para pagar e o e-mail
-- enviado ao checkout (a InfinitePay exige um; os comprovantes vão para ele).
-- Sem InfiniteTag, o link continua mostrando a chave Pix manual.
create table if not exists public.payment_settings (
  id boolean primary key default true check (id),
  infinitepay_handle text,
  pix_minutes integer not null default 60 check (pix_minutes between 10 and 1440)
);
alter table public.payment_settings add column if not exists customer_email text;
insert into public.payment_settings(id) values (true) on conflict do nothing;
alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from anon;
grant select, update on public.payment_settings to authenticated;
drop policy if exists admin_payment_settings on public.payment_settings;
create policy admin_payment_settings on public.payment_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Inscrição "Expirado" não ocupa vaga: a vaga volta ao lote ao expirar e é
-- retomada se a inscrição for confirmada depois.
create or replace function public.sync_ticket_on_status_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare was_expired boolean := coalesce(old.payment_status, '') = 'Expirado';
        is_expired boolean := coalesce(new.payment_status, '') = 'Expirado';
begin
  if new.ticket_lot_id is not null and new.ticket_lot_id is not distinct from old.ticket_lot_id then
    if was_expired and not is_expired then
      begin
        update public.ticket_lots set sold = sold + 1 where id = new.ticket_lot_id;
      exception when check_violation then
        raise exception 'Este lote está esgotado; não há vaga para reativar esta inscrição';
      end;
    elsif is_expired and not was_expired then
      update public.ticket_lots set sold = greatest(sold - 1, 0) where id = new.ticket_lot_id;
    end if;
  end if;
  if new.payment_status in ('Confirmado', 'Pago') and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end $$;
drop trigger if exists registration_status_syncs_ticket on public.registrations;
create trigger registration_status_syncs_ticket before update of payment_status on public.registrations
for each row execute function public.sync_ticket_on_status_change();

create or replace function public.release_ticket_after_registration_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.ticket_lot_id is not null and coalesce(old.payment_status, '') <> 'Expirado' then
    update public.ticket_lots set sold = greatest(sold - 1, 0) where id = old.ticket_lot_id;
  end if;
  return old;
end $$;

-- Só expira inscrições que geraram link de pagamento (pix_expires_at preenchido).
-- Os 10 minutos extras cobrem pagamentos feitos no último instante.
create or replace function public.expire_unpaid_pix(p_event_id uuid) returns void
language sql security definer set search_path = ''
as $$
  update public.registrations set payment_status = 'Expirado'
  where event_id = p_event_id and payment_status = 'Pendente'
    and pix_expires_at < now() - interval '10 minutes'
$$;
revoke all on function public.expire_unpaid_pix(uuid) from public, anon, authenticated;

-- Agora libera as vagas vencidas antes de mostrar a disponibilidade (por isso não é mais stable).
create or replace function public.get_shared_event(p_token uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.events;
begin
  select * into e from public.events where share_token = p_token and active = true;
  if not found then return null; end if;
  perform public.expire_unpaid_pix(e.id);
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

-- Inscrição pelo link: devolve também o access_token que o aparelho guarda.
-- Evento gratuito já sai confirmado, com ingresso.
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
  -- Com o Pix automático ligado, o prazo para pagar conta desde a inscrição:
  -- quem desiste sem abrir o pagamento também libera a vaga.
  update public.registrations r set pix_expires_at = now() + make_interval(mins => s.pix_minutes)
  from public.payment_settings s
  where r.id = new_id and s.id and r.payment_method = 'PIX' and coalesce(r.ticket_price, 0) > 0
    and nullif(trim(coalesce(s.infinitepay_handle, '')), '') is not null;
  select * into reg from public.registrations where id = new_id;
  return jsonb_build_object('id', reg.id, 'access_token', reg.access_token);
end $$;
revoke all on function public.register_for_event_public(uuid,text,date,text,text,text,text,text,uuid) from public;
grant execute on function public.register_for_event_public(uuid,text,date,text,text,text,text,text,uuid) to anon, authenticated;

-- Chamada à API da InfinitePay. O limite de tempo fica abaixo do limite das
-- consultas públicas do Supabase.
create or replace function public.infinitepay_post(p_path text, p_body jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare response record;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '2500');
  select * into response from extensions.http_post(
    'https://api.checkout.infinitepay.io/' || p_path, p_body::text, 'application/json');
  if response.status not between 200 and 299 then
    raise exception 'InfinitePay respondeu %: %', response.status, left(response.content, 300);
  end if;
  return response.content::jsonb;
end $$;
revoke all on function public.infinitepay_post(text,jsonb) from public, anon, authenticated;

-- Cria (uma vez) o link de pagamento da inscrição na InfinitePay.
-- p_origin é o endereço do site, para a volta após o pagamento e o aviso automático.
create or replace function public.start_registration_payment(p_access_token uuid, p_origin text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.registrations; s public.payment_settings; e public.events;
        link jsonb; checkout_url text; cents integer; expires timestamptz; phone_digits text;
begin
  select * into r from public.registrations where access_token = p_access_token for update;
  if not found then raise exception 'Inscrição não encontrada'; end if;
  cents := round(coalesce(r.ticket_price, 0) * 100);
  if coalesce(r.payment_status, 'Pendente') <> 'Pendente' or r.payment_method <> 'PIX' or cents <= 0 then
    return jsonb_build_object('status', coalesce(r.payment_status, 'Pendente'));
  end if;
  select * into s from public.payment_settings where id;
  if nullif(trim(coalesce(s.infinitepay_handle, '')), '') is null then
    return jsonb_build_object('status', 'Pendente', 'configured', false);
  end if;
  if r.payment_url is not null then
    return jsonb_build_object('status', 'Pendente', 'url', r.payment_url, 'expires_at', r.pix_expires_at);
  end if;
  if coalesce(p_origin, '') !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'Endereço do site inválido'; end if;
  select * into e from public.events where id = r.event_id;
  -- Dados já preenchidos no checkout: a pessoa só confirma o código do WhatsApp e paga.
  phone_digits := regexp_replace(coalesce(r.phone, ''), '\D', '', 'g');
  link := public.infinitepay_post('links', jsonb_build_object(
    'customer', jsonb_strip_nulls(jsonb_build_object(
      'name', r.name,
      'email', nullif(trim(coalesce(s.customer_email, '')), ''),
      'phone_number', case when length(phone_digits) between 10 and 11 then '+55' || phone_digits end)),
    'handle', trim(leading '$' from trim(s.infinitepay_handle)),
    'order_nsu', r.id::text,
    'items', jsonb_build_array(jsonb_build_object(
      'quantity', 1, 'price', cents,
      'description', left(r.event_name || coalesce(' - ' || r.ticket_lot_name, ''), 120))),
    'redirect_url', p_origin || '/e/' || e.share_token::text,
    'webhook_url', p_origin || '/api/pix-webhook'));
  checkout_url := coalesce(link->>'url', link->>'link', link->>'checkout_url');
  if checkout_url is null then raise exception 'A InfinitePay não devolveu o link de pagamento'; end if;
  expires := now() + make_interval(mins => s.pix_minutes);
  update public.registrations set payment_url = checkout_url, pix_expires_at = expires where id = r.id;
  return jsonb_build_object('status', 'Pendente', 'url', checkout_url, 'expires_at', expires);
end $$;
revoke all on function public.start_registration_payment(uuid,text) from public;
grant execute on function public.start_registration_payment(uuid,text) to anon, authenticated;

-- Um único link de pagamento para várias inscrições do mesmo aparelho (ex.: a família toda).
-- Junta as inscrições pendentes que ainda não têm link; as que já têm continuam com o delas.
create or replace function public.start_group_payment(p_access_tokens uuid[], p_origin text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.payment_settings; first_reg public.registrations; e public.events;
        group_id uuid := gen_random_uuid(); items jsonb; total integer; link jsonb;
        checkout_url text; expires timestamptz; phone_digits text; reg_count integer; ids uuid[];
begin
  if coalesce(array_length(p_access_tokens, 1), 0) not between 1 and 20 then raise exception 'Informe de 1 a 20 inscrições'; end if;
  select * into s from public.payment_settings where id;
  if nullif(trim(coalesce(s.infinitepay_handle, '')), '') is null then
    return jsonb_build_object('status', 'Pendente', 'configured', false);
  end if;
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
  if coalesce(p_origin, '') !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'Endereço do site inválido'; end if;
  select * into first_reg from public.registrations where id = ids[1];
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

-- Confirma o pagamento depois de consultar a própria InfinitePay. Chamada pela volta
-- do checkout e pelo aviso automático. order_nsu é o grupo (ou, nos links antigos, a
-- própria inscrição); o valor pago precisa cobrir todas as inscrições do grupo e a
-- transação não pode ter confirmado inscrições de outro grupo.
-- Devolve os access_tokens apenas para quem apresentou um pagamento válido.
create or replace function public.confirm_registration_payment(
  p_order_nsu text, p_transaction_nsu text, p_slug text, p_receipt_url text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.payment_settings; result jsonb; order_id uuid; total integer; tokens uuid[];
        r public.registrations; any_status text;
begin
  if coalesce(p_order_nsu, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or length(coalesce(p_transaction_nsu, '')) not between 1 and 100
     or length(coalesce(p_slug, '')) not between 1 and 100 then
    raise exception 'Pagamento inválido';
  end if;
  order_id := p_order_nsu::uuid;
  perform 1 from public.registrations where payment_group = order_id or id = order_id for update;
  select array_agg(access_token order by created_at), sum(round(coalesce(ticket_price, 0) * 100))::integer
  into tokens, total
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
  select * into s from public.payment_settings where id;
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

-- Quem tem o access_token vê só a própria inscrição. O código do ingresso
-- só aparece depois do pagamento confirmado.
create or replace function public.get_my_registrations(p_access_tokens uuid[]) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(array_length(p_access_tokens, 1), 0) > 20 then raise exception 'Muitas inscrições'; end if;
  update public.registrations set payment_status = 'Expirado'
  where access_token = any(p_access_tokens) and payment_status = 'Pendente'
    and pix_expires_at < now() - interval '10 minutes';
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'access_token', r.access_token, 'name', r.name,
    'event_name', r.event_name, 'event_date', e.date, 'event_location', e.location,
    'ticket_lot_name', r.ticket_lot_name, 'ticket_price', coalesce(r.ticket_price, e.price, 0),
    'payment_method', r.payment_method, 'payment_status', coalesce(r.payment_status, 'Pendente'),
    'ticket_code', case when r.payment_status in ('Confirmado','Pago') then r.ticket_code end,
    'payment_url', case when r.payment_status = 'Pendente' then r.payment_url end,
    'payment_group', r.payment_group,
    'pix_expires_at', r.pix_expires_at, 'checked_in_at', r.checked_in_at, 'created_at', r.created_at
  ) order by r.created_at desc), '[]'::jsonb)
  from public.registrations r left join public.events e on e.id = r.event_id
  where r.access_token = any(p_access_tokens));
end $$;
revoke all on function public.get_my_registrations(uuid[]) from public;
grant execute on function public.get_my_registrations(uuid[]) to anon, authenticated;

-- Recupera a inscrição em outro aparelho pelo nome completo e data de nascimento.
create or replace function public.find_my_registrations(p_token uuid, p_name text, p_birth_date date) returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(r.access_token order by r.created_at desc), array[]::uuid[])
  from public.registrations r join public.events e on e.id = r.event_id
  where e.share_token = p_token and e.active = true
    and r.birth_date = p_birth_date
    and lower(regexp_replace(trim(r.name), '\s+', ' ', 'g')) = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'))
$$;
revoke all on function public.find_my_registrations(uuid,text,date) from public;
grant execute on function public.find_my_registrations(uuid,text,date) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
select 'Pagamento InfinitePay e ingressos ativados' as resultado;
