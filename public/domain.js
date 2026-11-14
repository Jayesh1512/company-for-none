// Presentation only. Prices, permissions, splits and next actions come from the server.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function formatMoney(value) {
  if (!value || !/^(0|[1-9]\d*)$/.test(value.amount) || !Number.isInteger(value.decimals) || value.decimals < 0 || value.decimals > 30) return 'Not available';
  const digits = value.amount.padStart(value.decimals + 1, '0');
  const whole = value.decimals ? digits.slice(0, -value.decimals) : digits;
  const fraction = value.decimals ? digits.slice(-value.decimals).replace(/0+$/, '') : '';
  return `${BigInt(whole).toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} ${value.asset} · ${value.network}`;
}
export function formatNanoUsd(value) { return formatMoney({ amount: String(value), decimals: 9, asset: 'USD', network: 'accounting' }); }
export function safeSourceUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export const words = value => String(value || 'unknown').replaceAll('_', ' ').replaceAll('.', ' ');
