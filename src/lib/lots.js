// Lotes de ingressos: vendidos em ordem; o próximo começa quando o anterior esgota.
export const starterLots = () => [
  { name: '1º lote', quantity: '', price: '' },
  { name: '2º lote', quantity: '', price: '' },
];

export function checkedLots(rows) {
  if (rows.length < 1 || rows.length > 20) throw new Error('Informe de 1 a 20 lotes.');
  return rows.map((row, index) => {
    const name = row.name.trim();
    const quantity = Number(row.quantity);
    const price = Number(row.price);
    if (!name || name.length > 80) throw new Error(`Nome inválido no ${index + 1}º lote.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000000) throw new Error(`Quantidade inválida no ${index + 1}º lote.`);
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(row.price)) || !Number.isFinite(price) || price > 99999999) throw new Error(`Valor inválido no ${index + 1}º lote.`);
    return { ...(row.id ? { id: row.id } : {}), name, quantity, price };
  });
}
