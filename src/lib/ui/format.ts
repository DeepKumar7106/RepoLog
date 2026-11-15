export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined, timeZone = "UTC"): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) {
    return "No activity yet";
  }

  if (start && end && start !== end) {
    return `${formatMonth(start)} – ${formatMonth(end)}`;
  }

  return formatMonth(start ?? end);
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatDateKey(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "Never";
  }

  const target = new Date(value).getTime();
  const diff = target - Date.now();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) {
    return "Just now";
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < hour) {
    return formatter.format(Math.round(diff / minute), "minute");
  }

  if (abs < day) {
    return formatter.format(Math.round(diff / hour), "hour");
  }

  if (abs < 30 * day) {
    return formatter.format(Math.round(diff / day), "day");
  }

  return formatDate(value);
}