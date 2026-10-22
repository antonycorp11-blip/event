import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const getSupabaseConfig = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('event_supabase_config') || 'null');
    if (saved?.url && saved?.anonKey) return saved;
  } catch (_) {}
  return { url: envUrl || '', anonKey: envKey || '' };
};

let config = getSupabaseConfig();
export let supabase = config.url && config.anonKey ? createClient(config.url, config.anonKey) : null;

const client = () => {
  if (!supabase) throw new Error('Configure a URL e a chave pública do Supabase.');
  return supabase;
};

const result = ({ data, error }) => {
  if (error) throw new Error(`${error.message}${error.code ? ` (${error.code})` : ''}`);
  return data;
};

export const testSupabaseConnection = async (url = config.url, anonKey = config.anonKey) => {
  try {
    const testClient = createClient(url, anonKey);
    result(await testClient.rpc('get_shared_event', { p_token: '00000000-0000-0000-0000-000000000000' }));
    return { success: true, message: 'Supabase acessível.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const saveSupabaseConfig = (url, anonKey) => {
  config = { url, anonKey };
  localStorage.setItem('event_supabase_config', JSON.stringify(config));
  supabase = createClient(url, anonKey);
};

export const isSupabaseReady = () => Boolean(supabase);

export const signInAdmin = async (email, password) => {
  result(await client().auth.signInWithPassword({ email, password }));
  const { data, error } = await client().rpc('is_admin');
  if (error) throw new Error(error.message);
  return data === true;
};
export const registerAdminAccount = async (email, password) => {
  const { data, error } = await client().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return Boolean(data.session);
};
export const claimFirstAdmin = async (code) => result(await client().rpc('claim_first_admin', { p_code: code.trim() }));
export const createEventWithSetupCode = async (code, event) => result(await client().rpc('create_event_with_setup_code', {
  p_code: code.trim(), p_name: event.name.trim(), p_price: Number(event.price) || 0,
  p_date: event.date?.trim() || '', p_location: event.location?.trim() || ''
}));
export const createEventWithLots = async (code, event, lots) => result(await client().rpc('create_event_with_lots', {
  p_code: code.trim(), p_name: event.name.trim(), p_price: Number(lots[0]?.price) || 0,
  p_date: event.date?.trim() || '', p_location: event.location?.trim() || '', p_lots: lots
}));
export const saveEventLotsWithSetupCode = async (code, token, lots) => result(await client().rpc('save_event_lots_with_setup_code', {
  p_code: code.trim(), p_token: token, p_lots: lots
}));
export const signOutAdmin = async () => { result(await client().auth.signOut()); };
export const getAdminSession = async () => {
  const { data, error } = await client().auth.getSession();
  if (error || !data.session) return false;
  const check = await client().rpc('is_admin');
  return !check.error && check.data === true;
};

export const fetchEvents = async () => result(await client().from('events').select('*').order('created_at', { ascending: false })) || [];
export const fetchNetworks = async () => result(await client().from('networks').select('*').order('name')) || [];
export const fetchDisciplers = async () => result(await client().from('disciplers').select('*').order('name')) || [];
export const fetchLeaders = async () => result(await client().from('leaders').select('*').order('name')) || [];
export const fetchRegistrations = async () => result(await client().from('registrations').select('*').order('created_at', { ascending: false })) || [];

export const addEvent = async (event) => {
  const payload = {
    name: event.name.trim(), price: Number(event.price) || 0,
    date: event.date?.trim() || null, location: event.location?.trim() || null,
    active: event.active ?? true
  };
  if (event.id) {
    return result(await client().from('events').update(payload).eq('id', event.id).select().single());
  }
  return result(await client().from('events').insert(payload).select().single());
};

const addNamed = async (table, name) => result(await client().from(table).insert({ name: name.trim() }).select().single());
const deleteNamed = async (table, id) => result(await client().from(table).delete().eq('id', id));
export const addNetwork = (name) => addNamed('networks', name);
export const deleteNetwork = (id) => deleteNamed('networks', id);
export const addDiscipler = (name) => addNamed('disciplers', name);
export const deleteDiscipler = (id) => deleteNamed('disciplers', id);
export const addLeader = (name) => addNamed('leaders', name);
export const deleteLeader = (id) => deleteNamed('leaders', id);

export const createRegistration = async (registration) => {
  const payload = {
    event_id: registration.event_id, event_name: registration.event_name,
    name: registration.name.trim(), birth_date: registration.birth_date,
    network: registration.network, discipler: registration.discipler,
    leader: registration.leader?.trim() || '', payment_method: registration.payment_method,
    payment_status: 'Pendente', phone: registration.phone?.trim() || ''
  };
  return result(await client().from('registrations').insert(payload).select().single());
};
export const updateRegistrationStatus = async (id, status) => result(await client().from('registrations').update({ payment_status: status }).eq('id', id));
export const deleteRegistration = async (id) => result(await client().from('registrations').delete().eq('id', id));

// These RPCs expose only one event and its form options to a holder of its link.
export const fetchSharedEvent = async (token) => result(await client().rpc('get_shared_event', { p_token: token }));
export const createSharedRegistration = async (token, registration) => {
  const payload = {
    p_token: token,
    p_name: registration.name.trim(), p_birth_date: registration.birth_date,
    p_network: registration.network, p_discipler: registration.discipler,
    p_leader: registration.leader?.trim() || '', p_payment_method: registration.payment_method,
    p_phone: registration.phone?.trim() || ''
  };
  // O RPC antigo continua servindo eventos sem lotes até a migração ser aplicada.
  if (registration.ticket_lot_id) payload.p_lot_id = registration.ticket_lot_id;
  return result(await client().rpc('register_for_event', payload));
};

export const syncLocalToCloud = async () => {
  let synced = 0;
  for (const [key, table] of [['event_local_networks', 'networks'], ['event_local_disciplers', 'disciplers']]) {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    for (const item of items) {
      if (!item.name?.trim()) continue;
      result(await client().from(table).upsert({ name: item.name.trim() }, { onConflict: 'name' }));
      synced += 1;
    }
  }
  return synced;
};
