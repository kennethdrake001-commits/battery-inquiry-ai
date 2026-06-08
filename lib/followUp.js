export function parseFollowUpTime(value, baseDate = new Date()) {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T09:00:00.000Z`;
  }

  const normalized = trimmed.toLowerCase();
  const match = normalized.match(/^(\d+)\s*(hour|hours|day|days|week|weeks)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  const next = new Date(baseDate);

  if (unit.startsWith("hour")) {
    next.setHours(next.getHours() + amount);
  } else if (unit.startsWith("day")) {
    next.setDate(next.getDate() + amount);
  } else if (unit.startsWith("week")) {
    next.setDate(next.getDate() + amount * 7);
  }

  return next.toISOString();
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function hoursSince(value, now = new Date()) {
  if (!value) return null;
  return (now.getTime() - new Date(value).getTime()) / (1000 * 60 * 60);
}

export function daysSince(value, now = new Date()) {
  const hours = hoursSince(value, now);
  return hours === null ? null : hours / 24;
}
