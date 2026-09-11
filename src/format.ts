/** Shared number/currency formatting helpers (India). */

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString('en-IN');
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatPercent(part: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function formatDecimal(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '-';
  return n.toFixed(digits);
}
