import * as XLSX from 'xlsx';

// Calcular idade a partir da data de nascimento (suporta DD/MM/AAAA e YYYY-MM-DD)
export const calculateAge = (birthDateString) => {
  if (!birthDateString) return '-';
  let birth;
  if (typeof birthDateString === 'string' && birthDateString.includes('/')) {
    const parts = birthDateString.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      birth = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  } else {
    birth = new Date(birthDateString);
  }
  if (!birth || isNaN(birth.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return isNaN(age) || age < 0 || age > 125 ? '-' : `${age} anos`;
};

// Formatar data para exibição brasileira
export const formatDateBR = (dateString) => {
  if (!dateString) return '-';
  if (typeof dateString === 'string' && dateString.includes('/')) return dateString;
  try {
    const parts = String(dateString).split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch (e) {}
  return dateString;
};

// Preparar os dados para exportação
const formatDataForExport = (registrations) => {
  return registrations.map((item, index) => ({
    'Nº': index + 1,
    'Evento': item.event_name || 'Geral',
    'Nome Completo': item.name || '',
    'Data de Nascimento': formatDateBR(item.birth_date),
    'Idade': calculateAge(item.birth_date),
    'Rede': item.network || 'Não informada',
    'Líder': item.leader ? item.leader : 'Em branco',
    'Discipulador': item.discipler || 'Não informado',
    'Forma de Pagamento': item.payment_method || 'Não informada',
    'Status do Pagamento': item.payment_status || 'Pendente',
    'Telefone / WhatsApp': item.phone || '',
    'Data da Inscrição': item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''
  }));
};

// Exportar para Excel (.xlsx)
export const exportToExcel = (registrations, filterSummary = 'Filtrados') => {
  if (!registrations || registrations.length === 0) {
    alert('Nenhum registro encontrado para exportar.');
    return;
  }

  const formatted = formatDataForExport(registrations);
  const worksheet = XLSX.utils.json_to_sheet(formatted);

  // Ajustar larguras das colunas
  const colWidths = [
    { wch: 5 },  // Nº
    { wch: 25 }, // Evento
    { wch: 28 }, // Nome
    { wch: 18 }, // Data Nasc
    { wch: 12 }, // Idade
    { wch: 16 }, // Rede
    { wch: 20 }, // Líder
    { wch: 22 }, // Discipulador
    { wch: 20 }, // Pagamento
    { wch: 20 }, // Status
    { wch: 18 }, // Telefone
    { wch: 20 }  // Data Inscrição
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscritos');

  const cleanTag = filterSummary.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Inscritos_Event_${cleanTag}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
};

// Exportar para CSV com UTF-8 BOM
export const exportToCSV = (registrations, filterSummary = 'Filtrados') => {
  if (!registrations || registrations.length === 0) {
    alert('Nenhum registro encontrado para exportar.');
    return;
  }

  const formatted = formatDataForExport(registrations);
  if (formatted.length === 0) return;

  const headers = Object.keys(formatted[0]);
  const rows = formatted.map((row) =>
    headers.map((fieldName) => {
      const val = row[fieldName] ? String(row[fieldName]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(';')
  );

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const cleanTag = filterSummary.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `Inscritos_Event_${cleanTag}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Gerar texto formatado com emojis para envio no WhatsApp
export const generateWhatsAppText = (registrations, eventName = 'Evento', filterTag = '') => {
  if (!registrations || registrations.length === 0) return '';
  
  const today = new Date().toLocaleDateString('pt-BR');
  let text = `📋 *LISTA DE INSCRITOS - ${eventName.toUpperCase()}*\n`;
  text += `📅 *Data:* ${today}\n`;
  if (filterTag && filterTag !== 'Todos' && filterTag !== 'Inscritos') {
    text += `🔍 *Filtro:* ${filterTag}\n`;
  }
  text += `👥 *Total:* ${registrations.length} participante(s)\n\n`;

  registrations.forEach((reg, index) => {
    const age = calculateAge(reg.birth_date);
    const isPaid = reg.payment_status === 'Confirmado' || reg.payment_status === 'Pago';
    const statusIcon = isPaid ? '✅' : '⏳';
    
    text += `${index + 1}. *${reg.name}* (${age})\n`;
    text += `   • Rede: ${reg.network || 'Não informada'}\n`;
    text += `   • Discipulador: ${reg.discipler || 'Não informado'}\n`;
    if (reg.leader && reg.leader.trim()) {
      text += `   • Líder: ${reg.leader}\n`;
    }
    text += `   • Pgto: ${reg.payment_method || 'PIX'} (${statusIcon} ${reg.payment_status || 'Pendente'})\n`;
    if (reg.phone && reg.phone.trim()) {
      text += `   • Contato: ${reg.phone}\n`;
    }
    text += `\n`;
  });

  const confirmedCount = registrations.filter(r => r.payment_status === 'Confirmado' || r.payment_status === 'Pago').length;
  const pendingCount = registrations.length - confirmedCount;
  text += `📊 *Resumo:*\n`;
  text += `✅ Pagos / Confirmados: ${confirmedCount}\n`;
  text += `⏳ Pendentes: ${pendingCount}\n`;

  return text;
};

// Copiar ou Compartilhar no WhatsApp
export const copyOrShareWhatsApp = async (registrations, eventName = 'Evento', filterTag = '') => {
  const text = generateWhatsAppText(registrations, eventName, filterTag);
  if (!text) {
    alert('Nenhum inscrito para exportar.');
    return false;
  }

  // Tentar Web Share API primeiro no celular
  if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({
        title: `Inscritos - ${eventName}`,
        text: text
      });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }

  // Copiar para a área de transferência
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e2) {
      alert('Não foi possível copiar automaticamente.');
      return false;
    }
  }
};
