import { createClient } from '@supabase/supabase-js';

// Obter configurações do .env ou localStorage
const getSavedConfig = () => {
  try {
    const local = localStorage.getItem('event_supabase_config');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.url && parsed.anonKey) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao ler configuração do localStorage', e);
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey && !envUrl.includes('seu-projeto')) {
    return { url: envUrl, anonKey: envKey };
  }

  return { url: '', anonKey: '' };
};

let currentConfig = getSavedConfig();
let supabase = null;

if (currentConfig.url && currentConfig.anonKey) {
  try {
    supabase = createClient(currentConfig.url, currentConfig.anonKey);
  } catch (e) {
    console.error('Erro ao instanciar Supabase:', e);
  }
}

// Armazenamento local (fallback e inicialização)
const LOCAL_STORAGE_KEYS = {
  REGISTRATIONS: 'event_local_registrations',
  EVENTS: 'event_local_events',
  NETWORKS: 'event_local_networks',
  DISCIPLERS: 'event_local_disciplers'
};

const defaultEvents = [
  {
    id: 'evt-1',
    name: 'Conferência do Reino 2026',
    date: '14 a 16 de Novembro',
    location: 'Auditório Principal',
    price: 80.00,
    active: true
  },
  {
    id: 'evt-2',
    name: 'Acampamento de Jovens - Conectados',
    date: '10 a 12 de Outubro',
    location: 'Sítio Recanto das Águas',
    price: 150.00,
    active: true
  }
];

const defaultNetworks = [
  { id: 'net-1', name: 'Jovens' },
  { id: 'net-2', name: 'Teens' },
  { id: 'net-3', name: 'Casais' },
  { id: 'net-4', name: 'Mulheres' },
  { id: 'net-5', name: 'Homens' },
  { id: 'net-6', name: 'Kids' }
];

const defaultDisciplers = [
  { id: 'disc-1', name: 'Pastor Marcos' },
  { id: 'disc-2', name: 'Pastora Helena' },
  { id: 'disc-3', name: 'Diácono Carlos' },
  { id: 'disc-4', name: 'Líder Mariana' }
];

// Helper para ler do localStorage com fallback padrão
const getLocalData = (key, defaults) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(key, JSON.stringify(defaults));
  return defaults;
};

// Helper para salvar no localStorage
const setLocalData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
};

// Testar conexão com o Supabase
export const testSupabaseConnection = async (url, anonKey) => {
  try {
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('events').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Conectado com sucesso ao Supabase!' };
  } catch (err) {
    return { success: false, message: err.message || 'Falha ao conectar' };
  }
};

// Salvar novas credenciais e recriar cliente
export const saveSupabaseConfig = (url, anonKey) => {
  localStorage.setItem('event_supabase_config', JSON.stringify({ url, anonKey }));
  currentConfig = { url, anonKey };
  if (url && anonKey) {
    supabase = createClient(url, anonKey);
  } else {
    supabase = null;
  }
};

export const getSupabaseConfig = () => currentConfig;

export const isSupabaseReady = () => !!supabase;

// ==========================================
// FUNÇÕES DE EVENTOS
// ==========================================
export const fetchEvents = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Erro ao buscar eventos no Supabase, usando local:', e);
    }
  }
  return getLocalData(LOCAL_STORAGE_KEYS.EVENTS, defaultEvents);
};

export const addEvent = async (event) => {
  const newEvent = {
    ...event,
    id: event.id || crypto.randomUUID(),
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase.from('events').insert([newEvent]).select();
      if (!error && data?.[0]) return data[0];
    } catch (e) {
      console.error('Erro ao adicionar evento no Supabase:', e);
    }
  }

  const local = getLocalData(LOCAL_STORAGE_KEYS.EVENTS, defaultEvents);
  const updated = [newEvent, ...local];
  setLocalData(LOCAL_STORAGE_KEYS.EVENTS, updated);
  return newEvent;
};

// ==========================================
// FUNÇÕES DE REDES (Cadastradas pelo usuário)
// ==========================================
export const fetchNetworks = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('networks')
        .select('*')
        .order('name', { ascending: true });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Erro ao buscar redes no Supabase, usando local:', e);
    }
  }
  return getLocalData(LOCAL_STORAGE_KEYS.NETWORKS, defaultNetworks);
};

export const addNetwork = async (name) => {
  const item = { id: crypto.randomUUID(), name: name.trim(), created_at: new Date().toISOString() };
  if (supabase) {
    try {
      const { data, error } = await supabase.from('networks').insert([item]).select();
      if (!error && data?.[0]) return data[0];
    } catch (e) {
      console.error('Erro ao adicionar rede no Supabase:', e);
    }
  }
  const local = getLocalData(LOCAL_STORAGE_KEYS.NETWORKS, defaultNetworks);
  const updated = [...local, item];
  setLocalData(LOCAL_STORAGE_KEYS.NETWORKS, updated);
  return item;
};

export const deleteNetwork = async (id) => {
  if (supabase) {
    try {
      await supabase.from('networks').delete().eq('id', id);
    } catch (e) {
      console.error('Erro ao deletar rede no Supabase:', e);
    }
  }
  const local = getLocalData(LOCAL_STORAGE_KEYS.NETWORKS, defaultNetworks);
  const updated = local.filter((n) => n.id !== id);
  setLocalData(LOCAL_STORAGE_KEYS.NETWORKS, updated);
};

// ==========================================
// FUNÇÕES DE DISCIPULADORES (Cadastrados pelo usuário)
// ==========================================
export const fetchDisciplers = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('disciplers')
        .select('*')
        .order('name', { ascending: true });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Erro ao buscar discipuladores no Supabase, usando local:', e);
    }
  }
  return getLocalData(LOCAL_STORAGE_KEYS.DISCIPLERS, defaultDisciplers);
};

export const addDiscipler = async (name) => {
  const item = { id: crypto.randomUUID(), name: name.trim(), created_at: new Date().toISOString() };
  if (supabase) {
    try {
      const { data, error } = await supabase.from('disciplers').insert([item]).select();
      if (!error && data?.[0]) return data[0];
    } catch (e) {
      console.error('Erro ao adicionar discipulador no Supabase:', e);
    }
  }
  const local = getLocalData(LOCAL_STORAGE_KEYS.DISCIPLERS, defaultDisciplers);
  const updated = [...local, item];
  setLocalData(LOCAL_STORAGE_KEYS.DISCIPLERS, updated);
  return item;
};

export const deleteDiscipler = async (id) => {
  if (supabase) {
    try {
      await supabase.from('disciplers').delete().eq('id', id);
    } catch (e) {
      console.error('Erro ao deletar discipulador no Supabase:', e);
    }
  }
  const local = getLocalData(LOCAL_STORAGE_KEYS.DISCIPLERS, defaultDisciplers);
  const updated = local.filter((d) => d.id !== id);
  setLocalData(LOCAL_STORAGE_KEYS.DISCIPLERS, updated);
};

// ==========================================
// FUNÇÕES DE INSCRIÇÕES
// ==========================================
export const fetchRegistrations = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Erro ao buscar inscrições no Supabase, usando local:', e);
    }
  }
  return getLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, []);
};

export const createRegistration = async (registration) => {
  const newRegistration = {
    ...registration,
    id: registration.id || crypto.randomUUID(),
    created_at: new Date().toISOString()
  };

  // Se o Supabase estiver conectado, salvar diretamente nele
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .insert([newRegistration])
        .select();

      if (error) {
        console.error('Erro ao salvar no Supabase:', error);
        throw error;
      }
      if (data?.[0]) {
        // Atualiza também o cache local
        const local = getLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, []);
        setLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, [data[0], ...local]);
        return data[0];
      }
    } catch (e) {
      console.error('Falha de inserção Supabase, gravando em fallback local:', e);
      // fallback abaixo
    }
  }

  // Gravação local (fallback ou modo local)
  const local = getLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, []);
  const updated = [newRegistration, ...local];
  setLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, updated);
  return newRegistration;
};

export const updateRegistrationStatus = async (id, status) => {
  if (supabase) {
    try {
      await supabase.from('registrations').update({ payment_status: status }).eq('id', id);
    } catch (e) {
      console.error('Erro ao atualizar status no Supabase:', e);
    }
  }
  const local = getLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, []);
  const updated = local.map((r) => (r.id === id ? { ...r, payment_status: status } : r));
  setLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, updated);
};

export const deleteRegistration = async (id) => {
  if (supabase) {
    try {
      await supabase.from('registrations').delete().eq('id', id);
    } catch (e) {
      console.error('Erro ao deletar inscrição no Supabase:', e);
    }
  }
  const local = getLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, []);
  const updated = local.filter((r) => r.id !== id);
  setLocalData(LOCAL_STORAGE_KEYS.REGISTRATIONS, updated);
};
