-- PIX AUTOMÁTICO, INGRESSO COM QR CODE E CHECK-IN
-- Execute uma vez no SQL Editor do mesmo projeto Supabase. Pode ser repetido.
-- Mantém eventos, lotes e inscrições existentes.
begin;

-- access_token: segredo que fica só no aparelho de quem se inscreveu pelo link.
-- ticket_code: código do ingresso (vai no QR Code apresentado no check-in).
alter table public.registrations add column if not exists access_token uuid not null default gen_random_uuid();
alter table public.registrations add column if not exists ticket_code text not null default upper(substr(md5(gen_random_uuid()::text), 1, 10));
alter table public.registrations add column if not exists pix_charge_id text;
alter table public.registrations add column if not exists pix_br_code text;
alter table public.registrations add column if not exists pix_expires_at timestamptz;
alter table public.registrations add column if not exists paid_at timestamptz;
alter table public.registrations add column if not exists checked_in_at timestamptz;
create unique index if not exists registrations_access_token on public.registrations(access_token);
create unique index if not exists registrations_ticket_code on public.registrations(ticket_code);
create index if not exists registrations_pix_pending on public.registrations(event_id, pix_expires_at) where payment_status = 'Pendente';

-- Inscrição "Expirado" não ocupa vaga: a vaga volta ao lote ao expirar e é
-- retomada se a equipe confirmar a inscrição depois.
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

-- Só expira cobranças geradas pelo PIX automático (pix_expires_at preenchido).
-- Os 10 minutos extras cobrem avisos de pagamento que chegam atrasados.
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
  select * into reg from public.registrations where id = new_id;
  return jsonb_build_object('id', reg.id, 'access_token', reg.access_token);
end $$;
revoke all on function public.register_for_event_public(uuid,text,date,text,text,text,text,text,uuid) from public;
grant execute on function public.register_for_event_public(uuid,text,date,text,text,text,text,text,uuid) to anon, authenticated;

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
    'pix_br_code', case when r.payment_status = 'Pendente' then r.pix_br_code end,
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
select 'Pix automático e ingressos ativados' as resultado;
