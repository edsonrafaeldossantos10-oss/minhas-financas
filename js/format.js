// Helpers de formatação (moeda, data) — pt-BR.

function formatBRL(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseValorInput(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const cleaned = String(str)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(,|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateLongBR(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function monthLabel(year, month) {
  const d = new Date(year, month, 1);
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

function isoDateForYearMonthDay(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function addMonthsToISODate(isoDate, monthsToAdd) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(y, m - 1 + monthsToAdd, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return isoDateForYearMonthDay(base.getFullYear(), base.getMonth(), day);
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
