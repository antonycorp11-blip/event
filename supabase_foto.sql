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
select 'Foto ativada' as resultado;
