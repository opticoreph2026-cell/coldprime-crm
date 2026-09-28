import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  currentWeekRange,
  endOfDayPH,
  mondayOf,
  priceValidity,
  rangeDays,
  splitIntoWeeks,
  startOfDayPH,
  sundayOf,
  toISODate,
  todayPH,
  validateRange,
} from "./dates";

describe("date helpers (Asia/Manila)", () => {
  // 1. A request on a Sunday must return the week that ENDS on that Sunday.
  it("assigns Sunday to the week that ends on it", () => {
    expect(mondayOf("2026-09-27")).toBe("2026-09-21"); // Sunday -> that week's Monday
    expect(sundayOf("2026-09-27")).toBe("2026-09-27");
    const weeks = splitIntoWeeks("2026-09-27", "2026-09-27");
    expect(weeks).toHaveLength(1);
    expect(toISODate(weeks[0].weekEnd)).toBe("2026-09-27");
  });

  it("keeps Monday as the start of its own week", () => {
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
    expect(sundayOf("2026-09-28")).toBe("2026-10-04");
  });

  // 2. An activity at 23:30 Manila on the last selected day is included.
  it("range end covers 23:30 Manila on the last day", () => {
    const end = endOfDayPH("2026-10-02");
    expect(end.getTime()).toBeGreaterThanOrEqual(new Date("2026-10-02T23:30:00+08:00").getTime());
    const weeks = splitIntoWeeks("2026-09-28", "2026-10-02");
    expect(new Date("2026-10-02T23:30:00+08:00").getTime()).toBeLessThanOrEqual(weeks[0].rangeEnd.getTime());
  });

  // 3. An activity at 00:10 Manila on the first selected day is included.
  it("range start covers 00:10 Manila on the first day", () => {
    const start = startOfDayPH("2026-09-28");
    expect(start.getTime()).toBeLessThanOrEqual(new Date("2026-09-28T00:10:00+08:00").getTime());
  });

  it("does not treat Manila midnight as UTC midnight", () => {
    // 2026-09-28 00:00 +08:00 = 2026-09-27 16:00 UTC
    expect(startOfDayPH("2026-09-28").toISOString()).toBe("2026-09-27T16:00:00.000Z");
    expect(endOfDayPH("2026-10-02").toISOString()).toBe("2026-10-02T15:59:59.999Z");
  });

  // 4. A range crossing a month boundary yields exactly two weeks.
  it("splits a month-crossing range into exactly two labeled weeks", () => {
    const weeks = splitIntoWeeks("2026-09-28", "2026-10-11");
    expect(weeks).toHaveLength(2);
    expect(toISODate(weeks[0].weekStart)).toBe("2026-09-28");
    expect(toISODate(weeks[0].weekEnd)).toBe("2026-10-04");
    expect(toISODate(weeks[1].weekStart)).toBe("2026-10-05");
    expect(toISODate(weeks[1].weekEnd)).toBe("2026-10-11");
    expect(weeks[0].label).toContain("28 Sept");
    expect(weeks[1].label).toContain("05 Oct");
  });

  it("clips the first and last week to the chosen range", () => {
    const weeks = splitIntoWeeks("2026-09-30", "2026-10-07");
    expect(weeks).toHaveLength(2);
    expect(toISODate(weeks[0].rangeStart)).toBe("2026-09-30"); // clipped from Monday 28
    expect(toISODate(weeks[1].rangeEnd)).toBe("2026-10-07"); // clipped to Wednesday
  });

  // 7. from > to and ranges over 366 days are rejected.
  it("rejects from > to", () => {
    expect(validateRange("2026-10-05", "2026-09-28")).toBeTruthy();
    expect(() => splitIntoWeeks("2026-10-05", "2026-09-28")).toThrow();
  });

  it("rejects ranges longer than 366 days", () => {
    expect(validateRange("2025-01-01", "2026-01-02")).toBeTruthy();
    expect(validateRange("2026-01-01", "2026-12-31")).toBeNull(); // 365 days ok
    expect(rangeDays("2026-01-01", "2026-12-31")).toBe(365);
  });

  it("rejects malformed dates", () => {
    expect(validateRange("28-09-2026", "2026-10-02")).toBeTruthy();
    expect(validateRange("2026-09-28", "garbage")).toBeTruthy();
    expect(() => startOfDayPH("2026/09/28")).toThrow();
  });

  it("current week is Monday..Sunday in Manila", () => {
    const { from, to } = currentWeekRange();
    expect(mondayOf(from)).toBe(from);
    expect(sundayOf(to)).toBe(to);
    expect(from <= to).toBe(true);
    expect(rangeDays(from, to)).toBe(7);
    expect(todayPH()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("addDaysISO crosses month and year boundaries", () => {
    expect(addDaysISO("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("priceValidity flags expired and soon-expiring prices", () => {
    expect(priceValidity("2026-01-15", "2026-09-28")).toBe("expired");
    expect(priceValidity("2026-10-05", "2026-09-28")).toBe("expiring"); // 7 days
    expect(priceValidity("2026-10-12", "2026-09-28")).toBe("expiring"); // exactly 14 days
    expect(priceValidity("2026-10-13", "2026-09-28")).toBe("ok"); // 15 days
    expect(priceValidity(null, "2026-09-28")).toBe("none");
    expect(priceValidity("not-a-date")).toBe("none");
  });
});
