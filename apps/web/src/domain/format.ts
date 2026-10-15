export function formatCop(amount: string, locale: string): string {
  const negative = amount.startsWith('-');
  const raw = negative ? amount.slice(1) : amount;
  const [wholeRaw, fracRaw = ''] = raw.split('.');
  const fraction = `${fracRaw}00`.slice(0, 2);
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(1000.5);
  const group = parts.find((part) => part.type === 'group')?.value ?? '';
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const currency = parts.find((part) => part.type === 'currency')?.value ?? 'COP';
  const grouped = group ? wholeRaw.replace(/\B(?=(\d{3})+(?!\d))/g, group) : wholeRaw;
  const body = `${currency}\u00a0${grouped}${decimal}${fraction}`;
  return negative ? `-${body}` : body;
}

export function formatTimestamp(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
