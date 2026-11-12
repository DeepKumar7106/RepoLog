const DAY_MS = 24 * 60 * 60 * 1000;

export function safeTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

export function toLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((entry) => entry.type === type)?.value ?? "00";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDays(dateKey: string, days: number): string {
  return new Date(dateKeyToUtcDate(dateKey).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function todayDateKey(timeZone: string, now: Date = new Date()): string {
  return toLocalDateKey(now, timeZone);
}

export function dateRangeKeys(from: string, to: string): string[] {
  const start = dateKeyToUtcDate(from).getTime();
  const end = dateKeyToUtcDate(to).getTime();

  if (start > end) {
    return [];
  }

  const keys: string[] = [];

  for (let time = start; time <= end; time += DAY_MS) {
    keys.push(new Date(time).toISOString().slice(0, 10));
  }

  return keys;
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = dateKeyToUtcDate(value);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function localDayQueryRange(dateKey: string): { start: Date; end: Date } {
  const start = dateKeyToUtcDate(dateKey);

  return {
    start: new Date(start.getTime() - 2 * DAY_MS),
    end: new Date(start.getTime() + 3 * DAY_MS),
  };
}
