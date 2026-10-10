const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#0891b2', '#b45309', '#be185d', '#4d7c0f', '#6d28d9'];
export const colorFor = (id) => COLORS[Math.abs(Number(id) || 0) % COLORS.length];

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '?';

export function timeAgo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 45) return 'just now';
  const units = [[60, 'min'], [3600, 'hour'], [86400, 'day'], [2592000, 'month']];
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  if (s < 2592000) return `${Math.round(s / 86400)} d ago`;
  return new Date(d).toLocaleDateString([], { dateStyle: 'medium' });
}

export function gradientFor(id = '') {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 78% 62%), hsl(${(h + 45) % 360} 80% 52%))`;
}
