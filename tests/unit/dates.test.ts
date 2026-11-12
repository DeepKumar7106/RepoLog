import { describe, expect, it } from "vitest";
import {
  addDays,
  dateKeyToUtcDate,
  dateRangeKeys,
  isDateKey,
  toLocalDateKey,
  todayDateKey,
} from "@/lib/time/dates";

describe("date helpers", () => {
  it("validates real calendar date keys", () => {
    expect(isDateKey("2026-01-15")).toBe(true);
    expect(isDateKey("2024-02-29")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("not-a-date")).toBe(false);
  });

  it("builds inclusive date ranges and day offsets", () => {
    expect(dateRangeKeys("2026-01-01", "2026-01-03")).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    expect(dateRangeKeys("2026-01-03", "2026-01-01")).toEqual([]);
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("formats local date keys in the requested timezone", () => {
    const date = new Date("2026-01-14T20:00:00.000Z");

    expect(toLocalDateKey(date, "UTC")).toBe("2026-01-14");
    expect(toLocalDateKey(date, "Asia/Kolkata")).toBe("2026-01-15");
    expect(todayDateKey("Asia/Kolkata", date)).toBe("2026-01-15");
  });

  it("creates UTC dates for date keys", () => {
    expect(dateKeyToUtcDate("2026-01-15").toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});
